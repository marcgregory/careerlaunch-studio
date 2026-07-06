---
name: mobile-builder-polish
description: Mobile polish applied to the resume builder in Sprint 6D: smaller header, compact tabs, reduced card padding, 48px input heights
metadata:
  type: reference
---

## Mobile Builder Polish (Sprint 6D)

Applied per user feedback to make the builder usable at 375px viewport width. All changes are CSS/Tailwind class-only — no component restructuring.

### Changes

1. **Header** (`apps/web/app/builder/resume-builder.tsx`): Toolbar height reduced to ~52px. Back button: `min-h-9 w-9`. "Resume Builder" label hidden on mobile `<640px`. Title: `text-sm`. Export/Reset buttons icon-only on mobile (`w-9`), show text on `sm:`. Saved badge: smaller (`min-h-9`, `px-2`, `text-xs`).

2. **Tabs** (`resume-builder.tsx`): Height reduced to ~44px. Padding: `px-2 py-2`. Tab bar top padding: `pt-1`. Sticky offset: `top-[52px] sm:top-[60px]`.

3. **SectionDivider removed** (`resume-builder.tsx`): The standalone "EDITOR" decorative label was deleted — editor content starts immediately.

4. **Cards** (Panel at `resume-builder.tsx`): Padding `p-5` → `p-4 sm:p-5`. Header `text-xl` → `text-lg sm:text-xl`. Header bottom padding `pb-3` → `pb-2 sm:pb-3`. Sidebar gap `space-y-5` → `space-y-3 sm:space-y-5`. Main grid gap `gap-6` → `gap-3 sm:gap-6`, padding `py-7` → `py-4 sm:py-7`.

5. **Analysis panels** (health-dashboard, tailoring-panel, cover-letter-panel, job-match-panel): Section padding `p-6` → `p-4 sm:p-6` across all states (idle, loading, error, success).

6. **Input heights** (`apps/web/app/globals.css`): Added `@media (max-width: 640px) { input, textarea, select { min-height: 48px } }` for better tap targets on mobile.

7. **Preview** (`resume-builder.tsx`): Phone frame padding `p-4` → `p-2 sm:p-4 xl:p-6`.

### What was NOT changed

- Suggestion cards already collapsed by default (task said "collapsed by default" — already done).
- No new features, no component restructuring, no logic changes.
- Desktop (`sm:` breakpoint and above) is visually unchanged.
