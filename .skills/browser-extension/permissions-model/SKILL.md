---
name: permissions-model
description: Chrome extension permissions model, principle of least privilege, optional permissions, and permission justification for CodeSync.
---

# Permissions Model — Least Privilege & Runtime Requests

## Purpose & Scope

Use this skill when:
- Adding new permissions to the manifest
- Deciding between required vs optional permissions
- Implementing runtime permission requests for new platforms
- Preparing permission justification for Chrome Web Store review
- Auditing existing permissions for necessity

Do NOT use when:
- Implementing the APIs that require permissions (see `chrome-api`)
- Configuring manifest structure (see `manifest-v3`)
- Building OAuth flows (see `github/oauth-flow`)

---

## Decision Tree

```
Need a new permission?
├─ Is it an API permission (storage, alarms, etc.)?
│  ├─ Required for core functionality? → permissions[]
│  └─ Only needed for optional feature? → optional_permissions[]
├─ Is it a host permission (URL access)?
│  ├─ Required for core (leetcode.com, github.com)? → host_permissions[]
│  └─ For future platforms (GFG, HackerRank)? → optional_host_permissions[]
├─ Chrome Web Store review concerns?
│  ├─ Justify EVERY permission in a table
│  ├─ Use narrowest possible URL patterns
│  └─ Never use <all_urls> or *://*/* 
└─ User-visible impact?
   ├─ API permissions → Usually no prompt
   ├─ Host permissions → Install-time prompt
   └─ Optional permissions → Runtime prompt (better UX)
```

---

## Architecture & Concepts

### Permission Types

| Type | Manifest Field | When Prompted | Revocable | Use Case |
|------|---------------|---------------|-----------|----------|
| Required API | `permissions` | Never | No | `storage`, `alarms`, `notifications` |
| Required Host | `host_permissions` | Install | No | `api.github.com`, `leetcode.com` |
| Optional API | `optional_permissions` | Runtime | Yes | `downloads`, `bookmarks` |
| Optional Host | `optional_host_permissions` | Runtime | Yes | `geeksforgeeks.org`, `hackerrank.com` |

### CodeSync Permission Map

```
Required (Phase 1):
├── storage          → Settings, queue, submission cache
├── alarms           → Periodic queue processing
├── notifications    → Desktop sync alerts
├── tabs             → OAuth redirect handling
├── api.github.com/* → Git Trees API commits
├── leetcode.com/*   → Content script injection
└── github.com/login/oauth/* → OAuth flow

Optional (Phase 4+):
├── geeksforgeeks.org/*   → GFG content script
├── hackerrank.com/*      → HackerRank content script
├── codeforces.com/*      → Codeforces content script
└── codechef.com/*        → CodeChef content script
```

---

## Implementation Patterns

### Pattern 1: Runtime Permission Request

```typescript
// src/utils/permissions.ts

export async function requestPlatformAccess(
  platform: 'gfg' | 'hackerrank' | 'codeforces' | 'codechef'
): Promise<boolean> {
  const originMap: Record<string, string[]> = {
    gfg: ['https://www.geeksforgeeks.org/*', 'https://practice.geeksforgeeks.org/*'],
    hackerrank: ['https://www.hackerrank.com/*'],
    codeforces: ['https://codeforces.com/*'],
    codechef: ['https://www.codechef.com/*'],
  };
  
  const origins = originMap[platform];
  if (!origins) throw new Error(`Unknown platform: ${platform}`);
  
  // Check if already granted
  const hasAccess = await chrome.permissions.contains({ origins });
  if (hasAccess) return true;
  
  // Request — this shows a user prompt
  return chrome.permissions.request({ origins });
}

export async function revokePlatformAccess(
  platform: 'gfg' | 'hackerrank' | 'codeforces' | 'codechef'
): Promise<boolean> {
  const originMap: Record<string, string[]> = {
    gfg: ['https://www.geeksforgeeks.org/*', 'https://practice.geeksforgeeks.org/*'],
    hackerrank: ['https://www.hackerrank.com/*'],
    codeforces: ['https://codeforces.com/*'],
    codechef: ['https://www.codechef.com/*'],
  };
  
  return chrome.permissions.remove({ origins: originMap[platform] });
}

export async function listGrantedPermissions(): Promise<chrome.permissions.Permissions> {
  return chrome.permissions.getAll();
}
```

### Pattern 2: Permission-Gated UI

```tsx
// Show platform toggle only if permission is available or can be requested

function PlatformToggle({ platform, label }: { platform: string; label: string }) {
  const [hasAccess, setHasAccess] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  
  useEffect(() => {
    checkAccess();
  }, []);
  
  async function checkAccess() {
    const granted = await chrome.permissions.contains({
      origins: [`https://${platform}/*`]
    });
    setHasAccess(granted);
  }
  
  async function handleToggle() {
    if (hasAccess) {
      await revokePlatformAccess(platform);
      setHasAccess(false);
    } else {
      setIsRequesting(true);
      const granted = await requestPlatformAccess(platform);
      setHasAccess(granted);
      setIsRequesting(false);
    }
  }
  
  return (
    <ToggleSwitch
      id={`platform-${platform}`}
      label={label}
      description={hasAccess ? 'Connected' : 'Click to enable'}
      checked={hasAccess}
      onChange={handleToggle}
      disabled={isRequesting}
    />
  );
}
```

### Pattern 3: Permission Audit Script

```typescript
// scripts/audit-permissions.ts

import manifest from '../public/manifest.json';

const JUSTIFIED_PERMISSIONS: Record<string, string> = {
  storage: 'Store GitHub token, settings, pending queue, and submission cache',
  alarms: 'Schedule periodic queue processing (every 5 minutes)',
  notifications: 'Show desktop alerts for sync success/failure',
  tabs: 'Handle OAuth redirect and open options page',
};

const JUSTIFIED_HOSTS: Record<string, string> = {
  'https://api.github.com/*': 'Push commits via GitHub Trees API',
  'https://leetcode.com/*': 'Inject content script to detect accepted submissions',
  'https://github.com/login/oauth/*': 'Handle GitHub OAuth authorization flow',
};

function audit(): void {
  const permissions = manifest.permissions || [];
  const hosts = manifest.host_permissions || [];
  
  console.log('=== Permission Audit ===\n');
  
  // Check for unjustified permissions
  for (const perm of permissions) {
    if (JUSTIFIED_PERMISSIONS[perm]) {
      console.log(`✓ ${perm}: ${JUSTIFIED_PERMISSIONS[perm]}`);
    } else {
      console.error(`✗ ${perm}: NOT JUSTIFIED — remove or document`);
    }
  }
  
  console.log('');
  
  for (const host of hosts) {
    if (JUSTIFIED_HOSTS[host]) {
      console.log(`✓ ${host}: ${JUSTIFIED_HOSTS[host]}`);
    } else {
      console.error(`✗ ${host}: NOT JUSTIFIED — remove or document`);
    }
  }
  
  // Check for overly broad patterns
  if (hosts.includes('<all_urls>') || hosts.includes('*://*/*')) {
    console.error('\n⚠ CRITICAL: Overly broad host permissions detected!');
  }
}

audit();
```

---

## Checklists

### Permission Review Checklist

- [ ] Every permission has a documented justification
- [ ] No overly broad patterns (`<all_urls>`, `*://*/*`)
- [ ] Future platforms use `optional_host_permissions`
- [ ] Host patterns use `https://` (not `http://`)
- [ ] No unused permissions from previous features
- [ ] `activeTab` considered before full host permissions
- [ ] Chrome Web Store listing explains each permission
- [ ] Permission count minimized (fewer = faster review)

---

## Anti-Patterns

### ✗ Requesting All URLs

```json
// BAD
{ "host_permissions": ["<all_urls>"] }

// GOOD
{ "host_permissions": ["https://api.github.com/*", "https://leetcode.com/*"] }
```

### ✗ Required Permissions for Optional Features

```json
// BAD — user must grant GFG access even if they don't use it
{ "host_permissions": ["https://www.geeksforgeeks.org/*"] }

// GOOD — request at runtime only when needed
{ "optional_host_permissions": ["https://www.geeksforgeeks.org/*"] }
```

---

## References

- [Declare Permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Optional Permissions](https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings)
- [chrome.permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- [Permission Warnings](https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings)
