/**
 * CodeSync Content Script
 * 
 * Intercepts LeetCode's GraphQL network responses to reliably detect
 * accepted submissions. This is far more robust than DOM scraping,
 * which breaks every time LeetCode updates their UI class names.
 * 
 * Flow:
 *   1. Inject a page-level script that monkey-patches window.fetch
 *   2. When the patched fetch sees a response from /graphql containing
 *      submission data with status "Accepted", it posts a message to
 *      the content script via window.postMessage.
 *   3. The content script receives the message and forwards it to the
 *      background service worker via chrome.runtime.sendMessage.
 */

// The network interceptor code is compiled to interceptor.js and injected via script.src
// to comply with strict Content Security Policies on LeetCode.

import { htmlToMarkdown } from '../utils/html';
import { logToBackground, warnToBackground } from '../utils/logger';
import { LRUCache } from '../utils/lru';

interface QuestionMetadata {
  questionId: string;
  title: string;
  titleSlug: string;
  difficulty: string;
  content: string;
  topicTags?: { name: string }[];
}

// ── In-Memory Question Metadata Cache (Zero-latency lookup) ────────────────
const questionCache = new LRUCache<string, QuestionMetadata>(50);

// ── Processed submissions tracker (Bounded to prevent memory leaks) ──────────
const processedSubmissionIds = new LRUCache<string, boolean>(200);

function trackSubmissionId(id: string): void {
  processedSubmissionIds.set(id, true);
}

function isContextInvalidated(): boolean {
  try {
    return !chrome.runtime || !chrome.runtime.id;
  } catch (e) {
    return true;
  }
}

// ── Fetch full submission details when we only have an ID ──────────────────
async function fetchSubmissionDetails(submissionId: string) {
  const query = `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        code
        timestamp
        statusCode
        lang {
          name
        }
        question {
          questionId
          title
          titleSlug
          difficulty
          content
          topicTags {
            name
          }
        }
      }
    }
  `;

  const response = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: { submissionId: parseInt(submissionId, 10) },
    }),
  });

  if (!response.ok) return null;
  const json = await response.json();
  if (json.errors || !json.data?.submissionDetails) return null;
  return json.data.submissionDetails;
}

// ── Get question slug from URL ─────────────────────────────────────────────
function getQuestionSlug(): string {
  const pathParts = window.location.pathname.split('/');
  const problemsIndex = pathParts.indexOf('problems');
  if (problemsIndex !== -1 && pathParts[problemsIndex + 1]) {
    return pathParts[problemsIndex + 1];
  }
  return '';
}

// ── Build and send submission to background ────────────────────────────────
interface SubmissionData {
  submissionId: string;
  code: string;
  lang: string;
  timestamp: number;
  question: {
    questionId: string;
    title: string;
    titleSlug: string;
    difficulty: string;
    content: string;
    topicTags?: { name: string }[];
  } | null;
}

async function handleAcceptedSubmission(data: SubmissionData, isHistoricalEvent = false) {
  if (isContextInvalidated()) return;
  const subId = data.submissionId;
  if (!subId) return;

  logToBackground('CodeSync:Content', 'Handling accepted submission. SubId:', subId, 'isHistoricalEvent:', isHistoricalEvent);

  // Deduplicate synchronously in-memory first to prevent race conditions from simultaneous triggers
  if (processedSubmissionIds.has(subId)) {
    logToBackground('CodeSync:Content', 'SubId already in in-memory processed set:', subId);
    return;
  }
  trackSubmissionId(subId);

  let question = data.question;
  let code = data.code;
  let lang = data.lang;
  let timestamp = data.timestamp;

  // If question is missing, check in-memory questionCache first
  if (!question) {
    const slug = getQuestionSlug();
    const cachedQ = questionCache.get(slug) || questionCache.get(subId);
    if (cachedQ && cachedQ.content) {
      question = cachedQ;
      logToBackground('CodeSync:Content', 'Retrieved question metadata from in-memory cache for:', slug);
    }
  }

  // If we still don't have full details, fetch them
  if (!question || !code) {
    logToBackground('CodeSync:Content', 'Details incomplete, fetching full details for subId:', subId);
    const details = await fetchSubmissionDetails(subId);
    if (!details) {
      warnToBackground('CodeSync:Content', 'Failed to fetch submission details for subId:', subId);
      processedSubmissionIds.delete(subId); // Release lock on failure
      return;
    }
    if (details.statusCode !== 10) {
      logToBackground('CodeSync:Content', 'Fetched details statusCode is not 10:', details.statusCode);
      processedSubmissionIds.delete(subId); // Release lock on failure
      return;
    }
    question = details.question || question;
    code = details.code || code;
    lang = details.lang?.name || lang;
    timestamp = details.timestamp || timestamp;

    if (question && question.titleSlug) {
      questionCache.set(question.titleSlug, question);
    }
  }

  if (!question) {
    warnToBackground('CodeSync:Content', 'Question is null for subId:', subId);
    processedSubmissionIds.delete(subId); // Release lock on failure
    return;
  }

  // ── Bulletproof Historical Submission Guard ────────────────────────────
  // A submission is strictly historical if its timestamp is older than 5 minutes (300s)
  const hasTimestamp = typeof timestamp === 'number' && timestamp > 0;
  const timestampMs = hasTimestamp ? (timestamp > 1e11 ? timestamp : timestamp * 1000) : Date.now();
  const isOlderThan5Min = hasTimestamp && (Date.now() - timestampMs > 300_000);

  logToBackground('CodeSync:Content', 'Guard check: isHistoricalEvent =', isHistoricalEvent, 'isOlderThan5Min =', isOlderThan5Min, 'timestamp =', timestamp);

  // Only discard if the problem is genuinely older than 5 minutes AND history sync is OFF
  if (isOlderThan5Min) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const settingsData = await chrome.storage.local.get('settings');
        const syncHistoricalOnView = settingsData.settings?.syncHistoricalOnView ?? false;
        logToBackground('CodeSync:Content', 'syncHistoricalOnView setting is:', syncHistoricalOnView);
        if (!syncHistoricalOnView) {
          logToBackground('CodeSync:Content', 'Discarding historical submission (older than 5 min) because syncHistoricalOnView is false');
          processedSubmissionIds.delete(subId); // Allow it to be synced if user later enables History Sync
          return;
        }
      }
    } catch {
      processedSubmissionIds.delete(subId);
      return;
    }
  }

  const difficultyMap: Record<string, 'Easy' | 'Medium' | 'Hard'> = {
    'Easy': 'Easy',
    'Medium': 'Medium',
    'Hard': 'Hard',
  };

  const submission = {
    id: subId,
    problem: {
      id: question.questionId,
      title: question.title,
      slug: question.titleSlug || getQuestionSlug(),
      difficulty: difficultyMap[question.difficulty] || 'Medium',
      description: htmlToMarkdown(question.content),
      tags: (question.topicTags || []).map((t: { name: string }) => t.name),
      url: `https://leetcode.com/problems/${question.titleSlug || getQuestionSlug()}/`,
    },
    language: lang,
    code: code,
    timestamp: timestampMs,
    status: 'ACCEPTED' as const,
  };

  logToBackground('CodeSync:Content', 'Sending ENQUEUE_SUBMISSION to background worker:', submission.id, submission.problem.title, isOlderThan5Min ? '(Historical)' : '(Live)');

  chrome.runtime.sendMessage(
    { action: 'ENQUEUE_SUBMISSION', payload: submission },
    (response) => {
      logToBackground('CodeSync:Content', 'Background responded to ENQUEUE_SUBMISSION:', response);
    }
  );
}

// ── Main entry point ───────────────────────────────────────────────────────
function initContentScript() {
  // Clean up legacy persistent processed IDs so historical sync is never blocked
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove('leetcode_processed_ids').catch(() => {});
    }
  } catch (e) {
    // Ignore legacy storage cleanup errors
  }

  // Listen for messages from the injected MAIN world interceptor
  const messageListener = async (event: MessageEvent) => {
    if (isContextInvalidated()) {
      window.removeEventListener('message', messageListener);
      return;
    }
    if (event.source !== window) return;

    // Forward interceptor logs to background service worker
    if (event.data?.type === 'CODESYNC_LOG' && event.data.payload) {
      try {
        chrome.runtime.sendMessage({
          action: 'LOG',
          payload: event.data.payload
        }).catch(() => {});
      } catch (e) {
        // Ignore transient messaging errors
      }
      return;
    }

    // Handle pre-cached question metadata
    if (event.data?.type === 'CODESYNC_QUESTION_METADATA' && event.data.payload?.question) {
      const q = event.data.payload.question;
      if (q.titleSlug) questionCache.set(q.titleSlug, q);
      if (q.questionId) questionCache.set(q.questionId, q);
      const slug = getQuestionSlug();
      if (slug) questionCache.set(slug, q);
      return;
    }

    const isHistorical = !!event.data?.isHistorical;
    if (event.data?.type === 'CODESYNC_SUBMISSION_ACCEPTED') {
      await handleAcceptedSubmission(event.data.payload, isHistorical);
    }

    if (event.data?.type === 'CODESYNC_JUDGING_ACCEPTED') {
      // We only have the ID from the judging progress, need to fetch details
      const subId = event.data.payload.submissionId;
      if (subId) {
        await handleAcceptedSubmission({
          submissionId: subId,
          code: '',
          lang: '',
          timestamp: Math.floor(Date.now() / 1000),
          question: null,
        }, false);
      }
    }

    if (event.data?.type === 'CODESYNC_SUBMISSION_LIST_ACCEPTED') {
      // From submission list polling — also fetch full details
      const subId = event.data.payload.submissionId;
      if (subId) {
        await handleAcceptedSubmission({
          submissionId: subId,
          code: '',
          lang: event.data.payload.lang || '',
          timestamp: event.data.payload.timestamp || Math.floor(Date.now() / 1000),
          question: null,
        }, true);
      }
    }
  };

  window.addEventListener('message', messageListener);

  // ── Fallback: DOM-based detection (runs as backup every 5s) ────────────
  // This covers edge cases where the network interception might miss something.
  const intervalId = setInterval(async () => {
    if (isContextInvalidated()) {
      clearInterval(intervalId);
      return;
    }
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    try {
      const successSelectors = [
        '[data-e2e-locator="submission-result"]',
        '.text-green-s',
        '.text-sd-success-500',
        'span[class*="success"]',
        'div[data-e2e-locator="submission-result"]',
      ];

      let isAccepted = false;
      for (const selector of successSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const text = el.textContent || '';
          if (text.includes('Accepted') || text.includes('Success')) {
            isAccepted = true;
            break;
          }
        }
      }

      if (!isAccepted) return;

      // Try to extract submission ID from the URL hash or page
      const urlMatch = window.location.href.match(/submissions\/(\d+)/);
      if (urlMatch) {
        const subId = urlMatch[1];
        await handleAcceptedSubmission({
          submissionId: subId,
          code: '',
          lang: '',
          timestamp: Math.floor(Date.now() / 1000),
          question: null,
        }, false);
      }
    } catch (e) {
      // Silently ignore fallback errors
    }
  }, 5000);
}

initContentScript();
