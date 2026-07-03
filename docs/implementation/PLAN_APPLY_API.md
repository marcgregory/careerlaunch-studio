# Plan: API Route + HealthDashboard Accept Wiring

## Files to create

### 1. API Route — `apps/web/app/api/resumes/[resumeId]/suggestions/apply/route.ts`

Thin wrapper, no apply logic lives here:

```
POST /api/resumes/:resumeId/suggestions/apply
{
  "operations": ApplyOperation[]  // the same union from @careerlaunch/ai
}
→ { updatedResume: ResumeDocument, appliedChanges: AppliedChange[] }
```

Steps:
1. `requireApiUser()` — 401 if unauthenticated
2. `prisma.resumeDocument.findFirst({ where: { id, userId } })` — 404 if not found/not owned
3. Parse and validate JSON body — 400 if missing/invalid `operations` array
4. `applyChanges(resume, operations)` — 409 if ApplyError (stale target)
5. `prisma.resumeDocument.update({ where: { id }, data: { body: toStoredResume(updatedResume) } })`
6. Return `{ updatedResume, appliedChanges }`

Status codes: `{ error: string }` on 400/401/404/409, `{ updatedResume, appliedChanges }` on 200.

### 2. Client — wire Accept button to call the API

In `apps/web/app/builder/resume-builder.tsx`:
- Pass a callback `onApplyOperations: (ops: ApplyOperation[]) => Promise<void>` down through `HealthDashboard`

In `apps/web/app/builder/_analysis/health-dashboard.tsx`:
- Change `handleAccept(id: string)` from pure local state to:
  1. Find the suggestion by ID
  2. Convert it to `ApplyOperation[]` (one suggestion → one operation)
  3. Call `onApplyOperations` (the API)
  4. On success, mark suggestion "accepted" locally
  5. On error (ApplyError/stale), show error — suggestion stays "pending"

### 3. Suggestion → Operation mapping

The translation from a `Suggestion` to an `ApplyOperation` lives in a shared helper (not in the route — the route receives operations directly):

```
apps/web/lib/suggestion-to-operation.ts
```

Mapping rules:

| Suggestion category + location | Operation |
|---|---|
| `category: "summary"` | `{ type: "replace_summary", summary: suggestion.suggestedText }` |
| `category: "experience"` AND `field` matches `bullets[N]` | `{ type: "replace_bullet", entryId, bulletIndex: N, text: suggestedText }` |
| `category: "skills"` AND `field` matches `skills[N]` | `{ type: "replace_skill", index: N, skill: suggestedText }` |
| `field === "skills"` AND category isn't specific | Try `add_skill` if targetText is null, otherwise `replace_skill` |
| Fallback for suggestions with `suggestedText` and `entryId` without bulletIndex | `replace_bullet` with bulletIndex: 0 |

This mapping is intentionally simple — only the 5 safe operations we built. Unsupported categories return null so the caller can skip/fall through.

### Considerations

- **No undo in this sprint** — the `appliedChanges` array provides the data needed for future undo
- **Stale target (409)** — the HealthDashboard catches ApplyError and keeps the suggestion as "pending" so the user can re-run analysis
- **Resume state sync** — after a successful apply, the `ResumeBuilder` refreshes its resume state from the API response so the preview and sidebar reflect the change
