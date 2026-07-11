if (!(window as any).__codeSyncInjected) {
  (window as any).__codeSyncInjected = true;

  const originalFetch = window.fetch;

  window.fetch = async function(...args) {
    const response = await originalFetch(...args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : '');
      console.log('[CodeSync:Fetch]', url);
      
      const isGraphQL = url.includes('/graphql') || url.includes('leetcode.com/graphql');
      const isCheck = url.includes('/check/');
      
      if (isGraphQL || isCheck) {
        // Clone so we don't consume the body that LeetCode needs
        const cloned = response.clone();
        cloned.json().then(function(json) {
          console.log('[CodeSync:Intercepted]', url, json);

          if (isCheck && json) {
            const match = url.match(/submissions\/detail\/(\d+)/);
            const subId = match ? match[1] : null;
            const isAccepted = json.status_code === 10 || json.statusCode === 10 || json.status_msg === 'Accepted';
            if (subId && isAccepted) {
              console.log('[CodeSync] Intercepted accepted check response. ID:', subId);
              window.postMessage({
                type: 'CODESYNC_JUDGING_ACCEPTED',
                payload: {
                  submissionId: subId,
                }
              }, '*');
            }
          }

          if (isGraphQL && json) {
            // Detect the submission check response
            // LeetCode polls this query while judging; status_id 10 = Accepted
            if (json.data && json.data.submissionDetails) {
              const details = json.data.submissionDetails;
              if (details && details.statusCode !== undefined) {
                // statusCode 10 = Accepted in LeetCode's system
                if (details.statusCode === 10) {
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
            }

            // Also handle the submission list polling approach
            if (json.data && json.data.submissionList) {
              const submissions = json.data.submissionList.submissions || [];
              for (const sub of submissions) {
                if (sub.statusDisplay === 'Accepted') {
                  window.postMessage({
                    type: 'CODESYNC_SUBMISSION_LIST_ACCEPTED',
                    payload: {
                      submissionId: sub.id,
                      lang: sub.lang || '',
                      timestamp: sub.timestamp || Math.floor(Date.now() / 1000),
                    }
                  }, '*');
                  break; // Only the latest
                }
              }
            }

            // Handle the check endpoint that LeetCode uses during judging
            if (json.data && json.data.submissionProgress) {
              const progress = json.data.submissionProgress;
              if (progress && progress.state === 'SUCCESS' && progress.statusCode === 10) {
                window.postMessage({
                  type: 'CODESYNC_JUDGING_ACCEPTED',
                  payload: {
                    submissionId: progress.submissionId || '',
                  }
                }, '*');
              }
            }
          }
        }).catch(function() {
          // Silently ignore non-JSON responses
        });
      }
    } catch(e) {
      // Never break the page
    }

    return response;
  };

  // Also intercept XMLHttpRequest for legacy support
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  (XMLHttpRequest.prototype as any).open = function(method: string, url: string | URL, ...rest: any[]) {
    (this as any)._codeSyncUrl = url;
    console.log('[CodeSync:XHR]', url);
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
          console.log('[CodeSync:Intercepted XHR]', urlStr, json);

          if (isCheck && json) {
            const match = urlStr.match(/submissions\/detail\/(\d+)/);
            const subId = match ? match[1] : null;
            const isAccepted = json.status_code === 10 || json.statusCode === 10 || json.status_msg === 'Accepted';
            if (subId && isAccepted) {
              console.log('[CodeSync] Intercepted XHR accepted check response. ID:', subId);
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
        } catch(e) {}
      });
    }
    return originalXHRSend.call(this, body);
  };

  console.log('[CodeSync] Network interceptor injected successfully.');
}
export {};
