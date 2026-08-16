/**
 * Chrome Extension API helper utilities with fallback handling for tests and non-extension environments.
 */

export function isChromeRuntimeAvailable(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
  } catch {
    return false;
  }
}

export function isChromeStorageAvailable(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
  } catch {
    return false;
  }
}

export async function getLocalStorage(keys: string | string[]): Promise<Record<string, unknown>> {
  if (isChromeStorageAvailable()) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (res) => resolve(res || {}));
    });
  }

  if (typeof localStorage !== 'undefined') {
    const result: Record<string, unknown> = {};
    const keyArray = Array.isArray(keys) ? keys : [keys];
    for (const key of keyArray) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        try {
          result[key] = JSON.parse(val);
        } catch {
          result[key] = val;
        }
      }
    }
    return result;
  }

  return {};
}

export async function setLocalStorage(items: Record<string, unknown>): Promise<void> {
  if (isChromeStorageAvailable()) {
    return new Promise((resolve) => {
      chrome.storage.local.set(items, () => resolve());
    });
  }

  if (typeof localStorage !== 'undefined') {
    for (const [k, v] of Object.entries(items)) {
      if (typeof v === 'string') {
        localStorage.setItem(k, v);
      } else {
        localStorage.setItem(k, JSON.stringify(v));
      }
    }
  }
}

export async function removeLocalStorage(keys: string | string[]): Promise<void> {
  const keyArray = Array.isArray(keys) ? keys : [keys];

  if (isChromeStorageAvailable()) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keyArray, () => resolve());
    });
  }

  if (typeof localStorage !== 'undefined') {
    keyArray.forEach((k) => localStorage.removeItem(k));
  }
}

export function sendRuntimeMessage<T = unknown>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    if (isChromeRuntimeAvailable() && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            // Non-critical fallback for closed popups/missing listeners
            resolve(undefined as unknown as T);
          } else {
            resolve(response);
          }
        });
      } catch (err) {
        reject(err);
      }
    } else {
      resolve(undefined as unknown as T);
    }
  });
}
