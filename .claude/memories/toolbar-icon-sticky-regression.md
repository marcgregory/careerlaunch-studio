---
name: toolbar-icon-sticky-regression
description: Icons appear blank due to button shrinking and sticky broke due to overflow-x-hidden
metadata:
  type: feedback
---

Two regressions introduced during UX polish (commit c69ccfa):

1. **Icons appear blank on mobile**: NOT missing imports. The header buttons lacked `flex-shrink-0` and `min-w-11 w-11 h-11` fixed sizing, so at 375px the buttons compressed and the SVG icons collapsed to near-zero width, appearing invisible. React DevTools would show the DOM nodes present but with 0px dimensions.

2. **Sticky header broke**: Commit `c69ccfa` added `overflow-x-hidden` to the `<main>` element. This turned `<main>` into a scroll container, making `position: sticky` relative to `<main>` instead of the viewport. Scroll snapped away.

**Fixes:**
- Icon buttons get `flex-shrink-0 min-w-11 w-11 h-11` on mobile, `sm:min-w-0 sm:w-auto sm:h-10` on desktop
- SVG icons get `w-5 h-5 shrink-0` on mobile, `sm:w-4 sm:h-4` on desktop
- Title area gets `flex-1` so it takes remaining space
- `lucide-react` transpilePackages addition reverted (was unnecessary — ESM works fine)
- `overflow-x-hidden` removed from `<main>` (handled at body level)
- Tab sticky top offset updated: `top-[60px]` mobile, `top-[68px]` desktop (matches taller header)
- Preview sticky offset: `top-[112px]` mobile (header + tabs), `xl:top-6` desktop

**Testing:** Verify at 375px (four icons visible, header+tabs sticky while scrolling) and desktop (header actions sticky, preview scrolls independently).
