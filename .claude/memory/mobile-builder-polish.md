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

4. **Cards** (Panel at `resume-builder.tsx`): On mobile (`<sm:`) cards are completely flat — no border, no background, no rounded corners, no shadow, no padding. `sm:rounded-2xl sm:border sm:border-[#123c3a]/10 sm:bg-white sm:p-5 sm:shadow-sm`. Header `text-sm`. Content `mt-2`. Desktop unchanged.

5. **ItemCard**: On mobile: flat (no border/background/padding). `sm:rounded-2xl sm:border sm:border-[#123c3a]/10 sm:bg-[#f8f8f5] sm:p-3`.

6. **StackEmpty**: Reduced padding `p-4` → `p-3`, reduced gap `mt-1` → `mt-0.5` on mobile.

7. **tinyButtonClass**: Mobile `min-h-8 px-2 py-1 text-[0.65rem]`. Desktop `min-h-9 px-3 py-1.5 text-xs`.

8. **labelClass**: Mobile `text-[0.65rem]`. Desktop `text-xs`.

9. **Template gallery**: Mobile `min-h-[10rem] p-2 gap-2`. Desktop `min-h-[12rem] p-3 gap-3`.

10. **Sidebar gap**: `space-y-3 sm:space-y-5`. Grid: `gap-3 sm:gap-6`, `py-4 sm:py-7`.

11. **Analysis panels** (health-dashboard, tailoring-panel, cover-letter-panel, job-match-panel): Section padding `p-4 sm:p-6` across all states.

12. **Input heights** (`apps/web/app/globals.css`): `@media (max-width: 640px) { input, textarea, select { min-height: 48px } }`.

13. **Preview** (`resume-builder.tsx`): On mobile preview tab — flat full-width, no phone frame (no border, no background, no padding, no shadow). Desktop: `xl:rounded-[30px] xl:border xl:bg-[#d8d4cb] xl:p-6 xl:shadow-inner`. Preview extends edge-to-edge via `-mx-4`.

### Design Decision

Cards on mobile are deliberately **borderless backgroundless sections** — they read as continuous content, not floating cards. At `sm:` (640px+) they regain card appearance. This avoids wasted vertical space from borders, padding, and rounded corners at small viewports.

### What was NOT changed

- Suggestion cards already collapsed by default.
- No new features, no component restructuring, no logic changes.
