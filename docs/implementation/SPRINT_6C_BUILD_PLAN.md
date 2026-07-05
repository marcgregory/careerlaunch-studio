# Sprint 6C — AI Quality & Beta Polish

**Goal:** Improve AI quality, trust, and measurable user outcomes. No new AI providers or billing work.

**Version:** `v0.9.0-alpha`

**Duration:** 1 sprint

---

## Phase 1 — User Feedback System (Highest Priority)

### Database

**New model — `SuggestionFeedback`** (`prisma/schema.prisma`):
```prisma
model SuggestionFeedback {
  id            String   @id @default(cuid())
  suggestionId  String
  userId        String
  resumeId      String
  analysisRunId String?
  category      String   // "summary" | "experience" | "skills" | etc.
  helpful       Boolean  // true = 👍, false = 👎
  reason        String?  // "too_generic" | "incorrect" | "invented" | "doesnt_match" | "other"
  reasonText    String?  // free text when reason is "other"
  provider      String?
  model         String?
  promptVersion String?
  createdAt     DateTime @default(now())
}
```

### API

**`POST /api/resumes/:resumeId/suggestions/feedback`** (`apps/web/app/api/resumes/[resumeId]/suggestions/feedback/route.ts`):
- Auth + ownership check (same pattern as other routes)
- Body: `{ suggestionId, helpful, reason?, reasonText?, category, provider?, model?, promptVersion? }`
- Creates `SuggestionFeedback` record
- Returns 200

### UI Changes

**TailoringPanel** (`apps/web/app/builder/_analysis/tailoring-panel.tsx`):
- After a suggestion is applied or dismissed, show a row with 👍/👎 buttons
- If 👎 is clicked, show the reason picker: "Too generic" | "Incorrect" | "Invented info" | "Doesn't match my writing" | "Other"
- If "Other" is selected, show a text input
- Feedback is POSTed to the feedback API on selection
- Add `provider` prop (from the parent — derived from `initializeAI()` config)

**SuggestionCard** (`apps/web/app/builder/_analysis/suggestion-card.tsx`):
- After a suggestion is accepted or rejected, show the same 👍/👎 feedback row
- Same reason picker flow on 👎
- Add `resumeId` prop to enable API calls

**HealthDashboard** (`apps/web/app/builder/_analysis/health-dashboard.tsx`):
- Pass `resumeId` to `SuggestionCard` for feedback
- Track feedback state per suggestion

### Files Created
- `prisma/migrations/20260705060000_add_suggestion_feedback/`
- `apps/web/app/api/resumes/[resumeId]/suggestions/feedback/route.ts`

### Files Modified
- `prisma/schema.prisma` — new model
- `apps/web/app/builder/_analysis/tailoring-panel.tsx` — feedback UI
- `apps/web/app/builder/_analysis/suggestion-card.tsx` — feedback UI
- `apps/web/app/builder/_analysis/health-dashboard.tsx` — pass resumeId, feedback state
- `apps/web/app/builder/_analysis/job-match-panel.tsx` — feedback UI
- `apps/web/app/builder/_analysis/types.ts` — add feedback types

---

## Phase 2 — Acceptance Analytics

### Database

**Extend `AnalysisRun`** with lifecycle counters:
```prisma
model AnalysisRun {
  // ... existing fields ...
  viewedCount    Int      @default(0)
  acceptedCount  Int      @default(0)   // user clicked Apply
  appliedCount   Int      @default(0)   // apply API succeeded
  rejectedCount  Int      @default(0)   // user dismissed
}
```

### Lifecycle Tracking

We need to track events that happen outside API routes (dismissals are client-side):

**New model — `SuggestionEvent`** (simpler than tracking directly on AnalysisRun):
```prisma
model SuggestionEvent {
  id            String   @id @default(cuid())
  suggestionId  String
  userId        String
  resumeId      String
  analysisRunId String?
  action        String   // "viewed" | "accepted" | "rejected" | "applied"
  category      String
  createdAt     DateTime @default(now())

  @@index([analysisRunId])
  @@index([userId, createdAt])
}
```

**`POST /api/resumes/:resumeId/suggestions/event`** — lightweight action logger:
- Auth + ownership check
- Body: `{ suggestionId, action, category, analysisRunId? }`
- Creates `SuggestionEvent` record
- Returns 200 (fire-and-forget)

### Analytics API

**`GET /api/analytics/acceptance`** (new route):
- Auth check (user or admin)
- Returns aggregated metrics:

```json
{
  "overall": {
    "total": 150,
    "accepted": 90,
    "applied": 85,
    "rejected": 40,
    "viewed": 120,
    "acceptanceRate": 0.75
  },
  "byCategory": {
    "summary": { "total": 20, "acceptanceRate": 0.60 },
    "experience": { "total": 50, "acceptanceRate": 0.55 },
    "skills": { "total": 40, "acceptanceRate": 0.95 },
    "ats": { "total": 15, "acceptanceRate": 0.70 },
    "grammar": { "total": 15, "acceptanceRate": 0.80 },
    "impact": { "total": 10, "acceptanceRate": 0.50 }
  },
  "rejectionReasons": {
    "too_generic": 12,
    "incorrect": 5,
    "invented": 3,
    "doesnt_match": 15,
    "other": 5
  }
}
```

### Client-side Tracking

In the UI, fire SuggestionEvent API calls for:
- When Review modal opens → "viewed"
- When Apply succeeds → "applied"
- When Dismiss is clicked → "rejected"

Accepted is derived: any applied event had an accept action preceding it.

### Files Created
- `prisma/migrations/20260705060001_add_analysis_run_counters/`
- `apps/web/app/api/resumes/[resumeId]/suggestions/event/route.ts`
- `apps/web/app/api/analytics/acceptance/route.ts`

### Files Modified
- `prisma/schema.prisma` — new SuggestionEvent model, extend AnalysisRun
- `apps/web/app/builder/_analysis/tailoring-panel.tsx` — fire events on view/reject/apply
- `apps/web/app/builder/_analysis/health-dashboard.tsx` — fire events
- `apps/web/app/builder/_analysis/job-match-panel.tsx` — fire events

---

## Phase 3 — Explainability

### What changes

The `TailorSuggestion` type already has `reason` and `confidence`. The UI already shows them. What we improve:

1. **Confidence bar** — replace text "Confidence: 91%" with a visual colored bar (green ≥0.8, yellow ≥0.5, red <0.5)
2. **"Why" label** — add a prominent "Why this change" header above the reason text in the diff view
3. **Reason in diff modal** — the `SuggestionDiffModal` already shows `reason` — enhance with a "Why this suggestion" section with a notable heading

### Files Modified
- `apps/web/app/builder/_analysis/tailoring-panel.tsx` — confidence bar component, "Why" section
- `apps/web/app/builder/_analysis/suggestion-card.tsx` — confidence bar + reason prominence
- `apps/web/components/suggestion-diff-modal.tsx` — "Why" section with labeled heading

### UI Component

Create a shared **`ConfidenceBar`** component:

```tsx
function ConfidenceBar({ confidence, showLabel }: { confidence: number; showLabel?: boolean }) {
  // Green bar if >= 0.8, yellow if >= 0.5, red otherwise
  // Optional "Confidence: 91%" label beside the bar
}
```

### Files Created
- `apps/web/components/confidence-bar.tsx`

---

## Phase 4 — Safety Review

### Post-processing Enhancement

**`packages/ai/src/tailoring/post-process.ts`** — add safety flag detection:

```ts
export interface SafetyFlag {
  type: "fabricated_metric" | "leadership_inflation" | "responsibility_expansion";
  message: string;
}
```

Detection rules:
- **fabricated_metric**: already detected (new numbers in `after` not in `before`)
- **leadership_inflation**: detect if weak verbs ("Assisted", "Participated", "Helped") are replaced with strong ones ("Led", "Directed", "Managed") without evidence
- **responsibility_expansion**: detect if `after` adds specific responsibilities not mentioned in `before`

The post-process function returns `(validated: TailorSuggestion[], flags: SafetyFlag[])` or better, attaches `safetyFlags` to each suggestion.

Add `safetyFlags` to `TailorSuggestion` type.

### UI Warning Badge

In `TailoringPanel`, when a suggestion has safety flags, show:

```
⚠ Review carefully — This change adds content not present in your original resume.
```

At the top of the suggestion card, above the diff, in a yellow/warning color.

Reduced confidence (already at 0.3 for fabricated metrics) should also affect the confidence bar color.

### Files Modified
- `packages/ai/src/tailoring/types.ts` — add `SafetyFlag` type, add to `TailorSuggestion`
- `packages/ai/src/tailoring/post-process.ts` — add safety detection
- `packages/ai/src/tailoring/index.ts` — wire safety flags through
- `apps/web/app/builder/_analysis/tailoring-panel.tsx` — safety warning badge
- `apps/web/app/builder/_analysis/suggestion-card.tsx` — safety warning badge

### Files Created
- `packages/ai/__tests__/tailoring/safety.test.ts` — safety flag tests

---

## Phase 5 — Evaluation Suite

### Structure

```
scripts/eval/
  run.ts                    — CLI runner: npm run eval -- --gap --tailor
  datasets/
    README.md               — How to add datasets
    resumes.json             — Array of 15 initial resume fixtures (expandable)
    job-descriptions.json    — Array of 15 matching JD fixtures
  reporters/
    console.ts              — Console table output
    json.ts                 — JSON file output for CI integration
```

### What it Tests

For each (resume, JD) pair, the runner:

1. Loads the resume JSON and normalizes it
2. Runs `deterministicAnalyzeJob` on the JD → validates output is well-formed
3. Runs `deterministicGapAnalysis` → validates match score 0–100, skills arrays
4. Runs `deterministicTailor` → validates suggestions have required fields
5. When `AI_DEFAULT_PROVIDER=gemini` or `=groq`, also runs AI-powered versions
6. Measures latency per call
7. Reports pass/fail per test case

### Output

```
┌──────────────┬──────┬────────┬──────────┬──────────────────┐
│ Test Case    │ Pass │ Latency│ AI Valid │ Output Well-formed │
├──────────────┼──────┼────────┼──────────┼──────────────────┤
│ resume-01    │  ✓   │  120ms │   ✓      │        ✓          │
│ resume-02    │  ✓   │   95ms │   ✓      │        ✓          │
│ ...          │      │        │          │                   │
└──────────────┴──────┴────────┴──────────┴──────────────────┘

Summary: 15/15 passed | Avg latency: 105ms | AI runs: 15
```

### Files Created
- `scripts/eval/run.ts`
- `scripts/eval/datasets/README.md`
- `scripts/eval/datasets/resumes.json`
- `scripts/eval/datasets/job-descriptions.json`
- `scripts/eval/reporters/console.ts`
- `scripts/eval/reporters/json.ts`

### Files Modified
- `package.json` — add `"eval": "tsx scripts/eval/run.ts"` script
- `tsconfig.base.json` — add path for `@careerlaunch/ai` (already exists)

---

## Explicitly Deferred (Not in this sprint)

- Performance dashboard UI (logging is enough)
- Prompt version management UI (store version metadata internally, no interface)
- Additional AI providers
- More resume templates
- DOCX export
- Interview preparation

---

## Success Criteria

By sprint end:
1. ✅ Users can rate AI suggestions with 👍/👎 and provide reason
2. ✅ Rejection reasons are persisted and analyzable
3. ✅ Acceptance rates are tracked per category
4. ✅ AI suggestions show confidence bars and explain their reasoning
5. ✅ Risky rewrites show safety warning badges
6. ✅ Evaluation suite runs against 15+ resume/JD pairs
7. ✅ All existing tests still pass (162 AI + 41 web + 13 domain = 216)
8. ✅ TypeScript passes across all workspaces
9. ✅ Build passes

---

## Migration

Two new migrations:
1. `20260705060000_add_suggestion_feedback` — creates `SuggestionFeedback` and `SuggestionEvent` tables
2. `20260705060001_add_analysis_run_counters` — adds `viewedCount`, `acceptedCount`, `appliedCount`, `rejectedCount` to `AnalysisRun`

---

## Test Plan

| Module | New Tests | Type |
|--------|-----------|------|
| Post-process safety flags | 6 | Unit |
| Feedback API route | 4 | Integration (stub) |
| Event API route | 3 | Integration (stub) |
| Analytics acceptance API | 3 | Integration (stub) |
| Evaluation suite | 15 | Script-based |

Existing coverage: 216 tests must continue to pass.
