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

// ── Processed submissions tracker (Bounded to prevent memory leaks) ──────────
const MAX_IN_MEMORY_IDS = 200;
const processedSubmissionIds = new Set<string>();
const submissionIdQueue: string[] = [];

function trackSubmissionId(id: string): void {
  if (processedSubmissionIds.has(id)) return;
  processedSubmissionIds.add(id);
  submissionIdQueue.push(id);
  if (submissionIdQueue.length > MAX_IN_MEMORY_IDS) {
    const oldest = submissionIdQueue.shift();
    if (oldest) processedSubmissionIds.delete(oldest);
  }
}

function isContextInvalidated(): boolean {
  try {
    return !chrome.runtime || !chrome.runtime.id;
  } catch (e) {
    return true;
  }
}

async function isAlreadyProcessed(id: string): Promise<boolean> {
  if (isContextInvalidated()) return false;
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get('leetcode_processed_ids');
      const processed = (result.leetcode_processed_ids || {}) as Record<string, boolean>;
      return !!processed[id];
    }
  } catch (e) {
    // Ignore error
  }
  return false;
}

async function markAsProcessed(id: string): Promise<void> {
  trackSubmissionId(id);

  if (isContextInvalidated()) return;
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get('leetcode_processed_ids');
      const processed = (result.leetcode_processed_ids || {}) as Record<string, boolean>;
      processed[id] = true;

      // Storage bounding: prune if it grows beyond 500 entries
      const keys = Object.keys(processed);
      if (keys.length > 500) {
        const excess = keys.length - 400;
        for (let i = 0; i < excess; i++) {
          delete processed[keys[i]];
        }
      }

      await chrome.storage.local.set({ leetcode_processed_ids: processed });
    }
  } catch (e) {
    // Ignore error
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

async function handleAcceptedSubmission(data: SubmissionData) {
  if (isContextInvalidated()) return;
  const subId = data.submissionId;
  if (!subId) return;

  // Deduplicate synchronously in-memory first to prevent race conditions from simultaneous triggers
  if (processedSubmissionIds.has(subId)) {
    return;
  }
  processedSubmissionIds.add(subId);

  const alreadyDone = await isAlreadyProcessed(subId);
  if (alreadyDone) {
    return;
  }

  let question = data.question;
  let code = data.code;
  let lang = data.lang;
  let timestamp = data.timestamp;

  // If we don't have full details, fetch them
  if (!question || !code) {
    const details = await fetchSubmissionDetails(subId);
    if (!details) {
      processedSubmissionIds.delete(subId); // Release lock on failure
      return;
    }
    if (details.statusCode !== 10) {
      processedSubmissionIds.delete(subId); // Release lock on failure
      return;
    }
    question = details.question;
    code = details.code;
    lang = details.lang?.name || lang;
    timestamp = details.timestamp || timestamp;
  }

  if (!question) {
    processedSubmissionIds.delete(subId); // Release lock on failure
    return;
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
    timestamp: (timestamp || 0) * 1000,
    status: 'ACCEPTED' as const,
  };

  // Mark processed BEFORE sending to prevent duplicates from rapid-fire events
  await markAsProcessed(subId);

  chrome.runtime.sendMessage(
    { action: 'ENQUEUE_SUBMISSION', payload: submission }
  );
}

// ── Main entry point ───────────────────────────────────────────────────────
function initContentScript() {

  // Inject the network interceptor into the page context
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('interceptor.js');
  (document.head || document.documentElement).appendChild(script);

  // Listen for messages from the injected page script
  const messageListener = async (event: MessageEvent) => {
    if (isContextInvalidated()) {
      window.removeEventListener('message', messageListener);
      return;
    }
    if (event.source !== window) return;

    if (event.data?.type === 'CODESYNC_SUBMISSION_ACCEPTED') {
      await handleAcceptedSubmission(event.data.payload);
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
        });
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
        });
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
        });
      }
    } catch (e) {
      // Silently ignore fallback errors
    }
  }, 5000);
}

initContentScript();
