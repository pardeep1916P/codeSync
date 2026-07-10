import { getAdapterForUrl } from '../parser';

async function initContentScript() {
  console.log('CodeSync content script active on this page.');
  
  const adapter = getAdapterForUrl(window.location.href);
  if (!adapter) {
    console.log('No CodeSync adapter found for this platform.');
    return;
  }

  console.log(`Matched adapter: ${adapter.platformName}. Setting up listener.`);

  // Periodically check if a submission has been made and succeeded.
  // In a robust implementation, a MutationObserver or web request interception can be used.
  setInterval(async () => {
    try {
      const submission = await adapter.detectSubmission();
      if (submission) {
        console.log('Detected accepted submission:', submission);
        
        // Notify the background script to enqueue this submission
        chrome.runtime.sendMessage({
          action: 'ENQUEUE_SUBMISSION',
          payload: submission
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending message to background script:', chrome.runtime.lastError);
            return;
          }
          if (response?.success) {
            console.log('Submission enqueued successfully.');
          } else {
            console.error('Failed to enqueue submission:', response?.error);
          }
        });
      }
    } catch (error) {
      console.error('Error checking for accepted submissions:', error);
    }
  }, 3000); // Check every 3 seconds when submission panel is active
}

// Start the content script
initContentScript().catch(console.error);
