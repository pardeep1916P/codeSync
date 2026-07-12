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

// ── Processed submissions tracker ──────────────────────────────────────────
const processedSubmissionIds = new Set<string>();

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
    if (typeof chrome !== 'undefined' && chrome.storage) {
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
  processedSubmissionIds.add(id);

  if (isContextInvalidated()) return;
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get('leetcode_processed_ids');
      const processed = (result.leetcode_processed_ids || {}) as Record<string, boolean>;
      processed[id] = true;
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

// ── HTML to Markdown converter ─────────────────────────────────────────────
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  
  let text = html;
  
  // Math notation: sup and sub
  text = text.replace(/<sup>([^<]+)<\/sup>/g, '^$1');
  text = text.replace(/<sub>([^<]+)<\/sub>/g, '_$1');
  
  // Code blocks (Run early so we don't convert tags inside pre blocks to markdown formatting)
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/g, (_, code) => {
    // Strip inner HTML tags from preformatted text so it looks clean inside the code block
    const cleanCode = code.replace(/<[^>]*>/g, '');
    return `\n\`\`\`\n${cleanCode}\n\`\`\`\n`;
  });

  // Headers
  text = text.replace(/<h[1-6]>(.*?)<\/h[1-6]>/g, '### $1\n');
  
  // Bold/Italics
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**');
  text = text.replace(/<em[^>]*>(.*?)<\/em>/g, '_$1_');
  text = text.replace(/<b[^>]*>(.*?)<\/b>/g, '**$1**');
  text = text.replace(/<i[^>]*>(.*?)<\/i>/g, '_$1_');
  
  // Inline code
  text = text.replace(/<code[^>]*>(.*?)<\/code>/g, '`$1`');
  
  // Paragraphs and breaks
  text = text.replace(/<p[^>]*>/g, '');
  text = text.replace(/<\/p>/g, '\n\n');
  text = text.replace(/<br\s*\/?>/g, '\n');
  
  // Lists
  text = text.replace(/<ul[^>]*>/g, '\n');
  text = text.replace(/<\/ul>/g, '\n');
  text = text.replace(/<ol[^>]*>/g, '\n');
  text = text.replace(/<\/ol>/g, '\n');
  text = text.replace(/<li[^>]*>(.*?)<\/li>/g, '- $1\n');
  
  
  // Images
  text = text.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/g, (match, src) => {
    const absoluteSrc = src.startsWith('/') ? `https://leetcode.com${src}` : src;
    const altMatch = match.match(/alt=["']([^"']+)["']/);
    const alt = altMatch ? altMatch[1] : 'image';
    return `![${alt}](${absoluteSrc})`;
  });

  // Clean up remaining tags, entities, and whitespace
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/<[^>]*>/g, '') // strip any other remaining tags
    .replace(/\n{3,}/g, '\n\n') // collapse multiple newlines
    .trim();
    
  return text;
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
    console.log(`[CodeSync] Fetching full details for submission ${subId}...`);
    const details = await fetchSubmissionDetails(subId);
    if (!details) {
      console.error(`[CodeSync] Failed to fetch details for submission ${subId}.`);
      processedSubmissionIds.delete(subId); // Release lock on failure
      return;
    }
    if (details.statusCode !== 10) {
      console.log(`[CodeSync] Submission ${subId} is not Accepted (status=${details.statusCode}).`);
      processedSubmissionIds.delete(subId); // Release lock on failure
      return;
    }
    question = details.question;
    code = details.code;
    lang = details.lang?.name || lang;
    timestamp = details.timestamp || timestamp;
  }

  if (!question) {
    console.error(`[CodeSync] No question data for submission ${subId}.`);
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
      tags: (question.topicTags || []).map((t: any) => t.name),
      url: `https://leetcode.com/problems/${question.titleSlug || getQuestionSlug()}/`,
    },
    language: lang,
    code: code,
    timestamp: (timestamp || 0) * 1000,
    status: 'ACCEPTED' as const,
  };

  // Mark processed BEFORE sending to prevent duplicates from rapid-fire events
  await markAsProcessed(subId);

  console.log('[CodeSync] Sending accepted submission to background:', submission.problem.title);

  chrome.runtime.sendMessage(
    { action: 'ENQUEUE_SUBMISSION', payload: submission },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('[CodeSync] Error sending to background:', chrome.runtime.lastError);
        return;
      }
      if (response?.success) {
        console.log('[CodeSync] Submission enqueued successfully!');
      } else {
        console.error('[CodeSync] Failed to enqueue:', response?.error);
      }
    }
  );
}

// ── Main entry point ───────────────────────────────────────────────────────
function initContentScript() {
  console.log('[CodeSync] Content script active on:', window.location.href);

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
      console.log('[CodeSync] Intercepted accepted submission from network:', event.data.payload);
      await handleAcceptedSubmission(event.data.payload);
    }

    if (event.data?.type === 'CODESYNC_JUDGING_ACCEPTED') {
      // We only have the ID from the judging progress, need to fetch details
      const subId = event.data.payload.submissionId;
      if (subId) {
        console.log('[CodeSync] Judging accepted detected, fetching details for:', subId);
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
        console.log('[CodeSync] Submission list accepted detected:', subId);
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
