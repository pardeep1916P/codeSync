/**
 * Get the current extension version dynamically from manifest
 */
export function getExtensionVersion(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    try {
      const manifest = chrome.runtime.getManifest();
      return manifest.version || '1.1.1';
    } catch {
      return '1.1.1';
    }
  }
  return '1.1.1';
}
