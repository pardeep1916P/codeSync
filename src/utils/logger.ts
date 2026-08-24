/* eslint-disable @typescript-eslint/no-explicit-any */
export function logToBackground(prefix: string, ...args: any[]) {
  console.log(`[${prefix}]`, ...args);
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'LOG',
        payload: { level: 'log', prefix, args }
      }).catch(() => {});
    }
  } catch {
    // Ignore runtime messaging errors
  }
}

export function warnToBackground(prefix: string, ...args: any[]) {
  console.warn(`[${prefix}]`, ...args);
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'LOG',
        payload: { level: 'warn', prefix, args }
      }).catch(() => {});
    }
  } catch {
    // Ignore runtime messaging errors
  }
}

export function errorToBackground(prefix: string, ...args: any[]) {
  console.error(`[${prefix}]`, ...args);
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'LOG',
        payload: { level: 'error', prefix, args }
      }).catch(() => {});
    }
  } catch {
    // Ignore runtime messaging errors
  }
}
