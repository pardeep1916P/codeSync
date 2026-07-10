import { CommitQueue } from '../queue';
import { Submission } from '../parser/types';

const queue = new CommitQueue();

// Listen for runtime extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('CodeSync extension installed.');
  
  // Set up an alarm to process the queue periodically (every 5 minutes)
  chrome.alarms.create('process-queue-alarm', { periodInMinutes: 5 });
});

// Listen for alarm triggers
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'process-queue-alarm') {
    console.log('Alarm triggered: processing queue...');
    queue.processQueue().catch(console.error);
  }
});

// Listen for messages from content scripts or UI panels
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'ENQUEUE_SUBMISSION') {
    const submission = message.payload as Submission;
    console.log('Received submission from content script:', submission);
    
    queue.enqueue(submission)
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        console.error('Failed to enqueue submission:', err);
        sendResponse({ success: false, error: err.message });
      });
    
    return true; // Keep message port open for async response
  }

  if (message.action === 'TRIGGER_SYNC') {
    queue.processQueue()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    
    return true;
  }
});
