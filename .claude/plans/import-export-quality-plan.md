
# Plan: Fix Imported Resume Rendering Quality

## Root Causes

After exploring the entire pipeline (text parser → import page → stored resume → template renderer → PDF export), I identified six concrete problems:

### 1. Skills dumped into Profile
The text parser's section detection only matches explicit section headers. If the imported text lists skills under "Professional Profile" or within a paragraph block with no `Skills` header, those skills are concatenated into the `summary` string and rendered as Profile paragraph text, not as skill chips.

### 2. Certifications / References / Professional Qualities merged
The parser has no section patterns for `references` or `professional qualities`. Those section headers are not matched, so their content falls into adjacent section boundaries. References end up in whatever section precedes them (often certifications or experience).

### 3. Experience dates/company dupes
`parseExperience()` has fragile splitting logic. When the text format is `Company — Role (2020–Present)`, the dash-split and "at"-split heuristics can produce company name in both `company` and `role` fields.

### 4. "Target Role" placeholder shown on imported resumes
Import page sets `targetRole: ""`, and both the preview renderer (`index.tsx:220`) and PDF renderer (`pdf.tsx:89`) render `resume.targetRole || "Target Role"`, showing an unwanted placeholder.

### 5. No references exclusion
The `ResumeDocument` type has no `references` field. References content from the import is not stored, not excluded — it silently contaminates neighboring sections.

### 6. No regression test for import quality
The `packages/ai/__tests__/` directory has no test for `parseResumeText()`.

---

## Changes

### A. Text Parser — `packages/ai/src/import/text-parser.ts`

**A1.** Add section header patterns for `references` and `professional_qualities`:

```ts
// In SECTION_PATTERNS
{
  id: "references",
  patterns: [/\breferences?\b/i],
},
{
  id: "professional_qualities",
  patterns: [/\bprofessional\s+qualities\b/i, /\bqualifications\b/i],
},
```

**A2.** In the `switch` in `parseResumeText()`, handle `references` by **skipping** its content (neither stored in output nor returned). Handle `professional_qualities` by storing as a `professionalQualities: string[]` field (map to certifications or separate array). For now, professional qualities go into `certifications` as the closest available field.

**A3.** Add a helper to strip known non-resume section markers (page numbers, headers/footers, "References available upon request") from preamble and section content before parsing.

**A4.** Strengthen `parseExperience()` to deduplicate role/company: when role text ends with company text, strip the company suffix from role.

### B. Domain type — `packages/domain/src/index.ts`

Add `professionalQualities: string[]` to `ResumeDocument` and update `sampleResume` accordingly.

### C. Resume store — `apps/web/lib/resume-store.ts`

Update `toStoredResume()`, `fromStoredResume()`, `parseResumePayload()` to include `professionalQualities`.

### D. Preview renderer — `packages/rendering/src/index.tsx`

**D1.** Fix "Target Role" placeholder — show nothing when `targetRole` is empty:
```tsx
{resume.targetRole && (
  <p className={...}>{resume.targetRole}</p>
)}
```

**D2.** Add `ProfessionalQualitiesSection` that renders professional qualities as chips (reusing skill styling).
- Only renders if `professionalQualities.length > 0`

### E. PDF renderer — `packages/rendering/src/pdf.tsx`

**E1.** Fix "Target Role" placeholder — same conditional rendering.

**E2.** Add professional qualities section in PDF output.

### F. Import page — `apps/web/app/import/page.tsx`

**F1.** Ensure `targetRole` is not set to empty string when missing — keep it as `""` but the renderer will now handle it.

### G. Regression test — new file `packages/ai/__tests__/import/text-parser.test.ts`

Add a test that:
1. Creates realistic resume text with skills, certifications, professional qualities, and references
2. Calls `parseResumeText()`
3. Verifies `skills` is an array of strings (not embedded in `summary`)
4. Verifies `certifications` is populated
5. Verifies `summary` does not contain skill names or cert text
6. Verifies `references` content is not present in any parsed field

---

## Files Modified

| File | Change |
|---|---|
| `packages/ai/src/import/text-parser.ts` | A1-A4: Add reference/qualities patterns, skip references, strengthen parseExperience, clean preamble |
| `packages/domain/src/index.ts` | B: Add `professionalQualities` to `ResumeDocument` |
| `apps/web/lib/resume-store.ts` | C: Pass through `professionalQualities` |
| `packages/rendering/src/index.tsx` | D1-D2: Hide empty targetRole, add professional qualities section |
| `packages/rendering/src/pdf.tsx` | E1-E2: Same fixes for PDF output |
| `packages/ai/__tests__/import/text-parser.test.ts` | G: New regression test |

---

## Verification

1. `cd packages/ai && npm test` — text parser tests pass
2. Visit `/import`, paste a resume with Skills, Certifications, Professional Qualities, References sections
3. Verify preview shows skills as chips, not in Profile paragraph
4. Create draft → verify resume preview in builder looks correct
5. Export PDF → verify skills are skill chips, certifications separate, no references, no "Target Role" placeholder
6. `npm run build` passes
