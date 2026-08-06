import { CommitQueue } from '../queue';
import { Submission } from '../parser/types';
import { storage } from '../storage';

const queue = new CommitQueue();

// Listen for runtime extension installation
chrome.runtime.onInstalled.addListener(async () => {
  
  // Set up an alarm to process the queue periodically (every 5 minutes)
  chrome.alarms.create('process-queue-alarm', { periodInMinutes: 5 });

  // Programmatically inject content script into all active LeetCode tabs
  try {
    const tabs = await chrome.tabs.query({
      url: [
        '*://*.leetcode.com/*',
        '*://leetcode.com/*',
        '*://*.leetcode.cn/*',
        '*://leetcode.cn/*'
      ]
    });
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).catch(() => {
          // Silent catch
        });
      }
    }
  } catch (err) {
    // Silent catch
  }
});

// Listen for alarm triggers
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'process-queue-alarm') {
    storage.getSettings().then((settings) => {
      if (settings.syncOnAccept) {
        queue.processQueue().catch(() => {});
      }
    }).catch(() => {});
  }
});

// Listen for messages from content scripts or UI panels
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'ENQUEUE_SUBMISSION') {
    const submission = message.payload as Submission;
    
    queue.enqueue(submission)
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
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

  return false;
});
