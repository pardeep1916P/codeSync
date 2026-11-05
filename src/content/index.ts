/**
 * CodeSync Content Script
 * 
 * Intercepts platform network responses (LeetCode, Codeforces, CodeChef)
 * to reliably detect accepted submissions without relying exclusively on brittle DOM class names.
 * 
 * Flow:
 *   1. Inject a page-level script (interceptor.js) that intercepts fetch & XHR requests.
 *   2. When an accepted submission is confirmed by the platform's judging API,
 *      it posts a typed message via window.postMessage.
 *   3. The content script receives the event, normalizes the submission metadata,
 *      deduplicates, and forwards to the background service worker via ENQUEUE_SUBMISSION.
 */

import { htmlToMarkdown } from '../utils/html';
import { logToBackground, warnToBackground } from '../utils/logger';
import { LRUCache } from '../utils/lru';
import { CodeforcesAdapter } from '../platforms/codeforces';
import { CodeChefAdapter } from '../platforms/codechef';

const codeforcesAdapter = new CodeforcesAdapter();
const codeChefAdapter = new CodeChefAdapter();

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

function extractPageCode(): string {
  try {
    // 1. Monaco Editor (CodeChef / modern online judges)
    const monacoLines = document.querySelectorAll('.monaco-editor .view-line');
    if (monacoLines.length > 0) {
      return Array.from(monacoLines).map(l => l.textContent || '').join('\n');
    }
    // 2. Ace Editor (Codeforces / older CodeChef)
    const aceContent = document.querySelector('.ace_content');
    if (aceContent) {
      const aceLines = aceContent.querySelectorAll('.ace_line');
      if (aceLines.length > 0) {
        return Array.from(aceLines).map(l => l.textContent || '').join('\n');
      }
    }
    // 3. Textarea / SourceCode inputs
    const sourceTextarea = document.querySelector('textarea#sourceCodeText, textarea[name="source"], #source-code') as HTMLTextAreaElement | null;
    if (sourceTextarea && sourceTextarea.value) {
      return sourceTextarea.value;
    }
    // 4. Pre / Code blocks
    const preCode = document.querySelector('pre.program-source, pre#program-source, pre code');
    if (preCode && preCode.textContent) {
      return preCode.textContent;
    }
  } catch {
    // Ignore extraction errors
  }
  return '';
}

// ── Fetch full LeetCode submission details when we only have an ID ─────────
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

// ── Build and send LeetCode submission to background ───────────────────────
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
    platform: 'leetcode' as const,
    problem: {
      id: question.questionId,
      title: question.title,
      slug: question.titleSlug || getQuestionSlug(),
      difficulty: difficultyMap[question.difficulty] || 'Medium',
      description: htmlToMarkdown(question.content),
      tags: (question.topicTags || []).map((t: { name: string }) => t.name),
      url: `https://leetcode.com/problems/${question.titleSlug || getQuestionSlug()}/`,
      platform: 'leetcode' as const,
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

// ── Codeforces Submission Handler ──────────────────────────────────────────
interface CodeforcesPayload {
  submissionId: string;
  contestId: string;
  index: string;
  problemName?: string;
  lang?: string;
  rating?: number | string;
  timestamp?: number;
}

async function handleCodeforcesSubmission(data: CodeforcesPayload) {
  if (isContextInvalidated()) return;
  const rawSubId = data.submissionId || `${Date.now()}`;
  const subId = `cf_${rawSubId}`;

  logToBackground('CodeSync:Content', 'Handling Codeforces submission:', subId, data.contestId, data.index);

  if (processedSubmissionIds.has(subId)) {
    logToBackground('CodeSync:Content', 'Codeforces subId already processed:', subId);
    return;
  }
  trackSubmissionId(subId);

  const titleEl = document.querySelector('.problem-statement .header .title');
  const domTitle = titleEl ? titleEl.textContent?.replace(/^[A-Z0-9]+\.\s*/, '').trim() : '';
  const problemTitle = data.problemName || domTitle || `Problem ${data.contestId}${data.index}`;

  const statementEl = document.querySelector('.problem-statement');
  const description = statementEl
    ? htmlToMarkdown(statementEl.innerHTML)
    : `# ${problemTitle}\n\n[Codeforces Problem Link](https://codeforces.com/contest/${data.contestId}/problem/${data.index})`;

  const tagElements = document.querySelectorAll('.tag-box');
  const tags = tagElements.length > 0
    ? Array.from(tagElements).map(el => el.textContent?.trim() || '').filter(Boolean)
    : ['Codeforces'];

  const difficulty = codeforcesAdapter.normalizeDifficulty(data.rating);
  const code = extractPageCode() || `// Codeforces Submission #${rawSubId}\n// Problem: ${problemTitle}\n// Contest: ${data.contestId}\n`;
  const lang = data.lang || 'cpp';
  const timestamp = (data.timestamp || Math.floor(Date.now() / 1000)) * 1000;

  const submission = {
    id: subId,
    platform: 'codeforces' as const,
    problem: {
      id: `${data.contestId}${data.index}`,
      title: problemTitle,
      slug: `codeforces-${data.contestId}-${data.index.toLowerCase()}`,
      difficulty,
      description,
      tags,
      url: `https://codeforces.com/contest/${data.contestId}/problem/${data.index}`,
      platform: 'codeforces' as const,
    },
    language: lang,
    code,
    timestamp,
    status: 'ACCEPTED' as const,
  };

  logToBackground('CodeSync:Content', 'Dispatching Codeforces ENQUEUE_SUBMISSION:', submission.id, problemTitle);
  chrome.runtime.sendMessage(
    { action: 'ENQUEUE_SUBMISSION', payload: submission },
    (response) => {
      logToBackground('CodeSync:Content', 'Background responded to Codeforces submission:', response);
    }
  );
}

// ── CodeChef Submission Handler ────────────────────────────────────────────
interface CodeChefPayload {
  submissionId: string;
  problemCode: string;
  lang?: string;
  timestamp?: number;
}

async function handleCodeChefSubmission(data: CodeChefPayload) {
  if (isContextInvalidated()) return;
  const rawSubId = data.submissionId || `${Date.now()}`;
  const subId = `cc_${rawSubId}`;

  logToBackground('CodeSync:Content', 'Handling CodeChef submission:', subId, data.problemCode);

  if (processedSubmissionIds.has(subId)) {
    logToBackground('CodeSync:Content', 'CodeChef subId already processed:', subId);
    return;
  }
  trackSubmissionId(subId);

  const headingEl = document.querySelector('h1, .problem-code, .problem-title');
  const domTitle = headingEl ? headingEl.textContent?.trim() : '';
  const problemTitle = domTitle || data.problemCode;

  const statementEl = document.querySelector('.problem-statement, #problem-statement, .problem-description');
  const description = statementEl
    ? htmlToMarkdown(statementEl.innerHTML)
    : `# ${problemTitle}\n\n[CodeChef Problem Link](https://www.codechef.com/problems/${data.problemCode})`;

  const difficulty = codeChefAdapter.normalizeDifficulty();
  const code = extractPageCode() || `// CodeChef Submission #${rawSubId}\n// Problem: ${problemTitle}\n`;
  const lang = data.lang || 'cpp';
  const timestamp = (data.timestamp || Math.floor(Date.now() / 1000)) * 1000;

  const submission = {
    id: subId,
    platform: 'codechef' as const,
    problem: {
      id: data.problemCode,
      title: problemTitle,
      slug: `codechef-${data.problemCode.toLowerCase()}`,
      difficulty,
      description,
      tags: ['CodeChef'],
      url: `https://www.codechef.com/problems/${data.problemCode}`,
      platform: 'codechef' as const,
    },
    language: lang,
    code,
    timestamp,
    status: 'ACCEPTED' as const,
  };

  logToBackground('CodeSync:Content', 'Dispatching CodeChef ENQUEUE_SUBMISSION:', submission.id, problemTitle);
  chrome.runtime.sendMessage(
    { action: 'ENQUEUE_SUBMISSION', payload: submission },
    (response) => {
      logToBackground('CodeSync:Content', 'Background responded to CodeChef submission:', response);
    }
  );
}

// ── Main entry point ───────────────────────────────────────────────────────
function initContentScript() {
  logToBackground('CodeSync:Content', '🚀 Content script initialized on URL:', window.location.href);

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

    if (event.data?.type === 'CODESYNC_CODEFORCES_ACCEPTED' && event.data.payload) {
      await handleCodeforcesSubmission(event.data.payload);
    }

    if (event.data?.type === 'CODESYNC_CODECHEF_ACCEPTED' && event.data.payload) {
      await handleCodeChefSubmission(event.data.payload);
    }
  };

  window.addEventListener('message', messageListener);

  // ── Fallback: DOM-based detection (runs as backup every 5s) ────────────
  const intervalId = setInterval(async () => {
    if (isContextInvalidated()) {
      clearInterval(intervalId);
      return;
    }
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    try {
      const hostname = window.location.hostname;

      // LeetCode DOM check
      if (hostname.includes('leetcode.')) {
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

        if (isAccepted) {
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
        }
      }

      // Codeforces DOM check fallback
      if (hostname.includes('codeforces.')) {
        const cfAccepted = document.querySelector('.verdict-accepted, span.verdict-accepted, .verdict-successful');
        if (cfAccepted) {
          const contestMatch = window.location.pathname.match(/(?:contest|problemset\/problem)\/(\d+)\/([A-Z0-9]+)/i);
          if (contestMatch) {
            await handleCodeforcesSubmission({
              submissionId: `dom_${Date.now()}`,
              contestId: contestMatch[1],
              index: contestMatch[2],
            });
          }
        }
      }
    } catch (e) {
      // Silently ignore fallback errors
    }
  }, 5000);
}

initContentScript();
