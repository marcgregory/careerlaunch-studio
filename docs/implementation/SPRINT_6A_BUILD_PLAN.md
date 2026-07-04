# Sprint 6A Build Plan — Real AI Foundation

**Last updated:** 2026-07-05
**Status:** Draft — waiting for approval
**Target tag:** `v0.7.0-alpha`

---

## Overview

Replace the `MockProvider`-only AI layer with real LLM providers while keeping the existing architecture. The mock stays as the default for tests and dev, but the app can use Gemini (free tier) or Groq (free dev tier) in development and production.

### Provider Roadmap

```text
Development / Alpha
    ↓
Gemini API (free tier)     ← Sprint 6A
Groq (free dev tier)        ← Sprint 6A

Future (paid customers)
    ↓
OpenAI (GPT-5/GPT-5 mini)  ← Post-MVP
Claude (Sonnet 5)           ← Post-MVP
```

### Why this order

1. **Provider abstraction** first — ensures app code never depends on a specific vendor.
2. **Gemini** first (free tier, great JSON output, official SDK) — **Groq** second (fast, OpenAI-compatible endpoint).
3. **Prompts** extracted to files → independently testable and versioned.
4. **Structured output** validation → reliable typed responses from LLMs.
5. **Cost/rate/error** handling → production safety before public beta.

No job tailoring, no cover letter 2.0, no interview prep in this sprint.

---

## Current State (Before Sprint 6A)

### What exists

| Asset | Location | Notes |
|---|---|---|
| `AIProvider` interface | `packages/ai/src/providers/types.ts` | Single method: `analyze(dim, input)` + `healthCheck()` |
| Provider registry | `packages/ai/src/providers/index.ts` | Map-based, supports `registerProvider`/`getProvider`/`setDefaultProvider` |
| `MockProvider` | `packages/ai/src/providers/mock.ts` | Deterministic, covers all 6 dimensions, 417 lines |
| Cover letter generator | `packages/ai/src/cover-letter/generate.ts` | Standalone pure function, **not routed through provider** |
| Job match engine | `packages/ai/src/job-match/` | Dictionary-based, **not routed through provider** |
| Analysis orchestrator | `packages/ai/src/analysis/orchestrator.ts` | Calls `getProvider().analyze()` per dimension |
| Analysis types | `packages/ai/src/analysis/types.ts` | Rich typed schemas exist — always `null` in practice |
| Static analysis | `packages/ai/src/analysis/static.ts` | 440 lines, always runs first |
| Scoring | `packages/ai/src/scoring/index.ts` | Penalty-based from suggestion severity counts |
| Suggestion schema | `packages/ai/src/suggestion/types.ts` | Deterministic `suggestionId()` factory |
| AI.md architecture doc | `docs/architecture/AI.md` | **Visionary** — describes unbuilt openai.ts, anthropic.ts, prompts/, validators/, cache/ |

### What's missing

| Gap | Impact |
|---|---|
| No `generateCoverLetter()` on the provider interface | Cover letter generation bypasses the provider abstraction entirely |
| No `matchJob()` on the provider interface | Job match is dictionary-based, not AI-powered |
| No `tailorResume()` on the provider interface | Job tailoring cannot be routed through AI |
| No Gemini or Groq provider implementations | Production AI features are non-functional |
| No prompt files | All prompts are embedded in code |
| No structured output validation | LLM responses are unvalidated — UI trusts model output blindly |
| No API key env vars | `.env.example` has no `GEMINI_API_KEY` or `GROQ_API_KEY` |
| No LLM dependencies | `packages/ai/package.json` has zero AI SDK dependencies |
| No cost controls | No token counting, caching, or budget enforcement |
| No retry/backoff | Provider calls fail immediately on network error |
| MockProvider registered at import time | `registerProvider("mock", ...)` happens at module import in two route files — side-effect pattern |
| No dimension-level typed results populated | `AnalysisResult.ats`, `.grammar`, etc. are always `null` — only `suggestions` array is used |

### Key architectural decisions that survive this sprint

1. **`Suggestion` is the currency** — the UI only consumes `Suggestion[]`, not dimension-specific types. We keep this.
2. **Cover letter goes through the provider** — `generateCoverLetter()` moves onto `AIProvider`.
3. **Job match goes through the provider** — `matchJob()` moves onto `AIProvider`.
4. **Static analysis stays** — always runs first, produces `source: "static"` suggestions, needs no LLM.
5. **Orchestrator stays** — manages dimension parallelism, merge logic, dedup.
6. **Apply engine stays** — no changes needed.

---

## Plan

### Step 1 — Expand `AIProvider` interface (types only)

**File:** `packages/ai/src/providers/types.ts`

Add three new methods to the `AIProvider` interface:

```typescript
export interface AIProvider {
  readonly name: string;

  /** Existing: analyze a resume dimension */
  analyze(dimension: AnalysisDimension, input: AnalysisInput, options?: AnalysisOptions): Promise<DimensionResult>;

  /** New: generate a cover letter tailored to a job */
  generateCoverLetter?(input: CoverLetterInput): Promise<GeneratedCoverLetter>;

  /** New: AI-powered job match (replaces dictionary-based) */
  matchJob?(resume: NormalizedResume, jobDescription: string): Promise<JobMatchResult>;

  /** Existing: health check */
  healthCheck(): Promise<ProviderHealth>;
}
```

Use optional methods (`?`) so `MockProvider` doesn't need to implement all of them immediately — it can keep its deterministic versions. Real providers implement all.

**No app code changes.** The web layer already checks if features are enabled via entitlements; the provider method being optional is a compile-time safety net.

**Tests:** 0 new (interface change, no logic).

---

### Step 2 — Add `GEMINI_API_KEY` and `GROQ_API_KEY` to environment

**Files:** `.env.example`, `apps/web/.env.local`

```env
# AI Providers
GEMINI_API_KEY="AIza..."
GROQ_API_KEY="gsk_..."
AI_DEFAULT_PROVIDER="gemini"      # or "groq" or "mock"
```

Add validation: if `AI_DEFAULT_PROVIDER` is `"gemini"` but `GEMINI_API_KEY` is unset, log a startup warning and fall back to mock. Same for Groq.

Add to health-check endpoint.

**Tests:** 0 new.

---

### Step 3 — Add LLM dependencies to `packages/ai/package.json`

```json
{
  "dependencies": {
    "@careerlaunch/domain": "*",
    "@google/genai": "^1.x"
  }
}
```

Groq uses the OpenAI-compatible endpoint (`POST /v1/chat/completions`) so it only needs a generic fetch — no SDK required. `openai` and `@anthropic-ai/sdk` are added post-MVP.

Run `npm install`.

---

### Step 4 — Add AI SDK helpers (`packages/ai/src/lib/`)

**New file:** `packages/ai/src/lib/llm.ts`

Shared utilities used by both the Gemini and Groq providers:

```typescript
// Call an LLM with a system prompt + user message, return parsed JSON
export async function callGemini(config: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;  // JSON Schema for structured output
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}): Promise<unknown>;

export async function callOpenAICompatible(config: {
  baseUrl: string;                  // e.g. "https://api.groq.com/openai/v1"
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}): Promise<unknown>;
```

Both handle:
- Timeout via `AbortSignal`
- Retry (1 automatic retry on transient errors)
- JSON parsing from response
- Returns raw data (the provider-specific wrapper handles schema validation)

**New file:** `packages/ai/src/lib/tokens.ts`

Token counting utilities:
```typescript
export function estimateTokens(text: string): number;
export function truncateToTokens(text: string, maxTokens: number): string;
```

**Tests:** 2 new files, unit tests for token estimation and truncation.

---

### Step 5 — Implement `GeminiProvider`

**New file:** `packages/ai/src/providers/gemini.ts`

```typescript
export class GeminiProvider implements AIProvider {
  readonly name = "Gemini 2.5 Flash";

  constructor(config?: { model?: string; apiKey?: string });

  async analyze(dimension, input, options): Promise<DimensionResult>;
  async generateCoverLetter(input): Promise<GeneratedCoverLetter>;
  async matchJob(resume, jobDescription): Promise<JobMatchResult>;
  async healthCheck(): Promise<ProviderHealth>;
}
```

**Model:** `gemini-2.5-flash` (fast, cheap, great structured output via response_schema).

**Per-dimension prompts** are loaded from `packages/ai/prompts/{dimension}/v1.md`. Each prompt includes a `Respond with valid JSON only` instruction.

**Structured output:** Use Gemini's [`response_schema`](https://ai.google.dev/api/generate-content#request-body) parameter to request typed JSON directly — no parsing needed when the API returns structured output natively.

**Error handling:**
- Network errors → retry once with exponential backoff
- Rate limit (429) → wait suggested delay, retry once
- Invalid response → retry once with corrective prompt
- All failures → return `{ suggestions: [] }` with dimension added to `dimensionsFailed`

**`generateCoverLetter()`:**
- Load `packages/ai/prompts/cover-letter/v1.md`
- Inject resume data + optional job description
- Parse structured response: `{ salutation, body, closing }`

**`matchJob()`:**
- Load `packages/ai/prompts/job-match/v1.md`
- Inject resume + job description
- Parse structured response: `{ matchScore, missingSkills, presentSkills, suggestions }`
- Convert suggestions to `Suggestion[]` with `suggestionId()`

**Tests:** Full suite covering each dimension, cover letter, job match, error modes.

---

### Step 6 — Implement `GroqProvider`

**New file:** `packages/ai/src/providers/groq.ts`

```typescript
export class GroqProvider implements AIProvider {
  readonly name = "Groq (Llama 4)";

  constructor(config?: { model?: string; apiKey?: string });

  async analyze(dimension, input, options): Promise<DimensionResult>;
  async generateCoverLetter(input): Promise<GeneratedCoverLetter>;
  async matchJob(resume, jobDescription): Promise<JobMatchResult>;
  async healthCheck(): Promise<ProviderHealth>;
}
```

**Model:** `llama-4-scout-17b-16e-instruct` (fast, free tier) or `mixtral-8x7b-32768`.

**API:** Groq serves an OpenAI-compatible API at `https://api.groq.com/openai/v1`. The `callOpenAICompatible()` helper from Step 4 handles the request format.

**Prompt reuse:** Same prompt files from `packages/ai/prompts/`. Both providers share the same prompts.

**JSON mode:** Use Groq's `response_format: { type: "json_object" }` parameter. Note: when `json_object` is enabled, the system message must contain "JSON" — our prompts already do.

**Tests:** Same coverage as Gemini, using mocked Groq responses.

---

### Step 7 — Extract prompts to `packages/ai/prompts/`

**New directory structure:**

```
packages/ai/
  prompts/
    ats/
      v1.md             — "Score this resume for ATS compatibility..."
    grammar/
      v1.md             — "Identify grammatical errors..."
    impact/
      v1.md             — "Rate each bullet point for measurable impact..."
    keywords/
      v1.md             — "Extract keywords from the resume and compare to job description..."
    summary/
      v1.md             — "Evaluate the professional summary..."
    tone/
      v1.md             — "Assess tone consistency..."
    cover-letter/
      v1.md             — "Generate a cover letter tailored to this job..."
    job-match/
      v1.md             — "Compare this resume to the job description..."
```

**Each prompt file** follows a consistent template:

```markdown
# Role
You are a professional resume expert. Analyze the provided resume carefully.

# Instructions
{task-specific instructions}

# Resume
{resume_json}

# Response Format
Respond ONLY with a valid JSON object matching this schema:
{schema}

Do not include any explanation, markdown formatting, or text outside the JSON.
```

**Prompt loader:**
```typescript
// packages/ai/src/lib/prompts.ts
export function loadPrompt(dimension: string, version?: string): string;
export function buildSystemPrompt(dimension: string, resume: NormalizedResume, jd?: string): { system: string; user: string };
```

Prompts are loaded from files at runtime. In production, they could be cached in memory.

**Testing:** Each prompt has a corresponding test that:
1. Loads the prompt file (succeeds)
2. Renders it with sample resume data (produces valid output)
3. Confirms it contains the required sections (Role, Instructions, Response Format)

---

### Step 8 — Add structured output validation

**New file:** `packages/ai/src/lib/validate.ts`

```typescript
export function validateDimensionResult(dimension: string, data: unknown): DimensionResult;
export function validateCoverLetter(data: unknown): GeneratedCoverLetter;
export function validateJobMatch(data: unknown): JobMatchResult;
```

Each validator:
1. Checks the data has the expected shape
2. Rejects scores outside valid ranges (0–100)
3. Rejects empty results (empty arrays for required fields)
4. Returns typed result or throws `ValidationError`

Partial results (some fields valid, some invalid) return with lowered `confidence` rather than throwing — better to show partial data than nothing.

**Integration with providers:** After `callGemini()`/`callOpenAICompatible()` returns raw JSON, each provider calls the validator before returning. If validation fails, the provider retries once with a corrective prompt. If still failing, returns `null` for that dimension.

**Tests:**
- Valid data passes
- Missing fields detected
- Out-of-range values rejected
- Empty arrays pass or fail per-field config
- Partial data returns partial result with lowered confidence

---

### Step 9 — Add cost controls (token tracking + retry/backoff)

**New file:** `packages/ai/src/lib/cost-control.ts`

```typescript
export interface CostConfig {
  maxTokensPerAnalysis: number;        // 5000
  maxRetries: number;                   // 1
  timeoutMs: number;                    // 15000 per dimension
  enableCaching: boolean;              // true
}

export function withCostControls<T>(fn: () => Promise<T>, config: CostConfig): Promise<T>;
```

`withCostControls` wraps any provider call:
1. Checks token budget before calling
2. Applies timeout
3. On failure → retry with backoff (200ms initial, 2× multiplier)
4. On success → deduct estimated tokens from budget
5. Logs token usage (console in dev, structured log in production)

**Cache (in-memory):**

```typescript
// packages/ai/src/lib/cache.ts
export function getCachedResult(key: string): unknown | null;
export function setCachedResult(key: string, value: unknown, ttlMs: number): void;
export function invalidateCache(pattern: string): void;
```

Cache key = `provider:dimension:resumeHash[:jdHash]`. TTL per dimension (1h for most, 24h for impact/tone).

**Tests:**
- Token budget enforced (throws beyond limit)
- Retry on transient error succeeds on second attempt
- Cache returns cached result for same key within TTL
- Cache miss returns null for new key

---

### Step 10 — Update initialization flow

**Current (side-effect at import time):**
- `apps/web/app/api/resumes/[resumeId]/analyze/route.ts:11` — `registerProvider("mock", new MockProvider())`
- `apps/web/app/api/resumes/[resumeId]/job-match/route.ts:17` — `registerProvider("mock", new MockProvider())`

**New — centralized:**

```typescript
// apps/web/lib/ai-config.ts
export function initializeAI(): void {
  const defaultProvider = process.env.AI_DEFAULT_PROVIDER || "mock";

  // Always register MockProvider as a fallback
  registerProvider("mock", new MockProvider());

  if (defaultProvider === "gemini" && process.env.GEMINI_API_KEY) {
    registerProvider("gemini", new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY }));
    setDefaultProvider("gemini");
  } else if (defaultProvider === "groq" && process.env.GROQ_API_KEY) {
    registerProvider("groq", new GroqProvider({ apiKey: process.env.GROQ_API_KEY }));
    setDefaultProvider("groq");
  } else {
    // Default to mock when credentials aren't configured
    setDefaultProvider("mock");
  }
}
```

Called once from `apps/web/lib/bootstrap.ts` (loaded by the first API route hit).

Remove the two inline `registerProvider("mock", ...)` calls from the route files.

**Tests:**
- `AI_DEFAULT_PROVIDER=gemini` + valid key → Gemini registered as default
- `AI_DEFAULT_PROVIDER=groq` but no key → Mock is default (startup warning logged)
- No config → Mock is default
- Existing analysis tests pass unchanged (they register MockProvider explicitly in test files)

---

### Step 11 — Update cover letter generator to use provider

**Modified file:** `packages/ai/src/cover-letter/generate.ts`

The current `generateCoverLetter()` is a pure function. It stays as the **fallback** for when no provider supports `generateCoverLetter()`.

```typescript
export async function generateCoverLetter(
  input: CoverLetterInput,
  options?: { providerName?: string },
): Promise<GeneratedCoverLetter> {
  const provider = options?.providerName ? getProvider(options.providerName) : getProvider();

  if (provider.generateCoverLetter) {
    return provider.generateCoverLetter(input);
  }

  // Fallback to deterministic template (existing logic)
  return deterministicGenerateCoverLetter(input);
}
```

The existing synchronous logic moves to `deterministicGenerateCoverLetter()`.

**Export:** Update `packages/ai/src/cover-letter/index.ts` — `generateCoverLetter` becomes async.

**Web route update:** `apps/web/app/api/resumes/[resumeId]/cover-letter/generate/route.ts` no change needed (already `async` function calling `generateCoverLetter()`).

**Tests:** Existing tests for deterministic generator still pass. New tests for provider path.

---

### Step 12 — Update job match to use provider

**Modified file:** `packages/ai/src/job-match/index.ts`

Same pattern as cover letter:

```typescript
export async function runJobMatch(
  input: JobMatchInput,
  options?: { providerName?: string },
): Promise<JobMatchResult> {
  const provider = options?.providerName ? getProvider(options.providerName) : getProvider();

  if (provider.matchJob) {
    return provider.matchJob(input.resume, input.jobDescription);
  }

  // Fallback to dictionary-based (existing logic)
  return deterministicRunJobMatch(input);
}
```

`runJobMatch` becomes async. The existing deterministic logic moves to `deterministicRunJobMatch()`.

**Web route update:** `apps/web/app/api/resumes/[resumeId]/job-match/route.ts` — already `async`, no structural change needed.

**Tests:** Existing tests move to test `deterministicRunJobMatch`. New tests for provider path.

---

### Step 13 — Update `packages/ai/src/index.ts` exports

```typescript
// New exports
export { GeminiProvider } from "./providers/gemini";
export { GroqProvider } from "./providers/groq";
export { callGemini, callOpenAICompatible } from "./lib/llm";
export { estimateTokens, truncateToTokens } from "./lib/tokens";
export { loadPrompt, buildSystemPrompt } from "./lib/prompts";
export { validateDimensionResult, validateCoverLetter, validateJobMatch } from "./lib/validate";
export { withCostControls, type CostConfig } from "./lib/cost-control";
export { getCachedResult, setCachedResult, invalidateCache } from "./lib/cache";
```

---

### Step 14 — Update documentation

**Files to update:**
- `docs/implementation/ROADMAP.md` — move Sprint 6A from "Sprint Queue" to "In Progress"
- `docs/implementation/PROJECT_STATUS.md` — mark Sprint 6A as active
- `docs/implementation/CHANGELOG.md` — add v0.7.0-alpha entry
- `.env.example` — add AI provider env vars
- `docs/architecture/AI.md` — update to reflect actual implementation (mark gemini.ts, groq.ts, prompts/ as done; down-prioritize openai.ts and anthropic.ts)

---

## Files to Create (17 files)

| File | Purpose |
|---|---|
| `packages/ai/src/providers/gemini.ts` | Gemini provider implementation |
| `packages/ai/src/providers/groq.ts` | Groq provider implementation |
| `packages/ai/src/lib/llm.ts` | Shared LLM call helpers (Gemini SDK + OpenAI-compatible) |
| `packages/ai/src/lib/tokens.ts` | Token estimation and truncation |
| `packages/ai/src/lib/prompts.ts` | Prompt loader and builder |
| `packages/ai/src/lib/validate.ts` | Structured output validator |
| `packages/ai/src/lib/cost-control.ts` | Token budget, retry/backoff |
| `packages/ai/src/lib/cache.ts` | In-memory result cache |
| `packages/ai/prompts/ats/v1.md` | ATS analysis prompt |
| `packages/ai/prompts/grammar/v1.md` | Grammar analysis prompt |
| `packages/ai/prompts/impact/v1.md` | Impact analysis prompt |
| `packages/ai/prompts/keywords/v1.md` | Keyword analysis prompt |
| `packages/ai/prompts/summary/v1.md` | Summary analysis prompt |
| `packages/ai/prompts/tone/v1.md` | Tone analysis prompt |
| `packages/ai/prompts/cover-letter/v1.md` | Cover letter generation prompt |
| `packages/ai/prompts/job-match/v1.md` | Job match analysis prompt |
| `apps/web/lib/ai-config.ts` | Centralized provider initialization |

## Files to Create — Tests (9 files)

| File | Purpose |
|---|---|
| `packages/ai/__tests__/providers/gemini.test.ts` | Gemini provider tests |
| `packages/ai/__tests__/providers/groq.test.ts` | Groq provider tests |
| `packages/ai/__tests__/lib/llm.test.ts` | LLM helper tests |
| `packages/ai/__tests__/lib/tokens.test.ts` | Token estimation tests |
| `packages/ai/__tests__/lib/prompts.test.ts` | Prompt loading tests |
| `packages/ai/__tests__/lib/validate.test.ts` | Validation tests |
| `packages/ai/__tests__/lib/cost-control.test.ts` | Cost control tests |
| `packages/ai/__tests__/lib/cache.test.ts` | Cache tests |
| `packages/ai/__tests__/lib/ai-config.test.ts` | Init flow tests |

## Files to Modify (14 files)

| File | Change |
|---|---|
| `packages/ai/src/providers/types.ts` | Add `generateCoverLetter?`, `matchJob?` to `AIProvider` |
| `packages/ai/src/cover-letter/generate.ts` | Async wrapper with provider delegation + fallback |
| `packages/ai/src/cover-letter/index.ts` | Update async export |
| `packages/ai/src/job-match/index.ts` | Async wrapper with provider delegation + fallback |
| `packages/ai/src/index.ts` | Add new exports |
| `packages/ai/package.json` | Add `@google/genai` dependency |
| `apps/web/app/api/resumes/[resumeId]/analyze/route.ts` | Remove inline `registerProvider("mock", ...)` |
| `apps/web/app/api/resumes/[resumeId]/job-match/route.ts` | Remove inline `registerProvider("mock", ...)` |
| `.env.example` | Add `GEMINI_API_KEY`, `GROQ_API_KEY`, `AI_DEFAULT_PROVIDER` |
| `apps/web/.env.local` | Add new env vars |
| `docs/architecture/AI.md` | Mark implemented files as done; note OpenAI/Claude as post-MVP |
| `docs/implementation/ROADMAP.md` | Status update |
| `docs/implementation/PROJECT_STATUS.md` | Status update |
| `docs/implementation/CHANGELOG.md` | Add v0.7.0-alpha |

## Files NOT Modified

| File | Reason |
|---|---|
| `packages/ai/src/analysis/orchestrator.ts` | Already uses `getProvider()` — no change needed |
| `packages/ai/src/analysis/static.ts` | Static analysis doesn't need LLMs |
| `packages/ai/src/analysis/normalize.ts` | Normalization is provider-agnostic |
| `packages/ai/src/apply/` | Apply engine is post-AI, no change needed |
| `packages/ai/src/operations/factory.ts` | Suggestion-to-operation mapping unchanged |
| `packages/ai/src/scoring/` | Scoring from suggestions unchanged |
| `packages/ai/src/suggestion/` | `suggestionId()` unchanged |
| `apps/web/lib/entitlements.ts` | Feature gates unchanged (already guard AI features) |
| All UI components | Front-end unchanged — still consumes `Suggestion[]` |
| PDF renderer | Unrelated |
| Billing/Stripe | Unrelated |

---

## Migration Path

1. **Step 1–3** — No behavior change. Types + deps only.
2. **Step 4** — Helpers added, unused until providers use them.
3. **Step 5–6** — Providers exist but aren't registered → inactive.
4. **Step 7** — Prompts exist but aren't loaded by anyone → inactive.
5. **Step 8** — Validators exist but aren't called → inactive.
6. **Step 9** — Cost controls exist but aren't wired → inactive.
7. **Step 10–13** — Wire everything together.
   - `AI_DEFAULT_PROVIDER=mock` (no env set) → everything works exactly as before.
   - `AI_DEFAULT_PROVIDER=gemini` + `GEMINI_API_KEY=AIza...` → real AI calls.
   - `AI_DEFAULT_PROVIDER=groq` + `GROQ_API_KEY=gsk_...` → real AI calls.

Every intermediate step is functional. No breakage between steps.

---

## Test Strategy

| Category | Count | What |
|---|---|---|
| Existing tests | 144 AI + 14 domain + 41 web | Must all still pass |
| Gemini provider | ~15 | Each dimension + cover letter + job match + error modes |
| Groq provider | ~15 | Same coverage as Gemini |
| LLM helpers | ~8 | Timeout, retry, JSON parsing, error wrapping |
| Token utilities | ~4 | Estimation accuracy, truncation |
| Prompt loading | ~8 | Each prompt file loads and renders properly |
| Validation | ~10 | Valid data, missing fields, out-of-range, partial |
| Cost control | ~6 | Budget enforcement, retry backoff, cache |
| Init flow | ~4 | Config → correct provider registered |
| **Total new tests** | **~70** | |
| **Grand total** | **~269** | |

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Gemini free tier rate limits | Medium | Retry with backoff; fallback to Mock on exhaustion; user-facing rate limits already exist |
| Groq free tier quota changes | Low | Same provider interface; swap to another provider is config-only |
| @google/genai SDK breaking changes | Low | Pin minor version; the `callLLM()` abstraction hides SDK details |
| Prompt quality poor with Gemini/Groq | Medium | Test per prompt with sample resumes; iterate in Step 7; both models handle structured JSON well |
| One provider fails for a dimension | Low | Retry → fallback → null dimension (graceful degradation) |
| Mock stops working | Low | Mock unchanged, always registered as fallback |
| Build breaks from new deps | Low | `@google/genai` is ESM-compatible; Groq uses plain `fetch` |

---

## Definition of Done

- [ ] `AIProvider` interface expanded with optional `generateCoverLetter()` and `matchJob()` methods
- [ ] `GeminiProvider` implements all methods, returns typed results, handles errors gracefully
- [ ] `GroqProvider` implements all methods, returns typed results, handles errors gracefully
- [ ] MockProvider unchanged, always registered as fallback
- [ ] All prompts extracted to `packages/ai/prompts/{dimension}/v1.md`
- [ ] Structured output validation catches malformed LLM responses
- [ ] Cost controls enforce token budget, retry/backoff, and caching
- [ ] Cover letter generator delegates to provider when available, falls back to deterministic
- [ ] Job match delegates to provider when available, falls back to dictionary-based
- [ ] Centralized `ai-config.ts` replaces inline registration in route files
- [ ] `.env.example` documents `GEMINI_API_KEY`, `GROQ_API_KEY`, `AI_DEFAULT_PROVIDER`
- [ ] All existing 199 tests pass unchanged
- [ ] ~70 new tests pass
- [ ] TypeScript, lint, and build pass across all workspaces
- [ ] `v0.7.0-alpha` tagged
- [ ] `ROADMAP.md`, `PROJECT_STATUS.md`, `CHANGELOG.md` updated
