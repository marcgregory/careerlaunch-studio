# Mobile Builder Polish Plan

## Summary

Polish the resume builder's mobile layout per the user's feedback. All changes are CSS/Tailwind class tweaks in existing components — no new components, no logic changes, no new features.

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/web/app/builder/resume-builder.tsx` | Header, tabs, cards, preview, SectionDivider removal |
| `apps/web/app/globals.css` | One small-screen media query override for input heights |
| `apps/web/app/builder/_analysis/health-dashboard.tsx` | Reduce card padding on mobile |
| `apps/web/app/builder/_analysis/tailoring-panel.tsx` | Reduce card padding on mobile |
| `apps/web/app/builder/_analysis/cover-letter-panel.tsx` | Reduce card padding on mobile |
| `apps/web/app/builder/_analysis/job-match-panel.tsx` | Reduce card padding on mobile |

---

## Detailed Changes

### 1. Header (resume-builder.tsx, ~line 276)

**Problem**: Cramped, too tall, export text wastes space.

| What | Current | Change |
|------|---------|--------|
| Header padding | `px-3 py-2 sm:px-4 sm:py-3` | Keep `py-2 sm:py-3` — already minimal |
| Back button | `min-h-10 w-10 sm:min-h-12 sm:w-12` | `min-h-9 w-9 sm:min-h-10 sm:w-10` |
| "Resume Builder" label | `block` | `hidden sm:block` — save vertical space on mobile |
| Title | `text-base sm:text-2xl` | Keep `text-base` — already looks ok |
| Saved badge | `min-h-10` + text "Saved" | `min-h-9` on mobile, hide the text label, show only icon + dot |
| Export button | `min-h-10 px-2 sm:min-h-12 sm:px-3` with text | `min-h-9 w-9 px-0` on mobile (icon-only), keep sm+ behavior |
| Reset button | `min-h-10 px-2 sm:min-h-12 sm:px-3` | `min-h-9 w-9 px-0` on mobile (icon-only) |
| Spacing between buttons | `gap-1.5 sm:gap-2` | Keep — already tight |

### 2. Tabs (resume-builder.tsx, ~line 303)

**Problem**: Too tall (70-80px), wastes mobile vertical space.

| What | Current | Change |
|------|---------|--------|
| Tab button padding | `px-4 py-2.5` | `px-2 py-2` (reduces height to ~44px) |
| Tab font size | `text-sm` | Keep `text-sm` (= 14px) ✓ |
| Tab bar top padding | `pt-2` | `pt-1` |
| Tab bar sticky position | `top-[56px] sm:top-[68px]` | `top-[52px] sm:top-[60px]` (after header reduction) |
| Tab margin | Already `-mx-4` full-width | Keep ✓ |
| Tab equal width | Already `flex-1` | Keep ✓ |

### 3. Remove SectionDivider "EDITOR" (resume-builder.tsx, ~line 337)

**Problem**: Wastes vertical space with a decorative label.

**Change**: Remove the `<SectionDivider label="Editor" />` entirely. Content starts immediately with the Target card.

### 4. Cards (Panel component, resume-builder.tsx ~line 597, and all analysis panels)

**Problem**: Too much padding, oversized headers, too much gap between cards.

| What | Current | Change |
|------|---------|--------|
| Panel padding | `p-5` | `p-4 sm:p-5` |
| Panel header font | `text-xl` | `text-lg sm:text-xl` |
| Panel header bottom padding | `pb-3` | `pb-2 sm:pb-3` |
| Gap between panels in sidebar | `space-y-5` | `space-y-3 sm:space-y-5` |
| Analysis card padding (all 4 panels) | `p-6` | `p-4 sm:p-6` |

### 5. Input field height (fieldClass in packages/ui + globals.css)

**Problem**: Inputs feel too short on mobile.

| What | Current | Change |
|------|---------|--------|
| Input height mobile | ~40px (py-2.5) | No fieldClass change (shared package). Add globals.css media query: `@media (max-width:640px) { input, textarea, select { min-height: 48px } }` |

### 6. Preview area (resume-builder.tsx, ~line 514)

**Problem**: Preview has large outer margins and padding on mobile.

| What | Current | Change |
|------|---------|--------|
| Grid padding | `px-4` on the grid parent | Keep — needed for layout |
| Preview phone frame | `rounded-[30px] p-4 xl:p-6` | `rounded-[20px] p-2 sm:p-4 xl:p-6` on mobile |
| Preview card margin | In a `max-w-7xl` grid | Keep grid — but on mobile preview tab, the frame should fill width |
| Scroll container | `max-h-[calc(100vh-8rem)]` | Keep — but on mobile, reduce the top offset |

### 7. General mobile spacing (resume-builder.tsx, ~line 325)

| What | Current | Change |
|------|---------|--------|
| Grid gap | `gap-6` | `gap-3 sm:gap-6` |
| Main padding top | `py-7` | `py-4 sm:py-7` |

### 8. Suggestion cards (suggestion-card.tsx)

Already collapsed by default with the expand/collapse toggle ✓. The collapsed state shows:
- Severity badge (✓ already visible)
- Title (✓)
- One-line summary (✓ already has `collapsedSummary`)
- Review button (✓)

No changes needed.

---

## Risk Assessment

- **No new features** — purely CSS/tailwind class adjustments
- **fieldClass unchanged** — we use a global CSS override scoped to small screens, so other pages are unaffected
- **All analysis panels** — same `p-6 → p-4 sm:p-6` pattern, consistent risk
- **Preview scaling** — only affects mobile tab view, desktop untouched

## Verification

1. Build passes (`npm run build`)
2. View at 375px viewport — no horizontal scroll, everything readable
3. View at 390px, 414px — consistent
4. View at 768px+ — unaffected (all changes use `sm:` responsive prefix)
5. Header fits without truncation of essential controls
6. Tabs are ~44px tall, not ~70px
7. Inputs feel comfortable to tap (48px min-height)
