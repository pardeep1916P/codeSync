---
name: css-architecture
description: CSS custom properties, styling structures, and theme variable mappings in CodeSync UI.
---

# CSS Architecture & Design Token Management

## Purpose & Scope
This skill outlines standard guidelines for CSS architecture, styles layouts, and design tokens used inside CodeSync. It ensures consistent UI coloring, layout structures, and high frame rates during animation.

## Decision Tree
```
Need to update styling or colors?
├─ Is it a global style?
│  ├─ Yes → Update src/styles/global.css
│  └─ No → Use CSS custom properties mapped to local components
├─ Adding a new color token?
│  ├─ Define in themes.ts (Theme interface)
│  └─ Inject into DocumentRoot using applyTheme()
└─ Adding animations?
   └─ Use standard keyframes with GPU-accelerated transition properties (transform, opacity)
```

## Implementation Patterns
### Custom Styling Layout Structure
Use standard custom HSL colors to design interfaces:
```css
:root {
  --font-mono: 'Outfit', 'Courier New', monospace;
  --transition-smooth: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.popup-container {
  background-color: var(--bg);
  color: var(--text);
  font-family: var(--font-mono);
  padding: 16px;
  display: flex;
  flex-direction: column;
}
```

## Checklists
- [ ] No hardcoded color values inside component stylesheets.
- [ ] Ensure all layout sizing fits within standard popup constraints (380px width).
- [ ] Animations use GPU-friendly properties (`transform` / `opacity`).

## References
- [MDN CSS Customs Guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [CSS Layout Best Practices](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout)
