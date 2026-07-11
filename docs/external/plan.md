# AI Recovery Polish Plan

## Issues to Fix

Based on user feedback on the AI recovery UX, here are the 5 issues ranked by impact:

### 1. ✏️ Banner copy (trivial — 1 file, 1 line)
**File:** `apps/web/app/import/page.tsx` line 43

Change from: `"Resume reconstructed with AI"` + generic description
Change to: `"We repaired issues found while importing your resume."` + reassuring description

### 2. 🐛 Orphaned fragment entries in experience
**Root cause** in `packages/ai/src/import/recovery.ts` — `mergeRecovery()` uses `deduplicateExperience()` which keeps ALL parser entries and appends non-duplicate AI entries. When the parser extracted junk fragments as standalone entries (e.g. `role: "timelines were met."`, no company, no bullets, no dates), those survive the merge because they can't be key-matched.

**Fix in mergeRecovery():**
- Before merging, filter parser experience entries that look like fragments: entries with no `company`, zero `bullets`, and both `start`/`end` empty are removed. These are parser artifacts, not real experience items.
- Also filter entries whose `role` is very short (< 5 words) with no date context.

### 3. 🐛 Education deduplication
**Root cause** — current dedup key is `school|degree` exact match. When the AI returns the same degree in a slightly different format (e.g. "BS in Computer Engineering | Cagayan de Oro College - PHINMA (2015)" vs structured form), the exact match misses it.

**Fix in mergeRecovery():**
- Use a soft-dedup that checks for substring overlap on school names and degree text.
- If > 60% character overlap on both school and degree, treat as duplicate.
- The merged entry takes the more-complete version (prefer AI's structured format).

### 4. 🔧 Skill category reconstruction
**Root cause** — RecoveryResult type has no `skills` field. The LLM prompt doesn't ask for skills. The merge logic marks skills as recovered but does nothing.

**Fix in recovery.ts:**
- Add `skills` to `RecoveryResult` type as `Array<{ category: string; items: string[] }>`
- Update the LLM prompt to ask for categorized skills: "For skills, organize by category (Frontend, Backend, Cloud & Tools, etc.) with each category having a list of skills."
- Update `parseRecoveryResponse()` to validate skills
- Update `mergeRecovery()`: when skills have low coverage, flatten AI-categorized skills into `string[]` preserving category prefixes (e.g., "Frontend: React" becomes one string, "Backend: Node.js" another) — this works with the existing `string[]` domain type.

### 5. 🆕 Comparison view (largest change — multi-file)
**Problem:** Users can't verify what AI changed, which undermines trust.

**Approach:** Store pre-recovery data in the API response, add a "View original" / "View recovered" toggle on recovered sections in the import preview.

**Files changed:**
- `packages/ai/src/import/text-parser.ts` — no changes needed (ParseResult already has the structure)
- `apps/web/app/api/import/text/route.ts` — before merging recovery, snapshot the pre-recovery data and include it in the response as `preRecoveryData: Partial<ResumeDocument>`
- `apps/web/app/import/page.tsx` — add a diff toggle UI for recovered sections. Each recovered section gets a "Recovered by AI" badge (already exists) plus a `[View original] / [View recovered]` toggle. The toggle swaps the rendered content.

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| Banner copy | None | Static text change |
| Fragment filter | Low | Only removes entries that fail ALL of: no company AND no bullets AND no dates |
| Education dedup | Low | Soft matching with high threshold; false positives merge safely (same degree) |
| Skills reconstruction | Low | Adds new optional field; backward-compatible parser |
| Comparison view | Medium | Requires new state in UI; pre-recovery snapshot is additive in API |

## Files Changed (all changes within existing files)

1. `apps/web/app/import/page.tsx` — banner text + diff toggle UI
2. `apps/web/app/api/import/text/route.ts` — pre-recovery snapshot
3. `packages/ai/src/import/recovery.ts` — fragment filter, education dedup, skills support
4. `packages/ai/__tests__/import/recovery.test.ts` — tests for new behavior
