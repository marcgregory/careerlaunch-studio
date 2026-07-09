# Dashboard UX Overhaul Plan

## Status: Draft for review

## Priority Alignment

The user ranked 6 improvements by impact. All are pure UX improvements (allowed in Sprint 6D's "no new features" policy). This plan covers all 6 items.

---

## Files to Create

### 1. `apps/web/app/dashboard/resume-actions.tsx` — Actions dropdown menu component
Replaces the current inline "Copy" button with a `⋮` kebab menu containing: Rename, Duplicate, Export PDF, Delete. A "use client" component with local state for open/close and naming modal.

### 2. `apps/web/app/dashboard/rename-modal.tsx` — Inline rename dialog
A small modal/popover for renaming a resume triggered from the actions menu. Calls `PATCH /api/resumes/:id` with `{ title }`.

### 3. `apps/web/app/dashboard/resume-card.tsx` — Individual resume card component
Extract the card rendering from `page.tsx` into its own component to manage complexity. Handles the card layout, status badge, date display, and the actions dropdown.

### 4. `apps/web/app/dashboard/empty-state.tsx` — Empty states component
Reusable empty state component for different filtered views ("No resumes match your search", "No analyzed resumes yet", etc.).

### 5. `apps/web/app/dashboard/workspace-stats.tsx` — Enriched sidebar component
Replace the simple sidebar with computed stats: total resumes, analyzed count, exported count, recent activity timeline.

---

## Files to Modify

### 6. `apps/web/app/api/resumes/[resumeId]/route.ts` — Add DELETE + PATCH handlers
- `DELETE` → deletes a resume (owner check, cascade)
- `PATCH` → rename title (only title field, not full body update)

### 7. `apps/web/app/dashboard/page.tsx` — Major rewrite
- Add client-side search, sort, and filter state
- Group resumes by recency (Today, Yesterday, This Week, Earlier)
- Make targetRole the primary identifier above the title
- Add relative date display ("Updated 2 min ago" / "2 hours ago" / "Jul 5")
- Add status badges (Draft, Analyzed, Tailored, etc.)
- Change "Continue" → "Edit Resume →"
- Delegate card rendering to `resume-card.tsx`
- Pass enriched data from server: add `analysisRuns` and `exports` to query

### 8. `apps/web/app/dashboard/duplicate-button.tsx` — Remove this file (folded into actions menu)

---

## Implementation Details

### API Changes

**DELETE `/api/resumes/[resumeId]`** — Already no DELETE handler exists. Simple:
```ts
export async function DELETE(_, context) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const resumeId = (await context.params).resumeId;
  const existing = await prisma.resumeDocument.findFirst({ where: { id: resumeId, userId: user.id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  await prisma.resumeDocument.delete({ where: { id: resumeId } });
  return new Response(null, { status: 204 });
}
```

**PATCH `/api/resumes/[resumeId]`** — New handler:
```ts
export async function PATCH(request, context) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const resumeId = (await context.params).resumeId;
  const { title } = await request.json();
  const existing = await prisma.resumeDocument.findFirst({ where: { id: resumeId, userId: user.id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.resumeDocument.update({ where: { id: resumeId }, data: { title } });
  return Response.json({ resume: updated });
}
```

### Server-side data enrichment

Update the query in `page.tsx` to include analysis data:
```ts
prisma.resumeDocument.findMany({
  where: { userId: user.id },
  orderBy: { updatedAt: "desc" },
  select: {
    id: true, title: true, targetRole: true, updatedAt: true,
    _count: { select: { analysisRuns: true, exports: true } },
    analysisRuns: { take: 1, orderBy: { createdAt: "desc" }, select: { type: true, createdAt: true } },
  }
})
```

### Resume card layout (redesign)

Before:
```
| [01] | Saved Draft                     | [Copy] [Continue] |
|      | Career Switch Resume            |                   |
|      | Untargeted resume - Updated ... |                   |
```

After:
```
| [preview icon] | Draft | Customer Success Manager    | [...]   |
|                | Career Switch Resume            |         |
|                | Updated 2 hours ago             | Edit →  |
```

### Recency grouping

Group resumes using JS Date math:
```ts
const groups = { Today: [], Yesterday: [], "This Week": [], Earlier: [] };
const now = new Date();
resumes.forEach(r => {
  const days = (now.getTime() - r.updatedAt.getTime()) / 86400000;
  if (days < 1) groups.Today.push(r);
  else if (days < 2) groups.Yesterday.push(r);
  else if (days < 7) groups["This Week"].push(r);
  else groups.Earlier.push(r);
});
```

### Search (client-side)

Simple `<input>` at the top of the card list. Filters `resumes` by title and targetRole match (case-insensitive). No API changes needed — all resumes are already loaded.

### Sort & Filter (client-side)

Toggle chips below search:
- Sort: Recently Updated (default) | Title A–Z | Oldest First
- Filter: All | Targeted | Untargeted | Analyzed | Imported

### Workspace sidebar stats

Replace the simple `{resumes.length} resumes in your workspace` with:
- Total resumes
- Targeted (has targetRole)
- Analyzed (has analysisRuns)
- Export count
- Plan info + Upgrade CTA
- Recent activity timeline (last 5 updates)

### Relative date display

Utility function (inline) that returns "just now", "2 min ago", "2 hours ago", "Yesterday", "Jul 5", etc.

### Thumbnails

Add a small visual indicator per card — a mini preview icon with the template name and color swatch. Actual rendered thumbnails (screenshots) are deferred; use a styled icon placeholder that shows the template accent color.

---

## Items intentionally deferred (not in this PR)

1. **Resume thumbnails (actual screenshot previews)** — Requires generating PNG per resume on save; significant infra/performance cost. Instead use a styled template-color placeholder badge.
2. **Bulk actions** — Need checkbox state management and batch API endpoints. Higher complexity; do in a follow-up.
3. **Pagination / infinite scroll** — Premature until users have 50+ resumes. Search + grouping already solves the "finding" problem.

---

## Scope Summary

| # | Improvement | Files Changed | Backend | Effort |
|---|---|---|---|---|
| 1 | Search + Sort + Filters | `page.tsx` | None | Medium |
| 2 | `⋮` Actions menu | `resume-actions.tsx`, `rename-modal.tsx`, `route.ts` | DELETE + PATCH | Medium |
| 3 | Target role as primary | `page.tsx` / `resume-card.tsx` | Update query | Small |
| 4 | Thumbnails (placeholder) | `resume-card.tsx` | None | Small |
| 5 | Recency grouping | `page.tsx` | None | Small |
| 6 | Workspace sidebar | `workspace-stats.tsx` | Update query | Medium |
