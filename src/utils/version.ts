/**
 * Get the current extension version dynamically from manifest
 */
export function getExtensionVersion(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    try {
      const manifest = chrome.runtime.getManifest();
      return manifest.version || '1.3.0';
    } catch {
      return '1.3.0';
    }
  }
  return '1.3.0';
}
