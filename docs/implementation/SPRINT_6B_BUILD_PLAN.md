# Sprint 6B Build Plan — AI Resume Tailoring (Flagship Feature)

**Last updated:** 2026-07-05
**Status:** Ready for implementation
**Target tag:** `v0.8.0-alpha`

---

## Overview

Make CareerLaunch Studio genuinely useful for job seekers by building AI-powered resume tailoring against job descriptions. Users paste a JD, see how well their resume matches, get targeted rewrite suggestions for their summary, bullets, and skills, review changes via before/after diff, and apply selectively.

No new providers, no billing changes, no new templates. Reuses existing AIProvider, apply engine, DiffView, and operation factory.

### Existing building blocks (already built in prior sprints)

| Building Block | File(s) | Status |
|---|---|---|
| AIProvider interface | `packages/ai/src/providers/types.ts` | ✅ `analyze()`, `matchJob()`, `generateCoverLetter()` |
| GeminiProvider | `packages/ai/src/providers/gemini.ts` | ✅ Full implementation |
| GroqProvider | `packages/ai/src/providers/groq.ts` | ✅ Full implementation |
| Suggestion type | `packages/ai/src/suggestion/types.ts` | ✅ Has `targetText`, `suggestedText`, `reason`, `confidence`, `location` |
| Apply engine | `packages/ai/src/apply/apply.ts` | ✅ `replace_summary`, `replace_bullet`, `replace_skill`, `add_skill`, `remove_skill` |
| Operation factory | `packages/ai/src/operations/factory.ts` | ✅ Suggestion → ApplyOperation mapping |
| DiffView component | `apps/web/components/diff-view.tsx` | ✅ Word-level LCS diff, side-by-side layout |
| SuggestionDiffModal | `apps/web/components/suggestion-diff-modal.tsx` | ✅ Review → Apply modal |
| Job match route | `apps/web/app/api/resumes/[resumeId]/job-match/route.ts` | ✅ POST endpoint |
| Analyze route | `apps/web/app/api/resumes/[resumeId]/analyze/route.ts` | ✅ GET endpoint |
| JobMatchPanel UI | `apps/web/app/builder/_analysis/job-match-panel.tsx` | ✅ JD paste, match score, skills, suggestions |
| HealthDashboard | `apps/web/app/builder/_analysis/health-dashboard.tsx` | ✅ Analysis panel with suggestions |
| Prompts | `packages/ai/prompts/` | ✅ 8 prompt files with template vars |
| Validation | `packages/ai/src/lib/validate.ts` | ✅ Structured output validators |
| Cost controls | `packages/ai/src/lib/cost-control.ts` | ✅ Token budgets, retry, backoff |
| Cache | `packages/ai/src/lib/cache.ts` | ✅ Dimension-aware TTL cache |

---

## Implementation Phases

### Phase 1 — AI Job Analysis (`packages/ai/src/job-analysis/`)

Enhance the existing job-match pipeline to return **rich structured job analysis** rather than just a match score. The AI should extract:

- Required skills
- Preferred skills
- Seniority level
- Key responsibilities
- ATS keywords (industry-specific terms from the JD)
- Industry classification

**What to build:**

1. **New type definitions** — `packages/ai/src/job-analysis/types.ts`
   ```typescript
   export interface JobAnalysis {
     requiredSkills: string[];
     preferredSkills: string[];
     seniority: "entry" | "mid" | "senior" | "lead" | "executive" | "unknown";
     responsibilities: string[];
     atsKeywords: string[];
     industry: string | null;
   }
   ```

2. **AI prompt** — `packages/ai/prompts/job-analysis/v1.md`
   - Prompt the AI to extract structured data from a raw JD
   - System role: "You are a job analyst. Analyze job descriptions and extract structured data."

3. **Provider method** — Add optional `analyzeJob(jobDescription: string): Promise<JobAnalysis>` to `AIProvider`
   - Both GeminiProvider and GroqProvider implement it
   - Deterministic fallback: `deterministicAnalyzeJob()` extracts skills via dictionary

4. **Integration** — `runJobAnalysis()` function that delegates to provider → falls back to deterministic

**Test criteria:**
- AI extracts 5+ required skills from sample JD
- Seniority is correctly classified
- Empty JD returns default safe values
- Provider error falls back to deterministic

---

### Phase 2 — Resume Gap Analysis (`packages/ai/src/gap-analysis/`)

Compare the normalized resume against the analyzed job to produce a detailed gap report. This replaces the current dictionary-based comparison with AI-backed analysis while keeping the deterministic fallback.

**What to build:**

1. **New type definitions** — `packages/ai/src/gap-analysis/types.ts`
   ```typescript
   export interface GapAnalysis {
     matchScore: number;                 // 0–100 overall match
     matchedSkills: string[];
     missingSkills: string[];
     weakSections: Array<{
       sectionId: string;
       field: string;
       reason: string;
       severity: "critical" | "major" | "medium" | "minor";
     }>;
     recommendations: Array<{
       type: "add_skill" | "rewrite_bullet" | "rewrite_summary";
       sectionId: string;
       entryId?: string;
       reason: string;
     }>;
   }
   ```

2. **Gap analysis prompt** — `packages/ai/prompts/gap-analysis/v1.md`
   - Takes: job analysis + normalized resume
   - Returns: structured gap report
   - Rules: Never invent experience. Never invent achievements.

3. **Provider method** — Add optional `analyzeGap(input: GapAnalysisInput): Promise<GapAnalysis>` to AIProvider
   - Deterministic fallback reuses the existing `deterministicRunJobMatch()` logic

4. **Integration function** — `runGapAnalysis()` in `packages/ai/src/gap-analysis/index.ts`
   - Calls `analyzeJob()` first, then `analyzeGap()` with the result
   - If either fails, falls back to deterministic

5. **API route** — `POST /api/resumes/:resumeId/gap-analysis`
   - Body: `{ jobDescription: string }`
   - Returns: `{ gapAnalysis: GapAnalysis, suggestions: Suggestion[] }`
   - Rate limited: 10/hour/user
   - Entitlement-gated: `RUN_JOB_MATCH`

**Test criteria:**
- Returns match score + matched/missing skills
- Identifies weak sections with reasons
- Never invents experience when missing
- AI failure falls through to deterministic

---

### Phase 3 — AI Resume Tailoring (Rewrites)

Generate targeted rewrites for Professional Summary, Experience bullets, and Skills section based on the gap analysis.

**This is the core value proposition.** The AI should suggest concrete improvements — not just tell the user what's wrong.

**What to build:**

1. **Tailoring types** — `packages/ai/src/tailoring/types.ts`
   ```typescript
   export interface TailorSuggestion {
     id: string;
     category: "summary" | "experience" | "skills";
     location: SuggestionLocation;
     before: string;           // Current text
     after: string;            // AI-suggested replacement
     reason: string;           // Why this change helps
     confidence: number;       // 0–1
   }

   export interface TailoringInput {
     resume: NormalizedResume;
     jobAnalysis: JobAnalysis;
     gapAnalysis: GapAnalysis;
   }
   ```

2. **Tailoring prompts** — Three prompt files:
   - `packages/ai/prompts/tailor-summary/v1.md` — Rewrite the professional summary for the target role
   - `packages/ai/prompts/tailor-bullets/v1.md` — Rewrite experience bullets to highlight relevant skills
   - `packages/ai/prompts/tailor-skills/v1.md` — Reorder/reword skills section for relevance

   **Critical constraints in every prompt:**
   - Never invent experience the resume doesn't contain
   - Never invent achievements, metrics, or outcomes
   - Improve wording, clarity, and relevance only
   - Preserve factual accuracy — dates, job titles, company names must be unchanged
   - Every suggestion MUST include `before`, `after`, and `reason`

3. **Post-processing** — `packages/ai/src/tailoring/post-process.ts`
   - Validates that `before` text exists in the resume (stale-target protection)
   - Strips any suggestions where `after` adds fabricated experience
   - Validates confidence scores are 0–1

4. **Deterministic fallback** — `deterministicTailor()`
   - Wraps matched/missing skills into add_skill suggestions
   - No bullet rewrites in fallback mode

5. **Integration function** — `runTailoring()` in `packages/ai/src/tailoring/index.ts`

**Test criteria:**
- Summary rewrite stays factually accurate
- Bullet rewrites don't invent metrics
- Skills reorder preserves original skills
- Before/after fields are always populated
- Empty sections return empty arrays, not errors

---

### Phase 4 — Before/After Diff in Suggestions

The existing `Suggestion` type and `DiffView` component already support before/after comparison. The work here is ensuring every tailoring suggestion carries a `before` field and the existing `DiffView` is used inline in the suggestions list (not just in the modal).

**What to build:**

1. **Inline diff preview** — New component `apps/web/app/builder/_analysis/tailor-suggestion-list.tsx`
   - Shows a compact inline diff in the suggestion card
   - "Current ↓ Suggested" with a small inline diff (not full modal)
   - Modal still available for detailed review via "Review" button

2. **Bulk apply footer** — Per-category apply buttons:
   - "Apply all summary suggestions"
   - "Apply all experience rewrites"
   - "Apply all skills suggestions"

3. **No new infrastructure** — Uses existing:
   - `DiffView` component
   - `SuggestionDiffModal` for detailed review
   - `createOperations()` for mapping
   - `handleApplySuggestion()` already in `resume-builder.tsx`

---

### Phase 5 — Apply Suggestions

Reuses the existing apply engine completely — no changes needed to `packages/ai/src/apply/`.

The existing operations already cover all tailoring use cases:

| Tailoring action | Existing operation |
|---|---|
| Rewrite summary | `replace_summary` |
| Rewrite bullet | `replace_bullet` |
| Add missing skill | `add_skill` |
| Replace skill | `replace_skill` |
| Remove skill | `remove_skill` |

**What to build:**

1. **Bulk apply API** — `POST /api/resumes/:resumeId/suggestions/apply-bulk`
   - Accepts `{ suggestionIds: string[] }` 
   - Looks up each suggestion from the latest analysis run
   - Maps to operations via `createOperations()`
   - Applies via the existing apply engine
   - Returns `{ updatedResume, appliedChanges }` with per-suggestion results
   - Handles partial failure: returns which succeeded and which failed

2. **"Apply all" button** in the tailoring panel
   - One click → apply all pending tailoring suggestions
   - Updates resume in-place, same as existing apply flow

3. **Apply one** already works via the existing `handleApplySuggestion()` flow

---

### Phase 6 — New Job Match & Tailoring Panel (UI)

**What to build:**

1. **Unified panel** — Replace the current `JobMatchPanel` with `TailoringPanel` in `apps/web/app/builder/_analysis/tailoring-panel.tsx`

   The panel has three states:

   **State 1: Idle / Paste JD**
   ```
   ┌──────────────────────────┐
   │ 🎯 Resume Tailoring       │
   │                          │
   │ Paste a job description  │
   │ to tailor your resume    │
   │ to the role.             │
   │                          │
   │ ┌──────────────────────┐ │
   │ │ Paste JD here...     │ │
   │ └──────────────────────┘ │
   │ [✨ Analyze & Tailor]    │
   └──────────────────────────┘
   ```

   **State 2: Loading**
   ```
   ┌──────────────────────────┐
   │ 🎯 Resume Tailoring       │
   │                          │
   │ Analyzing job...         │
   │ → Analyzing job          │
   │ → Checking your resume   │
   │ → Writing suggestions    │
   │                          │
   │ [spinner]                │
   └──────────────────────────┘
   ```

   **State 3: Results** (rich, scrollable)
   ```
   ┌──────────────────────────┐
   │ 🎯 Resume Tailoring       │
   │                          │
   │ Match: 72% [░░░░░░░░]    │
   │ Target: Senior Frontend  │
   │                          
   │ ─── Required Skills ───
   │ ✅ React                 │
   │ ✅ TypeScript            │
   │ ❌ Next.js               │
   │ ❌ GraphQL               │
   │                          
   │ ─── Missing Keywords ──
   │ SSR, ISR, Web Vitals    │
   │                          
   │ ─── Summary Rewrite ───
   │ Current: "Experienced..."│
   │    ↓                     │
   │ Suggested: "Frontend..." │
   │ [Review] [Apply]         │
   │                          
   │ ─── Experience ────
   │ 3 suggestions available  │
   │ [Review All] [Apply All] │
   │                          
   │ ─── Skills ─────────
   │ + Next.js                │
   │ + GraphQL                │
   │ [Apply All Skills]       │
   │                          
   │ [Re-analyze]             │
   └──────────────────────────┘
   ```

2. **Replace the sidebar panels** in `apps/web/app/builder/resume-builder.tsx`:
   - Remove `HealthDashboard` 
   - Expand `JobMatchPanel` → full `TailoringPanel` with all 3 phases integrated
   - Keep `CoverLetterPanel` as-is

3. **Phase 6B** — (Future enhancement, not in this sprint): Dedicated `/tailor/[resumeId]` page with full side-by-side layout

---

## Success Criteria

A user should be able to:

1. Open the resume builder
2. Paste a job description in the tailoring panel
3. Click **Analyze & Tailor**
4. See:
   - AI-powered match score with detailed breakdown
   - Required vs preferred skills comparison
   - Missing ATS keywords
   - AI rewrite suggestions for summary, experience bullets, and skills
   - Before/after comparison for every suggestion
5. Choose which suggestions to apply — individually or "apply all" per section
6. Export the tailored resume as PDF

---

## Constraints

- Reuse existing AI provider architecture (Gemini/Groq)
- Do not add another provider in this sprint
- Do not modify billing or Stripe
- Do not add more resume templates
- Never invent experience, achievements, or metrics
- Every suggestion includes `before` / `after` / `reason` / `confidence`
- No automatic overwrites — user reviews and accepts

---

## File Change Summary

### New files

| File | Purpose |
|---|---|
| `packages/ai/src/job-analysis/types.ts` | JobAnalysis type definitions |
| `packages/ai/src/job-analysis/index.ts` | `runJobAnalysis()` integration function |
| `packages/ai/prompts/job-analysis/v1.md` | Job analysis AI prompt |
| `packages/ai/src/gap-analysis/types.ts` | GapAnalysis type definitions |
| `packages/ai/src/gap-analysis/index.ts` | `runGapAnalysis()` integration function |
| `packages/ai/prompts/gap-analysis/v1.md` | Gap analysis AI prompt |
| `packages/ai/src/tailoring/types.ts` | Tailoring types (before/after/reason/confidence) |
| `packages/ai/src/tailoring/index.ts` | `runTailoring()` integration function |
| `packages/ai/src/tailoring/post-process.ts` | Stale-target detection, fabrication guard |
| `packages/ai/prompts/tailor-summary/v1.md` | Summary rewrite prompt |
| `packages/ai/prompts/tailor-bullets/v1.md` | Bullet rewrite prompt |
| `packages/ai/prompts/tailor-skills/v1.md` | Skills section rewrite prompt |
| `apps/web/app/builder/_analysis/tailoring-panel.tsx` | Unified tailoring UI panel |
| `apps/web/app/api/resumes/[resumeId]/gap-analysis/route.ts` | Gap analysis API route |
| `apps/web/app/api/resumes/[resumeId]/suggestions/apply-bulk/route.ts` | Bulk apply API route |

### Modified files

| File | Change |
|---|---|
| `packages/ai/src/providers/types.ts` | Add optional `analyzeJob()`, `analyzeGap()`, `tailorResume()` methods |
| `packages/ai/src/providers/gemini.ts` | Implement new provider methods + prompt building |
| `packages/ai/src/providers/groq.ts` | Implement new provider methods + prompt building |
| `packages/ai/src/providers/mock.ts` | Add mock implementations for new methods |
| `packages/ai/src/index.ts` | Export new modules |
| `apps/web/app/builder/resume-builder.tsx` | Replace `JobMatchPanel` with `TailoringPanel` |
| `docs/implementation/ROADMAP.md` | Mark Sprint 6B as In Progress |
| `docs/implementation/CHANGELOG.md` | Add Sprint 6B entry |
| `docs/implementation/PROJECT_STATUS.md` | Update status |
| `.claude/memory/sprint-6b-ai-tailoring.md` | Capture sprint decision |

---

## Rollout Plan

1. **Phase 1** — Job analysis (new types + provider methods + prompts)
2. **Phase 2** — Gap analysis (new types + prompts + integration)
3. **Phase 3** — Tailoring (the core value prop — rewrite prompts + post-processing)
4. **Phase 4** — Diff display (inline diff in results panel)
5. **Phase 5** — Apply (reuse existing engine + bulk apply API)
6. **Phase 6** — Unified UI panel (replace JobMatchPanel with TailoringPanel)

Each phase produces testable, shippable work. Validation gates: `npm run build` and `npm run test` must pass.
