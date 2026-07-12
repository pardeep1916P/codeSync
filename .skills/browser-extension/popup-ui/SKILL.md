---
name: popup-ui
description: Extension popup and options page UI architecture, React component patterns, state management, and theme system for the CodeSync Chrome extension.
---

# Popup UI — React Architecture, Themes & Component Design

## Purpose & Scope

Use this skill when:
- Building or modifying the popup dashboard or options page UI
- Creating React components for the extension popup
- Implementing the theme system and CSS custom properties
- Managing state between popup opens (Zustand + chrome.storage)
- Adding toast notifications, modals, or interactive UI elements

Do NOT use when:
- Working on background service worker logic (see `background-service-worker`)
- Implementing storage persistence (see `extension-storage`)
- Building content script interceptors (see `content-scripts`)

---

## Decision Tree

```
Working on extension UI?
├─ Which page?
│  ├─ Popup (action popup) → src/popup/
│  │  ├─ Dashboard stats → Popup.tsx
│  │  ├─ Pending queue list → QueuePanel component
│  │  ├─ Sync controls → SyncButton component
│  │  └─ Theme switcher → ThemePicker component
│  └─ Options (full page) → src/options/
│     ├─ GitHub auth → TokenInput / OAuthButton
│     ├─ Repo selection → RepoSelector component
│     ├─ Sync toggle → ToggleSwitch component
│     └─ Folder structure → FolderConfig component
├─ Need persistent state?
│  ├─ Survives popup close? → Zustand + chrome.storage sync
│  └─ Popup-only? → React useState
├─ Adding a theme?
│  └─ Add to themes.ts, extend Theme interface
├─ Adding a toast?
│  └─ Use useMessageListener + toast state
└─ Performance concern?
   ├─ Popup opens slowly? → Two-phase cached loading
   └─ Re-renders? → React.memo + useCallback
```

---

## Architecture & Concepts

### Popup Architecture

```
src/popup/
├── index.html          ← Entry point referenced in manifest
├── main.tsx            ← React root mount
├── Popup.tsx           ← Main dashboard component
└── components/
    ├── Header.tsx       ← Title, user avatar, theme picker
    ├── QueuePanel.tsx   ← Pending submissions list
    ├── StatsCard.tsx    ← Total synced, streak, etc.
    ├── SyncButton.tsx   ← Manual sync trigger
    ├── ThemePicker.tsx  ← Theme dropdown/grid
    └── Toast.tsx        ← Success/error notification

src/options/
├── index.html          ← Entry point referenced in manifest
├── main.tsx            ← React root mount
├── Options.tsx         ← Full settings page
└── components/
    ├── TokenInput.tsx   ← GitHub PAT input
    ├── OAuthButton.tsx  ← OAuth login button
    ├── RepoSelector.tsx ← Repository dropdown
    ├── ToggleSwitch.tsx ← Sync on accept toggle
    └── FolderConfig.tsx ← Folder structure picker
```

### State Management Architecture

```
┌──────────────────────────────────────────────┐
│                 Zustand Store                  │
│                                                │
│  ┌────────────────┐  ┌─────────────────────┐  │
│  │ UI State       │  │ Persisted State      │  │
│  │ (popup only)   │  │ (chrome.storage)     │  │
│  │                │  │                       │  │
│  │ • isLoading    │  │ • settings            │  │
│  │ • activeTab    │  │ • user                │  │
│  │ • toastQueue   │  │ • repos               │  │
│  │ • isRefreshing │  │ • commitQueue         │  │
│  └────────────────┘  └─────────────────────┘  │
│                                                │
│  initialize() → Phase 1: cached load (instant) │
│               → Phase 2: API refresh (silent)  │
└──────────────────────────────────────────────┘
```

### Theme System Architecture

```
themes.ts exports:
├── Theme interface (all CSS token properties)
├── THEMES: Theme[] (15+ theme definitions)
├── getTheme(id: string): Theme
└── applyTheme(theme: Theme): void (sets CSS custom properties)

CSS Custom Properties (set on :root):
├── --bg, --bg-secondary, --bg-tertiary
├── --text, --text-secondary, --text-muted
├── --accent, --accent-hover
├── --border, --border-hover
├── --success, --error, --warning
├── --card-bg, --card-border
└── --font-mono
```

---

## Implementation Patterns

### Pattern 1: Popup Component with Instant Loading

```tsx
// src/popup/Popup.tsx

import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';
import { Header } from './components/Header';
import { QueuePanel } from './components/QueuePanel';
import { StatsCard } from './components/StatsCard';
import { SyncButton } from './components/SyncButton';
import { Toast } from './components/Toast';

export function Popup() {
  const {
    settings, user, repos, isLoading, isRefreshing,
    initialize, refreshQueue,
  } = useStore();
  
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
  
  // Phase 1 + 2 initialization
  useEffect(() => {
    initialize();
  }, []);
  
  // Listen for background messages
  useEffect(() => {
    const handler = (message: any) => {
      switch (message.action) {
        case 'SYNC_SUCCESS':
          setToast({ type: 'success', message: `Synced "${message.payload.problemTitle}"` });
          refreshQueue();
          break;
        case 'SYNC_FAILED':
          setToast({ type: 'error', message: `Failed: ${message.payload.error}` });
          break;
        case 'SUBMISSION_QUEUED':
          refreshQueue();
          break;
      }
    };
    
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [refreshQueue]);
  
  // Apply theme on load and change
  useEffect(() => {
    if (settings.theme) {
      applyTheme(getTheme(settings.theme));
    }
  }, [settings.theme]);
  
  if (isLoading) {
    return <div className="popup-loading">Loading...</div>;
  }
  
  const isConfigured = settings.githubToken && settings.selectedRepo;
  
  return (
    <div className="popup-container">
      <Header
        user={user}
        isRefreshing={isRefreshing}
        theme={settings.theme}
        onThemeChange={handleThemeChange}
      />
      
      {!isConfigured ? (
        <SetupPrompt />
      ) : (
        <>
          <StatsCard settings={settings} />
          <QueuePanel
            queue={settings.commitQueue}
            onDelete={handleDeleteItem}
            onClear={handleClearQueue}
          />
          <SyncButton
            pending={settings.commitQueue.length}
            onSync={handleManualSync}
          />
        </>
      )}
      
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
```

### Pattern 2: Theme System Implementation

```typescript
// src/styles/themes.ts

export interface Theme {
  id: string;
  name: string;
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  border: string;
  borderHover: string;
  success: string;
  error: string;
  warning: string;
  cardBg: string;
  cardBorder: string;
}

export const THEMES: Theme[] = [
  {
    id: 'amoled',
    name: 'AMOLED',
    bg: '#000000',
    bgSecondary: '#0a0a0a',
    bgTertiary: '#141414',
    text: '#ffffff',
    textSecondary: '#a0a0a0',
    textMuted: '#666666',
    accent: '#10b981',
    accentHover: '#34d399',
    border: '#1a1a1a',
    borderHover: '#333333',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    cardBg: '#0a0a0a',
    cardBorder: '#1e1e1e',
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin Mocha',
    bg: '#1e1e2e',
    bgSecondary: '#181825',
    bgTertiary: '#11111b',
    text: '#cdd6f4',
    textSecondary: '#a6adc8',
    textMuted: '#585b70',
    accent: '#cba6f7',
    accentHover: '#b4befe',
    border: '#313244',
    borderHover: '#45475a',
    success: '#a6e3a1',
    error: '#f38ba8',
    warning: '#fab387',
    cardBg: '#181825',
    cardBorder: '#313244',
  },
  // ... 13+ more themes
];

export function getTheme(id: string): Theme {
  return THEMES.find(t => t.id === id) || THEMES[0];
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  
  root.style.setProperty('--bg', theme.bg);
  root.style.setProperty('--bg-secondary', theme.bgSecondary);
  root.style.setProperty('--bg-tertiary', theme.bgTertiary);
  root.style.setProperty('--text', theme.text);
  root.style.setProperty('--text-secondary', theme.textSecondary);
  root.style.setProperty('--text-muted', theme.textMuted);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-hover', theme.accentHover);
  root.style.setProperty('--border', theme.border);
  root.style.setProperty('--border-hover', theme.borderHover);
  root.style.setProperty('--success', theme.success);
  root.style.setProperty('--error', theme.error);
  root.style.setProperty('--warning', theme.warning);
  root.style.setProperty('--card-bg', theme.cardBg);
  root.style.setProperty('--card-border', theme.cardBorder);
}
```

### Pattern 3: Toggle Switch Component

```tsx
// src/options/components/ToggleSwitch.tsx

interface ToggleSwitchProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleSwitch({
  id, label, description, checked, onChange, disabled
}: ToggleSwitchProps) {
  return (
    <div className="toggle-row">
      <div className="toggle-info">
        <span className="toggle-label">{label}</span>
        {description && (
          <span className="toggle-description">{description}</span>
        )}
      </div>
      
      {/* CRITICAL: Use <label> wrapping <input> for clickability */}
      <label htmlFor={id} className="toggle-track">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="toggle-input"
        />
        <span className="toggle-slider" />
      </label>
    </div>
  );
}
```

```css
/* Toggle switch styles */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-track {
  position: relative;
  width: 44px;
  height: 24px;
  cursor: pointer;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--border);
  border-radius: 24px;
  transition: background 0.2s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.toggle-input:checked + .toggle-slider {
  background: var(--accent);
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(20px);
}
```

### Pattern 4: Queue Panel with Delete Actions

```tsx
// src/popup/components/QueuePanel.tsx

interface QueuePanelProps {
  queue: string[];
  submissions: Map<string, SubmissionData>;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export function QueuePanel({ queue, submissions, onDelete, onClear }: QueuePanelProps) {
  if (queue.length === 0) {
    return (
      <div className="queue-empty">
        <span className="queue-empty-icon">✓</span>
        <span>No pending submissions</span>
      </div>
    );
  }
  
  return (
    <div className="queue-panel">
      <div className="queue-header">
        <span className="queue-title">Pending Queue ({queue.length})</span>
        <button
          className="queue-clear-btn"
          onClick={onClear}
          title="Clear all pending submissions"
        >
          Clear All
        </button>
      </div>
      
      <div className="queue-list">
        {queue.map((id) => {
          const sub = submissions.get(id);
          return (
            <div key={id} className="queue-item">
              <div className="queue-item-info">
                <span className="queue-item-title">
                  {sub?.problem.title || `Submission ${id}`}
                </span>
                <span className="queue-item-meta">
                  {sub?.language} • {sub?.problem.difficulty}
                </span>
              </div>
              <button
                className="queue-item-delete"
                onClick={() => onDelete(id)}
                title="Remove from queue"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Pattern 5: Toast Notification Component

```tsx
// src/popup/components/Toast.tsx

import { useEffect, useState } from 'react';

interface ToastProps {
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
  onClose: () => void;
}

export function Toast({ type, message, duration = 4000, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300); // Wait for exit animation
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration, onClose]);
  
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  };
  
  return (
    <div className={`toast toast-${type} ${isExiting ? 'toast-exit' : 'toast-enter'}`}>
      <span className="toast-icon">{icons[type]}</span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose}>✕</button>
    </div>
  );
}
```

```css
.toast {
  position: fixed;
  bottom: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.toast-success { background: var(--success); color: #000; }
.toast-error { background: var(--error); color: #fff; }
.toast-info { background: var(--accent); color: #fff; }

.toast-enter {
  animation: slideUp 0.3s ease-out;
}

.toast-exit {
  animation: slideDown 0.3s ease-in forwards;
}

@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes slideDown {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(100%); opacity: 0; }
}
```

---

## Templates

### Template: Popup Page Size Configuration

```css
/* Popup dimensions — Chrome enforces max 800x600 */
body {
  width: 380px;
  min-height: 500px;
  max-height: 600px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: 'Outfit', system-ui, sans-serif;
}
```

---

## Checklists

### Popup UI Development Checklist

- [ ] Two-phase loading eliminates spinner flash
- [ ] Theme applied on initial render
- [ ] Message listener cleaned up on unmount
- [ ] Toast auto-dismisses with exit animation
- [ ] Queue panel updates in real-time on SUBMISSION_QUEUED
- [ ] Delete/clear actions update both storage and UI
- [ ] Toggle switch uses `<label>` wrapping for accessibility
- [ ] Popup dimensions fit within 800x600 Chrome limit
- [ ] All interactive elements have unique IDs
- [ ] Tab/keyboard navigation works
- [ ] Loading state shown during API calls
- [ ] Error states handled gracefully (not blank screen)

---

## Anti-Patterns

### ✗ Not Cleaning Up Listeners on Unmount

```tsx
// BAD — listener leaks on every popup open
useEffect(() => {
  chrome.runtime.onMessage.addListener(handler);
  // No cleanup!
}, []);

// GOOD
useEffect(() => {
  chrome.runtime.onMessage.addListener(handler);
  return () => chrome.runtime.onMessage.removeListener(handler);
}, []);
```

### ✗ Blocking Render on API Calls

```tsx
// BAD — popup shows spinner while fetching from GitHub
useEffect(() => {
  setLoading(true);
  fetchFromGitHub().then(data => {
    setData(data);
    setLoading(false);
  });
}, []);

// GOOD — show cached data instantly, refresh silently
useEffect(() => {
  // Phase 1: instant
  loadFromCache().then(cached => {
    setData(cached);
    setLoading(false);
  });
  // Phase 2: background
  fetchFromGitHub().then(fresh => setData(fresh));
}, []);
```

---

## Troubleshooting Guide

| Symptom | Cause | Fix |
|---------|-------|-----|
| Popup flashes/reloads on every open | Not using cached state | Implement two-phase loading |
| Toggle doesn't respond to clicks | Not wrapped in `<label>` | Use `<label htmlFor>` wrapping |
| Theme not applied | CSS custom properties not set | Call `applyTheme()` in useEffect |
| Toast appears behind other elements | Low z-index | Set `z-index: 1000` on toast |
| Popup is too large/scrolls horizontally | Width > 800px | Set `width: 380px` on body |

---

## References

- [Extension Popup Guide](https://developer.chrome.com/docs/extensions/develop/ui/add-popup)
- [Options Page Guide](https://developer.chrome.com/docs/extensions/develop/ui/options-page)
- [React 18 Documentation](https://react.dev)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
