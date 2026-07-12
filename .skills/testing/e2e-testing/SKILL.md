---
name: e2e-testing
description: End-to-end testing strategies for Chrome extensions including Puppeteer, Playwright, and manual testing workflows for CodeSync.
---

# E2E Testing — Browser Automation & Manual Testing

## Purpose & Scope

Use this skill when writing end-to-end tests that verify the complete submission detection → GitHub push flow, or when establishing manual testing procedures.

---

## Testing Approaches

| Approach | Complexity | Coverage | Speed |
|----------|-----------|----------|-------|
| Manual Chrome testing | Low | High | Slow |
| Puppeteer + extension loading | Medium | High | Medium |
| Playwright + extension loading | Medium | High | Medium |
| Chrome DevTools Protocol | High | Medium | Fast |

---

## Implementation Patterns

### Pattern 1: Puppeteer Extension Testing

```typescript
// e2e/extension.test.ts
import puppeteer from 'puppeteer';
import path from 'path';

const EXTENSION_PATH = path.resolve(__dirname, '../dist');

async function launchWithExtension() {
  const browser = await puppeteer.launch({
    headless: false, // Extensions require headed mode
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
  });
  
  // Wait for service worker to register
  const serviceWorkerTarget = await browser.waitForTarget(
    target => target.type() === 'service_worker'
  );
  
  return { browser, serviceWorker: serviceWorkerTarget };
}

// Test: Extension loads and popup opens
async function testExtensionLoads() {
  const { browser } = await launchWithExtension();
  
  // Find the extension page
  const targets = browser.targets();
  const extensionTarget = targets.find(t => 
    t.url().includes('chrome-extension://')
  );
  
  expect(extensionTarget).toBeDefined();
  
  await browser.close();
}
```

### Pattern 2: Manual Testing Checklist

```markdown
## Manual E2E Test Procedure

### Prerequisites
- [ ] Extension built (`npm run build`)
- [ ] Extension loaded in Chrome developer mode
- [ ] GitHub token configured in settings
- [ ] Target repository selected

### Test: Submission Detection
1. Open https://leetcode.com/problems/two-sum/
2. Submit an accepted solution
3. ✓ Console shows "[CodeSync] Accepted submission detected"
4. ✓ Notification appears (queued or synced)
5. ✓ Popup shows submission in queue or synced

### Test: Manual Sync
1. Toggle instant sync OFF in settings
2. Submit an accepted solution
3. ✓ Submission appears in pending queue
4. Click "Sync Now" button in popup
5. ✓ Submission pushed to GitHub
6. ✓ Queue cleared
7. ✓ GitHub repo has new commit

### Test: Deduplication
1. Submit same problem twice with different code
2. ✓ Queue shows only one entry for the problem
3. ✓ Latest code is synced (not the older one)

### Test: Theme Switching
1. Open popup, click theme picker
2. Switch to 5 different themes
3. ✓ Colors update instantly
4. ✓ Theme persists after closing and reopening popup
```

---

## Checklists

- [ ] Extension loads without errors in Chrome
- [ ] Service worker registers and responds to alarms
- [ ] Content script injects on LeetCode pages
- [ ] Submission detection works for all GraphQL patterns
- [ ] Queue management (add, delete, clear) works
- [ ] Manual sync pushes to correct GitHub repo
- [ ] Instant sync toggle works in both states
- [ ] Theme switching persists across popup opens
- [ ] OAuth flow completes successfully
- [ ] Error states show user-friendly messages

---

## References

- [Puppeteer Extension Testing](https://pptr.dev/guides/chrome-extensions)
- [Playwright Chrome Extensions](https://playwright.dev/docs/chrome-extensions)
