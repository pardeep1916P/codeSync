/* eslint-disable @typescript-eslint/no-explicit-any */
if (!(window as any).__codeSyncInjected) {
  (window as any).__codeSyncInjected = true;

  const interceptorLog = (...args: any[]) => {
    console.log('[CodeSync:Interceptor]', ...args);
    window.postMessage({
      type: 'CODESYNC_LOG',
      payload: { prefix: 'CodeSync:Interceptor', level: 'log', args }
    }, '*');
  };

  interceptorLog('Network interceptor loaded in page context');

  const originalFetch = window.fetch;

  window.fetch = async function(...args) {
    const response = await originalFetch(...args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : '');
      const hostname = window.location.hostname;
      const isLeetCode = hostname.includes('leetcode.com') || hostname.includes('leetcode.cn');
      const isCodeforces = hostname.includes('codeforces.');
      const isCodeChef = hostname.includes('codechef.com');

      // ── 1. LeetCode Interception ───────────────────────────────────────────
      if (isLeetCode) {
        const isGraphQL = url.includes('/graphql') || url.includes('leetcode.com/graphql');
        const isCheck = url.includes('/check/');
        const isSubmit = url.includes('/submit') || url.includes('/submit/');

        if (isGraphQL || isCheck || isSubmit) {
          interceptorLog(`⚡ Intercepted LeetCode request: ${url}`);
          const cloned = response.clone();
          cloned.json().then(function(json) {
            if (isSubmit && json) {
              interceptorLog('Submission initiated response:', json);
              if (json.submission_id) {
                (window as any).__codeSyncRecentJudgeId = String(json.submission_id);
                (window as any).__codeSyncRecentJudgeTime = Date.now();
              }
            }

            if (isCheck && json) {
              const match = url.match(/submissions\/detail\/(\d+)/) || url.match(/check\/(\d+)/);
              const subId = match ? match[1] : ((window as any).__codeSyncRecentJudgeId || null);
              const isAccepted = json.status_code === 10 || json.statusCode === 10 || json.status_msg === 'Accepted' || (json.state === 'SUCCESS' && json.status_code === 10);
              interceptorLog('🔍 Checked judging status. SubId:', subId, 'isAccepted:', isAccepted, json);
              if (subId && isAccepted) {
                (window as any).__codeSyncRecentJudgeId = subId;
                (window as any).__codeSyncRecentJudgeTime = Date.now();
                interceptorLog('📢 Posting CODESYNC_JUDGING_ACCEPTED for subId:', subId);
                window.postMessage({
                  type: 'CODESYNC_JUDGING_ACCEPTED',
                  payload: { submissionId: subId }
                }, '*');
              }
            }

            if (isGraphQL && json) {
              if (json.data && json.data.submissionProgress) {
                const progress = json.data.submissionProgress;
                if (progress && progress.state === 'SUCCESS' && progress.statusCode === 10) {
                  const subId = String(progress.submissionId || '');
                  if (subId) {
                    (window as any).__codeSyncRecentJudgeId = subId;
                    (window as any).__codeSyncRecentJudgeTime = Date.now();
                    window.postMessage({
                      type: 'CODESYNC_JUDGING_ACCEPTED',
                      payload: { submissionId: subId }
                    }, '*');
                  }
                }
              }

              if (json.data && json.data.submissionDetails) {
                const details = json.data.submissionDetails;
                if (details && details.statusCode === 10) {
                  const subId = String(details.id || '');
                  const recentJudgeId = (window as any).__codeSyncRecentJudgeId;
                  const recentJudgeTime = (window as any).__codeSyncRecentJudgeTime || 0;
                  const isActiveJudge = recentJudgeId === subId && (Date.now() - recentJudgeTime < 10000);

                  window.postMessage({
                    type: 'CODESYNC_SUBMISSION_ACCEPTED',
                    isHistorical: !isActiveJudge,
                    payload: {
                      submissionId: subId,
                      code: details.code || '',
                      lang: details.lang ? details.lang.name : '',
                      runtime: details.runtime || '',
                      memory: details.memory || '',
                      timestamp: details.timestamp || Math.floor(Date.now() / 1000),
                      question: details.question || null,
                    }
                  }, '*');
                }
              }

              if (json.data && json.data.question) {
                const q = json.data.question;
                if (q.questionId || q.titleSlug || q.title) {
                  window.postMessage({
                    type: 'CODESYNC_QUESTION_METADATA',
                    payload: { question: q }
                  }, '*');
                }
              }

              if (json.data && json.data.submissionList) {
                const submissions = json.data.submissionList.submissions || [];
                for (const sub of submissions) {
                  if (sub.statusDisplay === 'Accepted') {
                    window.postMessage({
                      type: 'CODESYNC_SUBMISSION_LIST_ACCEPTED',
                      isHistorical: true,
                      payload: {
                        submissionId: String(sub.id),
                        lang: sub.lang || '',
                        timestamp: sub.timestamp || Math.floor(Date.now() / 1000),
                      }
                    }, '*');
                    break;
                  }
                }
              }
            }
          }).catch(function() {});
        }
      }

      // ── 2. Codeforces Interception ─────────────────────────────────────────
      if (isCodeforces && (url.includes('/data/submit') || url.includes('/data/judge') || url.includes('/data/problemSubmission') || url.includes('mySubmissions') || url.includes('/api/'))) {
        interceptorLog(`⚡ Intercepted Codeforces request: ${url}`);
        const cloned = response.clone();
        cloned.json().then(function(json) {
          if (json) {
            const verdict = json.verdict || json.status || (json.result && json.result[0] ? json.result[0].verdict : null);
            if (verdict === 'OK' || verdict === 'Accepted') {
              const subId = String(json.submissionId || json.id || (json.result && json.result[0] ? json.result[0].id : Date.now()));
              const contestMatch = window.location.pathname.match(/(?:contest|problemset\/problem)\/(\d+)\/([A-Z0-9]+)/i);
              const contestId = json.contestId || (contestMatch ? contestMatch[1] : 'CF');
              const index = json.index || json.problem?.index || (contestMatch ? contestMatch[2] : 'Problem');
              const problemName = json.problemName || json.problem?.name || `${contestId}${index}`;
              const lang = json.language || json.programType || '';
              const rating = json.rating || json.problem?.rating || 1200;

              interceptorLog('📢 Codeforces Accepted Submission Detected:', subId, `${contestId}${index}`);
              window.postMessage({
                type: 'CODESYNC_CODEFORCES_ACCEPTED',
                payload: {
                  submissionId: subId,
                  contestId,
                  index,
                  problemName,
                  lang,
                  rating,
                  timestamp: Math.floor(Date.now() / 1000),
                }
              }, '*');
            }
          }
        }).catch(function() {});
      }

      // ── 3. CodeChef Interception ───────────────────────────────────────────
      if (isCodeChef && (url.includes('/api/ide/submit') || url.includes('/api/ide/run') || url.includes('/api/ide/status/'))) {
        interceptorLog(`⚡ Intercepted CodeChef request: ${url}`);
        const cloned = response.clone();
        cloned.json().then(function(json) {
          if (json) {
            const isAccepted = json.status === 'SUCCESS' && (json.result_code === 'accepted' || json.result === 'AC' || json.result_code === '15' || json.score === 100);
            if (isAccepted) {
              const subId = String(json.submission_id || json.id || Date.now());
              const probMatch = window.location.pathname.match(/(?:problems|submit)\/([A-Z0-9_]+)/i);
              const problemCode = json.problem_code || json.problemCode || (probMatch ? probMatch[1] : 'CODECHEF');
              const lang = json.language || json.lang || 'cpp';

              interceptorLog('📢 CodeChef Accepted Submission Detected:', subId, problemCode);
              window.postMessage({
                type: 'CODESYNC_CODECHEF_ACCEPTED',
                payload: {
                  submissionId: subId,
                  problemCode,
                  lang,
                  timestamp: Math.floor(Date.now() / 1000),
                }
              }, '*');
            }
          }
        }).catch(function() {});
      }

    } catch (e) {
      // Ignore interceptor errors
    }

    return response;
  };

  // Also intercept XMLHttpRequest for legacy/AJAX support
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  (XMLHttpRequest.prototype as any).open = function(method: string, url: string | URL, ...rest: any[]) {
    (this as any)._codeSyncUrl = url;
    return (originalXHROpen as any).apply(this, [method, url, ...rest]);
  };

  (XMLHttpRequest.prototype as any).send = function(this: any, body?: any) {
    const urlStr = this._codeSyncUrl || '';
    const isGraphQL = urlStr.includes('/graphql') || urlStr.includes('leetcode.com/graphql');
    const isCheck = urlStr.includes('/check/');
    const isCodeforces = window.location.hostname.includes('codeforces.');

    if (isGraphQL || isCheck || isCodeforces) {
      this.addEventListener('load', function(this: any) {
        try {
          const json = JSON.parse(this.responseText);

          if (isCheck && json) {
            const match = urlStr.match(/submissions\/detail\/(\d+)/);
            const subId = match ? match[1] : null;
            const isAccepted = json.status_code === 10 || json.statusCode === 10 || json.status_msg === 'Accepted';
            if (subId && isAccepted) {
              window.postMessage({
                type: 'CODESYNC_JUDGING_ACCEPTED',
                payload: { submissionId: subId }
              }, '*');
            }
          }

          if (isGraphQL && json && json.data && json.data.submissionDetails) {
            const details = json.data.submissionDetails;
            if (details && details.statusCode === 10) {
              window.postMessage({
                type: 'CODESYNC_SUBMISSION_ACCEPTED',
                payload: {
                  submissionId: details.id || '',
                  code: details.code || '',
                  lang: details.lang ? details.lang.name : '',
                  runtime: details.runtime || '',
                  memory: details.memory || '',
                  timestamp: details.timestamp || Math.floor(Date.now() / 1000),
                  question: details.question || null,
                }
              }, '*');
            }
          }

          if (isCodeforces && json) {
            const verdict = json.verdict || json.status;
            if (verdict === 'OK') {
              const subId = String(json.submissionId || Date.now());
              const contestMatch = window.location.pathname.match(/(?:contest|problemset\/problem)\/(\d+)\/([A-Z0-9]+)/i);
              window.postMessage({
                type: 'CODESYNC_CODEFORCES_ACCEPTED',
                payload: {
                  submissionId: subId,
                  contestId: contestMatch ? contestMatch[1] : 'CF',
                  index: contestMatch ? contestMatch[2] : 'A',
                  timestamp: Math.floor(Date.now() / 1000),
                }
              }, '*');
            }
          }
        } catch {
          // Ignore JSON parse errors
        }
      });
    }
    return originalXHRSend.call(this, body);
  };
}
export {};
