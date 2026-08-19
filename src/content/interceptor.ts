/* eslint-disable @typescript-eslint/no-explicit-any */
if (!(window as any).__codeSyncInjected) {
  (window as any).__codeSyncInjected = true;

  const originalFetch = window.fetch;

  window.fetch = async function(...args) {
    const response = await originalFetch(...args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : '');
      const isGraphQL = url.includes('/graphql') || url.includes('leetcode.com/graphql');
      const isCheck = url.includes('/check/');
      
      if (isGraphQL || isCheck) {
        // Clone so we don't consume the body that LeetCode needs
        const cloned = response.clone();
        cloned.json().then(function(json) {

          if (isCheck && json) {
            const match = url.match(/submissions\/detail\/(\d+)/);
            const subId = match ? match[1] : null;
            const isAccepted = json.status_code === 10 || json.statusCode === 10 || json.status_msg === 'Accepted';
            if (subId && isAccepted) {
              (window as any).__codeSyncRecentJudgeId = subId;
              (window as any).__codeSyncRecentJudgeTime = Date.now();
              window.postMessage({
                type: 'CODESYNC_JUDGING_ACCEPTED',
                payload: {
                  submissionId: subId,
                }
              }, '*');
            }
          }

          if (isGraphQL && json) {
            // Handle the check endpoint that LeetCode uses during judging
            if (json.data && json.data.submissionProgress) {
              const progress = json.data.submissionProgress;
              if (progress && progress.state === 'SUCCESS' && progress.statusCode === 10) {
                const subId = String(progress.submissionId || '');
                if (subId) {
                  (window as any).__codeSyncRecentJudgeId = subId;
                  (window as any).__codeSyncRecentJudgeTime = Date.now();
                  window.postMessage({
                    type: 'CODESYNC_JUDGING_ACCEPTED',
                    payload: {
                      submissionId: subId,
                    }
                  }, '*');
                }
              }
            }

            // Detect submissionDetails
            if (json.data && json.data.submissionDetails) {
              const details = json.data.submissionDetails;
              if (details && details.statusCode !== undefined) {
                if (details.statusCode === 10) {
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
            }

            // Handle submission list view
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
        }).catch(function() {
          // Ignore JSON parse errors
        });
      }
    } catch (e) {
      // Ignore interceptor errors
    }

    return response;
  };

  // Also intercept XMLHttpRequest for legacy support
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

    if (isGraphQL || isCheck) {
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
                payload: {
                  submissionId: subId,
                }
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
        } catch {
          // Ignore JSON parse errors
        }
      });
    }
    return originalXHRSend.call(this, body);
  };

  // Injected successfully
}
export {};
