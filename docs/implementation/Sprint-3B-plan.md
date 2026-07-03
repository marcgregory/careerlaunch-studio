# Sprint 3B — Suggestion Preview / Diff UI

## Goal

Add a "Review → Diff → Accept" step before changes are applied. Currently, clicking the checkmark immediately applies a suggestion. Users need to trust the AI, and a diff preview builds that trust.

UX rule: **AI proposes → user reviews → user accepts → Apply Engine mutates**

## Plan

### 1. Diff Component (`apps/web/components/diff-view.tsx`)

A pure presentational component that renders a side-by-side or inline diff for three change types:

- **Summary** — shows the full old summary vs. full new summary with word-level highlighting
- **Bullet** — shows the old bullet vs. new bullet
- **Skill** — shows old skill name vs. new skill name

**Visual design:**
- Side-by-side layout: left = "Current" (red/removed), right = "Suggested" (green/added)
- Word-level highlighting using a simple word-diff algorithm (no dependency — implement inline)
- Works inside a modal/dialog overlay
- Responsive: stacks vertically on narrow screens

**States:**
- Default: shows before/after with highlighting
- No target text (summary add, not replace): left side says "None" in muted text
- Error fallback: if diff can't be computed, show the raw suggestion text with a note

### 2. Change SuggestionCard flow

Currently `SuggestionCard` has Accept (✓) and Dismiss (X) buttons.

New flow:
- Replace the single Accept button with a two-step: **Review** button → opens diff modal → **Apply** button
- Dismiss still works immediately (one click)

**SuggestionCard changes:**
- Add a `onReview` callback that opens the diff
- The checkmark → change to a "Review" label button with an eye/preview icon
- Remove the immediate accept from card actions
- Dismiss remains unchanged

### 3. Diff Modal (`apps/web/components/suggestion-diff-modal.tsx`)

A dialog overlay that contains:
- Suggestion title, severity, and reason at the top
- The DiffView in the center
- Two action buttons at the bottom: **Apply** (green) and **Cancel** (returns to the suggestion list)

**States:**
- **Open**: modal visible, shows diff
- **Applying**: Apply button shows spinner, buttons disabled
- **Applied**: shows success state with checkmark, auto-closes after 1.5s
- **Error**: shows error message with retry option

**Dismiss behavior:**
- Click outside or Cancel → closes modal, suggestion remains pending
- Escape key closes modal

### 4. Wire into HealthDashboard

Current `handleAccept(id)`:
- Finds suggestion → maps to operations → optimistic update → calls API → revert on error

New flow should split into two handlers:
- `handleReview(id)` — opens the diff modal with the suggestion data
- `handleApplyFromModal(id)` — the actual API call (same logic as current `handleAccept`)

The modal lives as state in `HealthDashboard`:
- `reviewingSuggestion: ClientSuggestion | null` — controls modal open/close
- When `reviewingSuggestion` is set, render the DiffModal
- On Apply → call `handleApplyFromModal` → on success → close modal, suggestion shows "Accepted"
- On Cancel → clear `reviewingSuggestion`

### 5. Dismiss behavior (already client-side, unchanged)

Dismiss stays as-is: local state set to "rejected". No API call.

### 6. E2E Test

Update `apps/web/tests/suggestion-apply.spec.ts` to cover:
1. Analyze resume → suggestions appear
2. Click "Review" on a suggestion → diff modal opens
3. Verify diff shows before/after text
4. Click "Apply" → modal shows applying state → closes → suggestion shows "Accepted"
5. Resume preview reflects change
6. Click "Review" then "Cancel" → modal closes, suggestion still pending
7. Dismiss a suggestion → suggestion shows "Dismissed"

## Files to Create

| File | Purpose |
|------|---------|
| `apps/web/components/diff-view.tsx` | Pure diff component (word-level, side-by-side) |
| `apps/web/components/suggestion-diff-modal.tsx` | Modal wrapper with diff + apply/cancel |
| `apps/web/components/__tests__/diff-view.test.tsx` | Diff component unit tests |

## Files to Modify

| File | Change |
|------|--------|
| `apps/web/app/builder/_analysis/suggestion-card.tsx` | Add Review button, remove direct Accept |
| `apps/web/app/builder/_analysis/suggestions-list.tsx` | Pass `onReview` through (no structural change) |
| `apps/web/app/builder/_analysis/health-dashboard.tsx` | Add review state + modal rendering, split accept flow |
| `apps/web/tests/suggestion-apply.spec.ts` | Extend E2E tests for diff flow |

## Non-Goals

- No backend changes (apply endpoint already works)
- No persistence of "reviewed" state
- No undo after apply (that's a future enhancement)
- No inline editing in the diff
