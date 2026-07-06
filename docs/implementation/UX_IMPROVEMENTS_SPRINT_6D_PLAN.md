# UX Polish Sprint — Plan

**Goal:** Address 6 UX issues identified during dogfooding, bringing the editing experience closer to Zety/Novorésumé quality. No new features. All changes are scoped to the builder UI and its child components.

## Issue 1 — Collapsible Suggestion Cards

**Problem:** Suggestion cards in the Health Dashboard sidebar are too verbose. Each card shows title, reason, current text example, suggestion preview, confidence bar, and action buttons — all visible at once. They occupy nearly the full sidebar width and force excessive scrolling.

**Solution:** Make suggestion cards collapsed by default. A collapsed card shows:
- Severity badge + title on one line
- Condensed summary (1 line, e.g. "2 bullets affected")
- [Review] + [X] action buttons

**Expand** to reveal the full reason, suggested text, confidence bar, and current text — only when the user clicks the card body.

### Files to Change:
- `apps/web/app/builder/_analysis/suggestion-card.tsx` — rewrite to collapsed-by-default layout

### Acceptance:
- Card takes ~3 lines collapsed vs ~12 lines expanded
- Title and severity badge always visible
- Review/X buttons always visible (no hiding actions)

---

## Issue 2 — Preview Size & Layout

**Problem:** The resume preview wrapper container has `max-w-[760px]` inside a `max-w-7xl` grid. The preview feels compressed — closer to a thumbnail than an editing reference.

**Solution:** Increase the preview container width, tighten sidebar width, and increase the preview's base font size slightly.

### Changes:

1. **resume-builder.tsx** — Change grid from `xl:grid-cols-[460px_1fr]` to `xl:grid-cols-[420px_1fr]` (slightly narrower sidebar). Remove the `max-w-[760px]` constraint on the preview container. Scale the preview wrapper padding.

2. **packages/rendering/src/index.tsx** — Increase base text size in the resume preview. All template `containerClass`es currently use `p-10` (40px). Keep the padding but scale body text to `text-sm/16` → `text-base/18` equivalent.

### Files to Change:
- `apps/web/app/builder/resume-builder.tsx` — grid columns, preview container sizing
- `packages/rendering/src/index.tsx` — base body text size, section spacing

### Acceptance:
- Preview feels readable at ~80% of real size instead of ~50%
- No layout breakage at common breakpoints (1280px+)

---

## Issue 3 — Skills Section Display

**Problem:** Even with category grouping, skills show every technology as a full pill or list item. A recruiter doesn't need to see 80 pills at once.

**Solution:** Show only the first 3-4 skills per category, then "+N more". Click to expand inline.

### Change Options Considered:
- **Option A (chosen):** Show `Category (N)` heading, first 4 skills inline, then `+N more` as a button that expands the rest inline. No modal.
- **Option B:** Collapsible per-category with "Show all" toggle.

**Chosen: A** — simplest implementation with the least visual weight.

### Files to Change:
- `packages/rendering/src/index.tsx` — `SkillsSection` component
- `apps/web/app/builder/resume-builder.tsx` — `EditableListPanel` for skills (client-side display only)

### Acceptance:
- Skills section preview shows max 4 skills per category, +N more expandable
- Edit panel still shows all skills as editable inputs

---

## Issue 4 — Sidebar Hierarchy & Section Grouping

**Problem:** The sidebar presents all sections as flat panels in a single list: Suggestions, Templates, Contact, Sections (Summary, Experience, Education, Skills, Projects), Cover Letter. There's no visual grouping.

**Solution:** Group sidebar panels into labeled sections:

```
── ANALYSIS ──
  Resume Health (suggestions + score)

── MATCH ──
  Resume Tailoring (JD match)
  Cover Letter

── EDITOR ──
  Target
  Template
  Contact
  Sections (each section panel)

── ACTIONS ──
  Section order (move up/down)
```

Each group has a tiny uppercase-mono label that acts as a visual separator but NOT a new component — just an `<h3>` or a `<p>` with a thin rule above it.

### Files to Change:
- `apps/web/app/builder/resume-builder.tsx` — group panels in the JSX with divider labels

### Acceptance:
- Sidebar has 4 visual groups with clear labels
- No functional changes — just visual grouping

---

## Issue 5 — Suggestion Wording

**Problem:** "Consider adding measurable impact..." reads like a command, not helpful advice. Also uses `Consider adding` phrasing that feels accusatory.

**Solution:** Rewrite static analysis suggestions to use "Opportunity to strengthen..." framing with a gentler explanation.

### Current → New:
- `"Consider adding measurable impact for "Role""` → `"Opportunity to strengthen this experience"`
- `"No skills listed"` → `"Add relevant skills to pass ATS filters"`
- `"Summary is too short"` → `"Expand your summary for a stronger first impression"`

### Files to Change:
- `packages/ai/src/analysis/static.ts` — rewrite `checkImpactQuality`, `checkSkills`, `checkSummary`
- Update corresponding test expectations in `packages/ai/__tests__/analysis/static.test.ts`

### Acceptance:
- All "Consider adding" → "Opportunity to strengthen" or better
- Reason text is more helpful, less prescriptive
- Tests updated

---

## Issue 6 — Preview Width Ratio

**Problem:** The sidebar-to-preview ratio feels closer to 25/75 with the preview rendered small inside that 75%, rather than 35/65 with a comfortably readable preview.

**Solution:** Combine with Issue 2 changes. The grid becomes `xl:grid-cols-[420px_1fr]` and the preview container expands to fill its column with `max-w-[900px]` instead of `max-w-[760px]`.

### Files to Change:
- `apps/web/app/builder/resume-builder.tsx` — same change as Issue 2

### Acceptance:
- Visible sidebar ~420px, preview fills remaining space up to 900px
- Preview text is noticeably larger and more readable

---

## Implementation Order

1. Issue 3 — Skills section display (preview changes, pure rendering)
2. Issue 5 — Suggestion wording (code + test updates)
3. Issue 1 — Collapsible suggestion cards (UI component change)
4. Issues 2 + 6 — Preview size/layout + width ratio (combined, one edit)
5. Issue 4 — Sidebar hierarchy (last, after other layout is stable)

---

## Files Changed Summary

| File | Issues |
|---|---|
| `apps/web/app/builder/_analysis/suggestion-card.tsx` | 1 |
| `packages/rendering/src/index.tsx` | 2, 3, 6 |
| `apps/web/app/builder/resume-builder.tsx` | 2, 4, 6 |
| `packages/ai/src/analysis/static.ts` | 5 |
| `packages/ai/__tests__/analysis/static.test.ts` | 5 |
