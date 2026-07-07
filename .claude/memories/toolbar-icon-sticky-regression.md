---
name: toolbar-icon-sticky-regression
description: Icons missing/blank and sticky header stopped working after UX polish sprint
metadata:
  type: feedback
---

Two regressions introduced during UX polish (commit c69ccfa):

1. **Icons render as missing/blank**: Back button shows "-" text, save/export icons as dots/blank squares. Likely icon imports broken or replaced with text placeholders.

2. **Sticky toolbar is gone**: Header lost sticky positioning. Desktop top actions don't stay visible while scrolling. Mobile header + tab switcher don't stick.

**Root cause expected**: Icon components not imported in toolbar files, icon-only buttons missing aria-label, sticky container lost `sticky top-0 z-*` classes, or parent wrapper has `overflow-hidden`/transform breaking sticky.

**Fix applied**: Use lucide icons (ArrowLeft, Save, RotateCcw, Download) with proper imports, add aria-label to icon-only buttons, restore sticky top-0 z-50 on header and tabs, ensure no parent overflow/transform breaks sticky.

**Testing**: Verify at 375px (all four icons visible, header+tabs sticky while scrolling) and desktop (header actions sticky, preview scrolls independently).
