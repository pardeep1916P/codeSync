---
name: bundle-optimization
description: Optimization techniques for reducing bundle size, configuring Vite chunk splits, and tree shaking CodeSync build output.
---

# Bundle Optimization

## Purpose & Scope
Outlines steps to minimize build output, manage chunk divisions in Vite, and ensure efficient asset sizes for Chrome runtime efficiency.

## Implementation Patterns
### Vite Chunk Configuration
`	ypescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor'; // Split external dependencies
          }
        }
      }
    }
  }
});
`

## Checklists
- [ ] Run 
pm run build and review artifact sizes.
- [ ] Ensure dist/background.js and dist/content.js contain zero unused library imports.
- [ ] Keep package dependencies minimal to reduce extension disk footprint.
