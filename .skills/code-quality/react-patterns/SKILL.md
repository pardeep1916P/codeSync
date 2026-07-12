---
name: react-patterns
description: React component patterns, state hooks, custom wrappers, and popup optimization strategies in CodeSync.
---

# React Patterns

## Purpose & Scope
Details React standards for build component architectures, hook separations, and UI design rules.

## Implementation Patterns
### Custom Hook for Chrome Settings
`	ypescript
import { useState, useEffect } from 'react';
import { storage, Settings } from '../storage';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  
  useEffect(() => {
    storage.getSettings().then(setSettings);
    
    const handler = (changes: any) => {
      if (changes.settings) {
        setSettings(changes.settings.newValue);
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);
  
  return settings;
}
`

## Checklists
- [ ] Reusable UI components stored inside src/popup/components/.
- [ ] State-bound side effects must always include cleanups.
