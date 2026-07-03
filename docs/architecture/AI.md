# AI Architecture

Last updated: 2026-07-03

## Design Principles

```text
AI never writes directly to the resume.
AI produces suggestions.
User explicitly accepts or rejects.
Resume remains the source of truth.
```

| Principle | Rationale |
|----------|-----------|
| Read-only analysis | Analysis is cacheable, cheap, and non-destructive. Regeneration is never required. |
| Suggestions, not edits | Suggestions can be grouped, compared, accepted, rejected, or edited before applying. |
| Explicit user approval | Prevents surprise changes. Builds trust. Makes undo trivial (just don't apply). |
| Resume is source of truth | The resume document is never auto-modified. AI output is stored separately as suggestions. |

## Analysis Pipeline

```
Resume
   │
   ▼
Normalize
   │
   ├─── Static Analysis  (deterministic, no AI call)
   │       Section completeness, character counts, missing fields,
   │       email/phone present, date order, formatting consistency
   │
   ├─── AI Analysis      (LLM call per dimension)
   │       ATS scoring, grammar, impact statements, keyword density,
   │       summary quality, tone consistency
   │
   ▼
Merge Findings
   │
   ▼
Priority Ranking
   │
   ▼
Suggestion Set  ← stored in DB, tied to resume version
```

**Static analysis runs first and always.** It covers checks that require no AI: missing email, empty sections, short summaries, date gaps, inconsistent formatting. These are fast, free, and deterministic.

**AI analysis runs per dimension.** Each dimension is a separate small prompt (see Prompt Architecture below). Dimensions can run in parallel. Results are merged in application code.

**Static + AI findings merge into a single suggestion set.** There is no distinction at the suggestion level — the schema is the same whether a finding came from a regex or an LLM.

## Suggestion Schema

Every suggestion, regardless of source (static or AI), follows a single schema:

```typescript
interface Suggestion {
  /** Unique stable identifier for deduplication */
  id: string;

  /** Which part of the resume this applies to */
  category:
    | "summary"
    | "experience"
    | "education"
    | "skills"
    | "contact"
    | "formatting"
    | "ats"
    | "grammar"
    | "impact"
    | "keywords"
    | "completeness";

  /** How important this is to fix */
  severity: "critical" | "major" | "medium" | "minor" | "info";

  /** Short user-facing headline */
  title: string;

  /** Longer explanation of what is wrong and why it matters */
  reason: string;

  /** Exact text this suggestion targets (null for whole-resume issues) */
  targetText: string | null;

  /** Suggested replacement (null for informational suggestions) */
  suggestedText: string | null;

  /** Section and field path this applies to */
  location: {
    sectionId: string;        // "summary" | "experience" | etc.
    entryId?: string;         // specific job/education entry
    field?: string;           // "bullets[2]" | "jobTitle" | etc.
  };

  /** Model's confidence in this suggestion (0–1) */
  confidence: number;

  /** Whether this came from static analysis or AI */
  source: "static" | "ai";

  /** Human-readable label for which AI provider/model generated this */
  modelInfo?: string;
}
```

### Suggestion Status

```typescript
type SuggestionStatus =
  | "pending"     // shown to user, awaiting decision
  | "accepted"    // user accepted (may or may not be applied yet)
  | "applied"     // applied to the resume
  | "rejected"    // user dismissed
  | "dismissed";  // auto-dismissed (e.g., superseded by another change)
```

Suggestions are stored in the database linked to a resume version. This means:

- Analysis is a snapshot tied to a specific resume state.
- Re-analysis after edits produces a new suggestion set; old ones are archived.
- Users can review past analysis results.

## Provider Abstraction

```typescript
interface AIProvider {
  /** Human-readable name for display */
  readonly name: string;

  /** Analyze a specific dimension */
  analyze(
    dimension: AnalysisDimension,
    input: AnalysisInput,
    options?: AnalysisOptions
  ): Promise<AnalysisResult>;

  /** Check if the provider is available (rate limits, auth, etc.) */
  healthCheck(): Promise<ProviderHealth>;
}

type AnalysisDimension =
  | "ats"
  | "grammar"
  | "impact"
  | "keywords"
  | "summary"
  | "tone";

interface AnalysisInput {
  resume: NormalizedResume;
  /** Job description, if provided by the user */
  jobDescription?: string;
}

interface AnalysisOptions {
  signal?: AbortSignal;
  maxRetries?: number;
}
```

### Provider Registry

```typescript
// providers/index.ts
const registry = new Map<string, AIProvider>();

function registerProvider(name: string, provider: AIProvider): void { ... }
function getProvider(name?: string): AIProvider {
  // Returns the configured default, or a named provider
}
```

### Implemented Providers

| Provider | Status | Use Case |
|----------|--------|----------|
| Mock | Always available | Tests, development, demo mode |
| OpenAI | Planned | Primary provider for production |
| Anthropic | Planned | Fallback / comparison |
| Gemini | Future | Cost-sensitive tier |
| Local (Ollama) | Future | Offline development, privacy-sensitive deployments |

## Prompt Architecture

### Design

Small, focused prompts per dimension rather than one giant prompt. This provides:

- **Testability**: Each prompt is independently testable with known inputs and expected outputs.
- **Caching**: Dimension-level results can be cached independently; changing one prompt invalidates only that dimension's cache.
- **Cost**: Dimensions that don't need LLM analysis (or where static analysis suffices) skip the call entirely.
- **Parallelism**: Independent dimensions run concurrently.

### Dimensions and Prompts

```text
ats/
  prompt.md          — "Score this resume for ATS compatibility..."
  schema.ts          — Zod schema for the structured response

grammar/
  prompt.md          — "Identify grammatical errors in this resume..."
  schema.ts

impact/
  prompt.md          — "Rate each bullet point for measurable impact..."
  schema.ts

keywords/
  prompt.md          — "Extract keywords from this resume, compare to target..."
  schema.ts          — Only called when a job description is provided

summary/
  prompt.md          — "Evaluate the professional summary for clarity and impact..."
  schema.ts

tone/
  prompt.md          — "Assess tone consistency across sections..."
  schema.ts

completeness/
  prompt.md          — Static analysis (no prompt needed)
```

### Prompt Versioning

Each prompt directory contains a version manifest:

```typescript
interface PromptVersion {
  id: string;           // "ats-v2"
  prompt: string;       // The actual prompt text
  model: string;        // "gpt-4o" — which model this prompt was tuned for
  schema: object;       // Expected response JSON schema
  created: string;      // ISO date
  changelog: string;    // What changed from the previous version
}
```

Prompts are versioned assets, not scattered strings. A prompt change is a code review.

## Response Validation

### Three-Layer Validation

```
Raw LLM Output
      │
      ▼
Layer 1: Parse
  - Attempt JSON parse
  - Reject malformed output
  - Retry with corrective prompt (1 attempt)
      │
      ▼
Layer 2: Validate
  - Check against Zod schema
  - Reject if type/required fields missing
  - Reject if scores out of range (e.g., ATS score > 100)
      │
      ▼
Layer 3: Sanity
  - Reject contradictions (e.g., "no errors" + specific errors listed)
  - Reject if response is empty or trivial
  - Reject if response is a refusal or disclaimer
      │
      ▼
Store or Fallback
```

### Fallback Strategy

| Failure | Behavior |
|---------|----------|
| Parse error | Retry with "Your response was not valid JSON. Only return the JSON object." |
| Validation failure | Log the raw response. Return a partial result with `confidence: 0`. |
| Sanity failure | Log. Return an error for that dimension; other dimensions still work. |
| All retries exhausted | Return `null` for that dimension. Surface a subtle error indicator. |
| Provider unavailable | Try next provider in the chain. If none work, return null. |

The key design choice: **one dimension failing does not block the others.** A grammar timeout should not prevent ATS scoring from displaying.

## Caching Strategy

### Cache Rules

| Dimension | Cache TTL | Cache Key Basis | Rationale |
|-----------|----------|----------------|-----------|
| Static analysis | No cache | — | Free to compute every time |
| ATS score | 1 hour | Resume hash | Changes only when resume changes |
| Grammar | 1 hour | Resume hash + changed sections | Most errors are stable between edits |
| Impact | 24 hours | Resume hash | Slow to change; expensive to recompute |
| Keywords | 1 hour | Resume hash + JD hash | Depends on both resume and job description |
| Summary | 1 hour | Resume summary text hash | Only the summary field matters |
| Tone | 24 hours | Resume hash | Stable across minor edits |

**Cache invalidation**: When a resume section is modified, only the caches for that section and dimensions that reference it are invalidated. Changing a bullet point under "experience" does not invalidate the "contact" or "summary" caches.

**Cache storage**: In-memory for active sessions (Redis/Memcache only if analysis latency becomes a problem in production).

## Cost Controls

### Per-Request Limits

| Dimension | Max Tokens (output) | Max Retries | Timeout |
|-----------|-------------------|-------------|---------|
| ATS | 500 | 1 | 10s |
| Grammar | 1000 | 1 | 15s |
| Impact | 1500 | 1 | 20s |
| Keywords | 800 | 1 | 15s |
| Summary | 500 | 1 | 10s |
| Tone | 500 | 1 | 10s |

### Global Controls

| Control | Default | Description |
|---------|---------|-------------|
| Max analyses per user per day | 10 | Resets at midnight UTC |
| Max analyses per user per resume | 3 per day | Prevents repeated re-analysis of the same doc |
| Max tokens per analysis per user | 5000 | Combined across all dimensions |
| Concurrent analyses per user | 1 | Queue or block additional requests |
| Total daily budget | Configurable env var | Emergency stop if costs exceed threshold |

### User-Facing Display

- Show remaining daily analyses in the UI.
- Prompt the user to upgrade if they hit limits.
- Never silently degrade analysis quality to save cost — either run all dimensions or clearly show which are unavailable.

## Privacy

### Data Sent to AI Providers

| Field | Sent to AI? | Notes |
|-------|------------|-------|
| Contact info (name, email, phone) | Yes | Required for ATS/grammar analysis |
| Work history | Yes | Required for impact/tone/gap analysis |
| Education | Yes | Required for completeness |
| Skills | Yes | Required for keyword analysis |
| Job description (user-provided) | Yes | Required for keyword matching |
| User account ID | No | Never sent |
| Payment/financial data | No | Never in resume data |
| Other user's data | No | Analysis is single-resume only |

### Privacy Controls

- Opt-out setting per user: "Analyze resume locally only" (skips AI dimensions, uses static analysis only).
- Data retention: AI providers do not train on submitted data (opt-out headers set per request).
- Anonymize option: Strips names and contact info before sending to AI (reduces ATS accuracy but improves privacy).
- Logging: Analysis inputs are never logged in plain text. Sanitized summaries only.
- Provider selection: Users on enterprise plans can restrict analysis to local models only.

## Retry and Fallback Behavior

```text
Request
   │
   ▼
Provider health check
   │
   ├── Healthy ──► Send request with AbortSignal timeout
   │                  │
   │                  ├── Success ──► Validate ──► Return result
   │                  │
   │                  ├── Timeout ──► Retry (1×) ──► Fail → fallback provider
   │                  │
   │                  ├── Rate limited ──► Wait + retry (1×) ──► Fail → fallback
   │                  │
   │                  └── Error ──► Retry (1×) ──► Fail → fallback
   │
   └── Unhealthy ──► Fallback provider
                         │
                         ├── Available ──► Route request
                         │
                         └── Unavailable ──► Return null for this dimension
```

**Provider chain**: Attempt providers in priority order. If the primary provider fails, try the secondary. If both fail, return null.

**Graceful degradation**:
- `null` for a dimension means "not available right now."
- The UI shows a subtle warning icon but does not block other dimensions.
- Users can manually retry after a cooldown period.

## Structured Response Schemas

Each dimension returns a typed, validated response. Here are the base schemas:

### ATS Score Response

```typescript
interface ATSAnalysis {
  score: number;                    // 0–100
  breakdown: {
    formatting: number;             // 0–100
    keywords: number;               // 0–100
    sections: number;               // 0–100
    readability: number;            // 0–100
  };
  missingElements: string[];        // e.g., ["No education section"]
  warnings: string[];               // e.g., ["Tables detected — may confuse ATS"]
}
```

### Grammar Response

```typescript
interface GrammarAnalysis {
  errors: Array<{
    text: string;                   // The problematic text
    correction: string;             // Suggested fix
    type: "spelling" | "grammar" | "punctuation" | "style";
    position: { start: number; end: number };
  }>;
  overallScore: number;             // 0–100
}
```

### Impact Response

```typescript
interface ImpactAnalysis {
  statements: Array<{
    text: string;
    hasMetric: boolean;
    hasActionVerb: boolean;
    verb: string | null;            // The action verb used
    suggestedVerb?: string;         // Improvement suggestion
    score: number;                  // 0–100
  }>;
  overallScore: number;
  weakVerbs: string[];              // e.g., ["was responsible for", "helped"]
  strongVerbsUsed: string[];        // e.g., ["engineered", "optimized"]
}
```

### Keywords Response

```typescript
interface KeywordAnalysis {
  present: string[];                // Keywords in both resume and JD
  missing: string[];                // Keywords in JD but not in resume
  density: Record<string, number>;  // Keyword → frequency in resume
  topMatchScore: number;            // 0–100
}
```

### Summary Response

```typescript
interface SummaryAnalysis {
  score: number;                    // 0–100
  feedback: string;
  suggestions: Array<{
    original: string;
    improved: string;
    reason: string;
  }>;
  wordCount: number;
  hasMetrics: boolean;
  length: "too-short" | "optimal" | "too-long";
}
```

### Combined Analysis Result

```typescript
interface AnalysisResult {
  resumeId: string;
  resumeVersion: number;
  analyzedAt: string;               // ISO date

  ats: ATSAnalysis | null;
  grammar: GrammarAnalysis | null;
  impact: ImpactAnalysis | null;
  keywords: KeywordAnalysis | null;
  summary: SummaryAnalysis | null;
  tone: ToneAnalysis | null;

  /** Aggregated from all non-null dimensions */
  overallScore: number;

  /** All suggestions across all dimensions, merged and ranked */
  suggestions: Suggestion[];

  metadata: {
    duration: number;                // ms
    providersUsed: string[];         // Which providers were actually called
    dimensionsFailed: string[];      // Dimensions that returned null
  };
}
```

## Folder Structure

```text
packages/ai/
  src/
    providers/
      index.ts           — Registry and provider resolution
      types.ts           — AIProvider interface
      openai.ts          — OpenAI implementation
      anthropic.ts       — Anthropic implementation
      mock.ts            — Mock provider for tests and demos

    analysis/
      index.ts           — Orchestrator: runs all dimensions, merges results
      types.ts           — Analysis dimensions, input/output types
      normalize.ts       — Resume normalization before analysis
      ats.ts             — ATS dimension orchestrator
      grammar.ts         — Grammar dimension orchestrator
      impact.ts          — Impact dimension orchestrator
      keywords.ts        — Keywords dimension orchestrator
      summary.ts         — Summary dimension orchestrator

    prompts/
      ats/
        v1.md            — Prompt text
        schema.ts        — Zod schema for response
      grammar/
        v1.md
        schema.ts
      impact/
        v1.md
        schema.ts
      keywords/
        v1.md
        schema.ts
      summary/
        v1.md
        schema.ts

    validators/
      index.ts           — Validate response against its schema
      sanitize.ts        — Sanity checks

    cache/
      index.ts           — Cache abstraction (in-memory, Redis later)
      keys.ts            — Cache key generation

    scoring/
      index.ts           — Overall score computation from dimensions
      weights.ts         — Dimension weights for overall score

    suggestion/
      index.ts           — Build Suggestion[] from analysis results
      ranking.ts         — Priority ranking logic

    index.ts             — Public API: analyze(), getProvider(), etc.

  __tests__/
    analysis/
      ats.test.ts
      grammar.test.ts
      impact.test.ts
      keywords.test.ts
    providers/
      mock.test.ts
      openai.test.ts
    scoring.test.ts
    suggestion.test.ts
    normalize.test.ts

  package.json
  tsconfig.json
```

## Integration with Existing Architecture

### Data Flow

```
apps/web/
  features/
    builder/
      action.ts          — Save resume → trigger analysis (async)
    resume-checker/       ← New feature directory
      page.tsx            — Analysis results page
      components/
        SuggestionsList.tsx
        SuggestionCard.tsx
        HealthDashboard.tsx
        ScoreGauge.tsx
      actions.ts          — Accept/reject suggestion server actions
      hooks.ts            — useAnalysis, useSuggestions
```

### Database Additions

New tables:

- `ResumeAnalysis`: Stores analysis results (JSON) for a resume version.
- `Suggestion`: Individual suggestions with status (pending/accepted/rejected).
- `AnalysisQuota`: Per-user daily analysis usage tracking.

### Existing Code Integration

- **prisma/schema.prisma**: Add ResumeAnalysis, Suggestion, AnalysisQuota models.
- **packages/domain**: Add analysis types, suggestion status types, quota validation schemas.
- **apps/web**: Add the resume-checker feature route, server actions, and UI components.

## What We Are NOT Building Yet

These are explicitly deferred to Sprint 3B and beyond:

| Feature | Rationale |
|---------|-----------|
| AI bullet rewrite | Requires generation, not just analysis. Deferred to 3B. |
| AI summary rewrite | Generation. Deferred to 3B. |
| Cover letter generation | Builds on resume + JD analysis. Deferred to 3D. |
| Job description parsing | Useful but not needed for 3A. Deferred to 3C. |
| Interview coaching | Entirely separate feature. Not in current roadmap. |
| Streaming UI for AI output | Adds complexity without immediate benefit. |
| Conversation/multi-turn | Not needed for single-shot analysis. |

## Success Criteria

Sprint 3A is complete when:

| Criterion | Verification |
|-----------|-------------|
| Resume can be analyzed (static + AI) | All dimensions return results for a valid resume |
| Suggestions follow a single schema | Every suggestion passes the Suggestion type check |
| User can accept or reject each suggestion | Server actions update suggestion status; resume is only modified on explicit accept |
| Resume is never modified automatically | No code path exists that writes to resume document from analysis code |
| AI provider can be swapped | Mock → OpenAI swap requires changing one config value |
| Static analysis runs without AI calls | Disconnect from all AI providers — completeness and formatting checks still work |
| Analysis results are cacheable | Same resume analyzed twice within TTL returns cached results |
| Quota enforcement works | User hitting daily limit gets clear messaging and cannot analyze further |
| One dimension failure doesn't block others | Grammar returns null → other dimensions still display |
| Documentation is updated | This document, ARCHITECTURE.md, ROADMAP.md, CHANGELOG.md, PROJECT_STATUS.md |
| Tests pass | Unit, integration, and type checks for all new code |

## Future Considerations

Items to revisit in later sprints:

- **Streaming analysis results** into the UI as each dimension completes (nice-to-have, not MVP).
- **Batch analysis** — analyzing multiple saved resumes at once for dashboard comparison.
- **Analysis history** — showing how scores changed over time as the user improved their resume.
- **Multi-language support** — grammar analysis is language-specific; prompts and validators need locale awareness.
- **Custom weighting** — letting users prioritize dimensions differently (e.g., "I care most about ATS compatibility").
- **Template-specific analysis** — some templates format sections differently; analysis should be template-aware.
