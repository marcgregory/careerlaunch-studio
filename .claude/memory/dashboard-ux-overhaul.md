---
name: dashboard-ux-improvements
description: Complete dashboard UX overhaul implementing search, sort, filters, actions menu, recency grouping, and enriched sidebar
metadata:
  type: project
---

On 2026-07-09, the dashboard was overhauled with 6 high-impact UX improvements based on detailed feedback:

1. **Search + Sort + Filters** — client-side search bar, sort (Recently Updated, Title A–Z, Oldest First), and filter (All, Targeted, Untargeted, Analyzed) in `resume-list.tsx` — no API changes needed.

2. **`⋮` Actions menu** replacing inline "Copy" button — Rename (inline modal), Duplicate, Export PDF, Delete with confirmation via `resume-actions.tsx` and `rename-modal.tsx`. Required new DELETE and PATCH API handlers in `route.ts`.

3. **Target role as primary identifier** — role displayed prominently (large font-signal heading) above the resume title (smaller gray). Untargeted resumes show "Untargeted resume" as a muted placeholder.

4. **Resume thumbnails (placeholder)** — each card shows a styled icon tile using the template's accent colors (`resume-card.tsx`). Actual screenshot previews deferred.

5. **Recency grouping** — Today / Yesterday / This Week / Earlier sections with item counts in `resume-list.tsx`.

6. **Workspace sidebar enriched** — `workspace-stats.tsx` now shows 2×2 stat grid (Total, Targeted, Analyzed, Exports), plus quick links, resume count, and an Upgrade CTA.

Additional improvements: "Continue" → "Edit Resume →", relative timestamps ("2 min ago" / "Yesterday" / "Jul 5"), status badges (Draft / Analyzed), empty states for filtered views.

**Files created:** `resume-list.tsx`, `resume-card.tsx`, `resume-actions.tsx`, `rename-modal.tsx`, `empty-state.tsx`, `workspace-stats.tsx`
**Files modified:** `page.tsx`, `route.ts` (API)
**Files deleted:** `duplicate-button.tsx` (folded into actions menu)
