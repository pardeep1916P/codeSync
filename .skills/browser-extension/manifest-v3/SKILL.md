---
name: manifest-v3
description: Manifest V3 configuration, permissions, and best practices for the CodeSync Chrome extension.
---

# Manifest V3 — Configuration & Best Practices

## Purpose & Scope

Use this skill when:
- Creating or modifying `manifest.json` for the CodeSync extension
- Adding new permissions, content scripts, or background workers
- Debugging extension loading errors caused by manifest misconfiguration
- Migrating from Manifest V2 patterns to V3
- Reviewing Chrome Web Store compliance requirements

Do NOT use when:
- Writing business logic inside background/content scripts (see `background-service-worker`, `content-scripts`)
- Configuring Vite build output (see `bundle-optimization`)
- Working on GitHub API integration (see `github/trees-api`)

---

## Decision Tree

```
Need to change manifest.json?
├─ Adding a new permission?
│  ├─ Is it a host permission? → Add to "host_permissions"
│  ├─ Is it an API permission? → Add to "permissions"
│  └─ Is it optional? → Add to "optional_permissions"
├─ Adding a new page?
│  ├─ Popup? → Update "action.default_popup"
│  ├─ Options? → Update "options_ui.page"
│  └─ Background? → Update "background.service_worker"
├─ Adding a content script?
│  ├─ Static injection? → Add to "content_scripts" array
│  └─ Dynamic injection? → Use chrome.scripting.registerContentScripts()
├─ Changing icons?
│  └─ Provide 16, 32, 48, 128 PNG sizes in "icons"
└─ Debugging load errors?
   ├─ "Invalid value for 'background'" → Must use service_worker, not scripts
   ├─ "Permission X is unknown" → Check spelling, check MV3 support
   └─ "Could not load manifest" → Validate JSON syntax
```

---

## Architecture & Concepts

### CodeSync Manifest Structure

The CodeSync extension uses a Manifest V3 configuration with the following key sections:

```
manifest.json
├── metadata (name, version, description, manifest_version)
├── permissions (storage, alarms, notifications, tabs)
├── host_permissions (github.com, leetcode.com)
├── background (service_worker → dist/background.js)
├── content_scripts (matches leetcode.com → dist/content.js)
├── action (popup → dist/src/popup/index.html)
├── options_ui (page → dist/src/options/index.html)
├── icons (16, 32, 48, 128)
└── web_accessible_resources (fonts, images)
```

### Permission Categories in MV3

| Category | Field | User Prompt | Example |
|----------|-------|-------------|---------|
| Required API | `permissions` | No | `storage`, `alarms`, `notifications` |
| Required Host | `host_permissions` | Yes (install) | `https://api.github.com/*` |
| Optional API | `optional_permissions` | On demand | `downloads` |
| Optional Host | `optional_host_permissions` | On demand | `https://*.geeksforgeeks.org/*` |
| Content Script | `content_scripts[].matches` | No | `https://leetcode.com/*` |

### MV3 vs MV2 Key Differences

| Feature | MV2 | MV3 (CodeSync) |
|---------|-----|-----------------|
| Background | Persistent page | Service worker (event-driven) |
| Remote code | `<script src="remote">` | Forbidden — bundle everything |
| Content Security | Loose CSP | Strict CSP, no `eval()` |
| Network intercept | `webRequest.onBeforeRequest` | `declarativeNetRequest` (limited) |
| Host permissions | Inside `permissions` | Separate `host_permissions` |
| Action | `browser_action` / `page_action` | Unified `action` |

---

## Implementation Patterns

### Pattern 1: CodeSync Production Manifest

```json
{
  "manifest_version": 3,
  "name": "CodeSync",
  "version": "1.0.0",
  "description": "Automatically sync your accepted LeetCode solutions to GitHub",
  
  "permissions": [
    "storage",
    "alarms",
    "notifications",
    "tabs"
  ],
  
  "host_permissions": [
    "https://api.github.com/*",
    "https://leetcode.com/*",
    "https://github.com/login/oauth/*"
  ],
  
  "background": {
    "service_worker": "dist/background.js",
    "type": "module"
  },
  
  "content_scripts": [
    {
      "matches": ["https://leetcode.com/*"],
      "js": ["dist/content.js"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],
  
  "action": {
    "default_popup": "dist/src/popup/index.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    },
    "default_title": "CodeSync"
  },
  
  "options_ui": {
    "page": "dist/src/options/index.html",
    "open_in_tab": true
  },
  
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  
  "web_accessible_resources": [
    {
      "resources": ["fonts/*", "images/*"],
      "matches": ["https://leetcode.com/*"]
    }
  ]
}
```

### Pattern 2: Adding a New Platform (Phase 4+ Preparation)

When adding GeeksforGeeks, HackerRank, or other platforms:

```json
{
  "content_scripts": [
    {
      "matches": ["https://leetcode.com/*"],
      "js": ["dist/content.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://www.geeksforgeeks.org/*"],
      "js": ["dist/content-gfg.js"],
      "run_at": "document_idle"
    }
  ],
  
  "optional_host_permissions": [
    "https://www.geeksforgeeks.org/*",
    "https://www.hackerrank.com/*",
    "https://codeforces.com/*",
    "https://www.codechef.com/*"
  ]
}
```

**Why optional?** Platforms beyond LeetCode should use `optional_host_permissions` so:
1. Users only grant access to platforms they use
2. Chrome Web Store review is simpler
3. Permission prompts are contextual, not upfront

```typescript
// Requesting optional permission at runtime
async function requestGfgAccess(): Promise<boolean> {
  return chrome.permissions.request({
    origins: ['https://www.geeksforgeeks.org/*']
  });
}

// Checking if permission is granted
async function hasGfgAccess(): Promise<boolean> {
  return chrome.permissions.contains({
    origins: ['https://www.geeksforgeeks.org/*']
  });
}
```

### Pattern 3: Content Script World Configuration

CodeSync uses MAIN world injection to intercept `fetch`/`XHR`:

```json
{
  "content_scripts": [
    {
      "matches": ["https://leetcode.com/*"],
      "js": ["dist/content.js"],
      "run_at": "document_idle",
      "world": "ISOLATED"
    }
  ]
}
```

The ISOLATED world script then programmatically injects a MAIN world script:

```typescript
// In content script (ISOLATED world)
const script = document.createElement('script');
script.src = chrome.runtime.getURL('dist/page-script.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);
```

If using `chrome.scripting` for dynamic registration:

```typescript
// In background service worker
chrome.scripting.registerContentScripts([{
  id: 'leetcode-interceptor',
  matches: ['https://leetcode.com/*'],
  js: ['dist/page-interceptor.js'],
  runAt: 'document_start',
  world: 'MAIN'
}]);
```

### Pattern 4: Version Bumping Strategy

```typescript
// scripts/bump-version.ts
import fs from 'fs';

type BumpType = 'patch' | 'minor' | 'major';

function bumpVersion(type: BumpType): void {
  const manifest = JSON.parse(fs.readFileSync('public/manifest.json', 'utf-8'));
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  
  const [major, minor, patch] = manifest.version.split('.').map(Number);
  
  const newVersion = {
    major: `${major + 1}.0.0`,
    minor: `${major}.${minor + 1}.0`,
    patch: `${major}.${minor}.${patch + 1}`,
  }[type];
  
  manifest.version = newVersion;
  pkg.version = newVersion;
  
  fs.writeFileSync('public/manifest.json', JSON.stringify(manifest, null, 2));
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
  
  console.log(`Bumped version to ${newVersion}`);
}

bumpVersion(process.argv[2] as BumpType || 'patch');
```

---

## Templates

### Template: Minimal MV3 Manifest for New Extension

```json
{
  "manifest_version": 3,
  "name": "Extension Name",
  "version": "0.1.0",
  "description": "Brief description",
  "permissions": ["storage"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

### Template: CodeSync Manifest Validation Script

```typescript
// scripts/validate-manifest.ts
import fs from 'fs';

interface ManifestV3 {
  manifest_version: number;
  name: string;
  version: string;
  permissions?: string[];
  host_permissions?: string[];
  background?: { service_worker: string; type?: string };
  content_scripts?: Array<{
    matches: string[];
    js: string[];
    run_at?: string;
    world?: string;
  }>;
  action?: {
    default_popup?: string;
    default_icon?: Record<string, string>;
  };
}

const REQUIRED_PERMISSIONS = ['storage', 'alarms', 'notifications'];
const REQUIRED_HOSTS = ['https://api.github.com/*', 'https://leetcode.com/*'];

function validate(): void {
  const manifest: ManifestV3 = JSON.parse(
    fs.readFileSync('public/manifest.json', 'utf-8')
  );
  
  const errors: string[] = [];
  
  // Check manifest version
  if (manifest.manifest_version !== 3) {
    errors.push('manifest_version must be 3');
  }
  
  // Check required permissions
  for (const perm of REQUIRED_PERMISSIONS) {
    if (!manifest.permissions?.includes(perm)) {
      errors.push(`Missing required permission: ${perm}`);
    }
  }
  
  // Check host permissions
  for (const host of REQUIRED_HOSTS) {
    if (!manifest.host_permissions?.includes(host)) {
      errors.push(`Missing required host_permission: ${host}`);
    }
  }
  
  // Check service worker
  if (!manifest.background?.service_worker) {
    errors.push('Missing background.service_worker');
  }
  
  // Check version format
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    errors.push(`Invalid version format: ${manifest.version} (expected X.Y.Z)`);
  }
  
  // Check content scripts target LeetCode
  const lcScript = manifest.content_scripts?.find(cs =>
    cs.matches.some(m => m.includes('leetcode.com'))
  );
  if (!lcScript) {
    errors.push('No content script targeting leetcode.com');
  }
  
  if (errors.length > 0) {
    console.error('Manifest validation failed:');
    errors.forEach(e => console.error(`  ✗ ${e}`));
    process.exit(1);
  } else {
    console.log('✓ Manifest validation passed');
  }
}

validate();
```

---

## Checklists

### Pre-Release Manifest Checklist

- [ ] `manifest_version` is `3`
- [ ] `version` matches `package.json` version
- [ ] `name` is "CodeSync" (≤45 characters)
- [ ] `description` is present (≤132 characters for Chrome Web Store)
- [ ] All required permissions are listed and justified
- [ ] No unnecessary permissions (principle of least privilege)
- [ ] `host_permissions` only includes domains actually used
- [ ] `background.service_worker` points to correct built file
- [ ] `content_scripts` matches patterns are correct and minimal
- [ ] Icons exist at all declared sizes (16, 32, 48, 128)
- [ ] `options_ui.page` points to correct built file
- [ ] `action.default_popup` points to correct built file
- [ ] `web_accessible_resources` only exposes necessary files
- [ ] No `"type": "module"` if targeting older Chrome versions (<92)
- [ ] JSON is valid (no trailing commas, no comments)

### Permission Justification Table

| Permission | Why CodeSync Needs It | User Impact |
|-----------|----------------------|-------------|
| `storage` | Store GitHub token, settings, pending queue | None (no prompt) |
| `alarms` | Periodic queue processing timer | None (no prompt) |
| `notifications` | Desktop alerts for sync success/failure | None (no prompt) |
| `tabs` | OAuth redirect tab management | None (no prompt) |
| `api.github.com` | Push commits via GitHub Trees API | Install prompt |
| `leetcode.com` | Inject content script to detect submissions | Install prompt |

---

## Anti-Patterns

### ✗ Requesting Overly Broad Host Permissions

```json
// BAD — requests access to ALL websites
{
  "host_permissions": ["<all_urls>"]
}

// GOOD — only the domains CodeSync actually uses
{
  "host_permissions": [
    "https://api.github.com/*",
    "https://leetcode.com/*"
  ]
}
```

### ✗ Using Persistent Background Pages

```json
// BAD — MV2 pattern, not allowed in MV3
{
  "background": {
    "scripts": ["background.js"],
    "persistent": true
  }
}

// GOOD — MV3 service worker
{
  "background": {
    "service_worker": "dist/background.js"
  }
}
```

### ✗ Hardcoding Version Strings

```json
// BAD — version only in manifest, package.json out of sync
{ "version": "1.2.3" }

// GOOD — use a build script to sync versions
// See "Version Bumping Strategy" pattern above
```

### ✗ Exposing Internal Resources Globally

```json
// BAD — all pages can access your bundled resources
{
  "web_accessible_resources": [{
    "resources": ["*"],
    "matches": ["<all_urls>"]
  }]
}

// GOOD — only expose what's needed, only to relevant origins
{
  "web_accessible_resources": [{
    "resources": ["dist/page-interceptor.js"],
    "matches": ["https://leetcode.com/*"]
  }]
}
```

---

## Troubleshooting Guide

| Error | Cause | Fix |
|-------|-------|-----|
| `Could not load manifest` | Invalid JSON syntax | Use `jsonlint` or VS Code JSON validation |
| `Invalid value for 'background'` | Using MV2 `scripts` array | Change to `service_worker` (single string) |
| `Permission 'X' is unknown or URL pattern is malformed` | Typo in permission name or invalid URL pattern | Check [Chrome permissions list](https://developer.chrome.com/docs/extensions/reference/permissions-list) |
| `content_scripts[0].matches pattern is invalid` | Missing scheme or wildcard | Ensure format: `https://example.com/*` |
| `Service worker registration failed` | File path wrong or file missing | Verify `dist/background.js` exists after build |
| `Popup not showing` | Wrong path in `action.default_popup` | Verify the HTML file path relative to manifest |
| `Icons not loading` | Wrong file paths or missing files | Provide all four sizes as PNG files |
| Extension loads but no content script runs | `matches` pattern doesn't match current URL | Test pattern against actual LeetCode URLs |
| `Cannot access chrome.storage` in content script | Missing `storage` permission | Add `"storage"` to `permissions` array |

---

## References

- [Chrome MV3 Overview](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Manifest File Format](https://developer.chrome.com/docs/extensions/reference/manifest)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/develop/migrate)
- [Permissions Reference](https://developer.chrome.com/docs/extensions/reference/permissions-list)
- [Content Scripts Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Chrome Web Store Requirements](https://developer.chrome.com/docs/webstore/program-policies)
