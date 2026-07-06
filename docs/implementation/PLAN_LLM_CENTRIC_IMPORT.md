# Plan: LLM-Centric Import Pipeline

## Problem

The current import pipeline is parser-centric:

```
Raw text → Parser → Gap detection → LLM patches gaps → Merge
```

This produces:
- **Broken skills**: `"AWS (EC2"`, `"S3"`, `"Lambda)"` instead of `"AWS (EC2, S3, Lambda)"`
- **Category headers in skills**: `"Frontend"` mixed into the skills array
- **Empty sections rendered**: Certifications shows nothing but still renders
- **Weak summaries preserved verbatim**: Instead of improving them
- **Professional qualities look unfinished**: Rendered as raw joined text
- **Parser effort wasted on non-contact fields** that the LLM handles better

## Design

Flip the pipeline to be LLM-centric:

```
Raw text → LLM (full structured extraction) → Canonical model → Polish pass
         └→ Parser (contact only — regex is fast & reliable for email/phone/name)
```

The deterministic parser handles **only contact info** (email, phone, name, location —
fields where regex is both faster and more reliable than an LLM).

The LLM handles **everything else** — extracting structured data from the raw text
into the canonical `ResumeDocument` format.

The parser's section-level output serves only as a **fallback** if the LLM call fails.

## Changes

### 1. Rewrite recovery prompt → extraction prompt (`packages/ai/src/import/recovery.ts`)

**Current prompt** instructs the LLM to:
- "Preserve the exact wording from the original text"
- "Do NOT invent, infer, or rewrite content"
- Only fill gaps the parser missed

**New prompt** instructs the LLM to:
- "Extract ALL structured information from the resume text below"
- Produce clean, categorized output (no parser artifacts)
- **For skills**: output as `{ category, items[] }` with atomic skill names.
  Fix broken tokens: `"AWS (EC2"` → `{ category: "Cloud / Infra", items: ["AWS (EC2, S3, Lambda)", "Docker", "CI/CD"] }`
- **For summary**: clean up weak phrasing but keep all factual info.
  `"Highly motivated professional seeking..."` becomes something professional.
- **For certifications**: extract as clean strings. Never output empty arrays.
- **For professional qualities**: extract as clean bullet strings. Never output empty arrays.
- Omit any section key that has no data — no empty arrays.

### 2. Fix mergeRecovery flattening (`packages/ai/src/import/recovery.ts`)

**Current behavior**: Flattens categorized skills to `"Frontend: React"` format strings.

**New behavior**:
- Skills: flatten to clean atomic items without category prefixes:
  `["React", "TypeScript", "Node.js"]` — not `["Frontend: React", "Frontend: TypeScript"]`
- Preserve `recoveredSkillCategories` for the grouped pill UI in the import preview
- AI recovery runs on **all sections** (not just low-coverage ones) when triggered
- Empty sections from AI → keep empty in domain model but don't render UI for them

### 3. Fix import preview UI (`apps/web/app/import/page.tsx`)

- **Empty sections**: Don't render certifications / professional qualities / projects
  blocks when the arrays are empty
- **Professional qualities**: Render as proper bullet list (same as certification style),
  not as joined text with `·` separators
- **No debug-looking output**: Every section should look intentional

### 4. Update golden file (`resume-marc-style.expected.json`)

Regenerate to reflect the new clean skills output.

No golden file changes to other fixtures — only the marc-style fixture has
table-format skills that produce broken tokens.

### 5. Run full test suite

- `npm run test` — unit + golden file tests
- Verify AI recovery tests pass (they test mergeRecovery logic)
- Manually test the import flow with the marc-style resume

## What stays the same

- The `resume-skills-qualities.expected.json` fixture has comma-separated inline
  skills and should parse identically — no change expected
- Contact extraction remains regex-based (fast, reliable)
- Experience/education/project/structure parsing stays as fallback
- The API route handler (`apps/web/app/api/import/text/route.ts`) stays the same
- The import page interaction model (paste → parse → preview → create draft) stays

## Risks

**LLM cost**: An LLM call on every import (even well-formatted resumes) costs more
than the current gap-only approach. Mitigation: skip LLM entirely when the parser
achieves >= 90% coverage on all critical sections (experience, education, skills).

**Latency**: LLM calls take 2-5 seconds. Mitigation: show a spinner with
"Reading your resume..." which already exists.

**Hallucination risk**: LLM might invent skills/experience not in the original.
Mitigation: the prompt explicitly says "only include information present in the
source text" and the fallback path preserves parser output.

## Files changed

| File | Change |
|------|--------|
| `packages/ai/src/import/recovery.ts` | Rewrite prompt, fix mergeRecovery flattening |
| `packages/ai/src/import/text-parser.ts` | Minor fix: keep contact extraction, no section changes needed |
| `apps/web/app/import/page.tsx` | Empty section guards, professional qualities bullet rendering |
| `packages/ai/__fixtures__/resume-marc-style.expected.json` | Regenerate with clean skills |

## Verification

1. `npm run test` — all existing tests pass
2. Paste the marc-style resume → skills show as clean grouped pills (not broken tokens)
3. Paste a resume with no certifications → certifications section is hidden
4. Professional qualities render as bullet list (not joined text)
5. Summary is polished (not verbatim weak copy)
