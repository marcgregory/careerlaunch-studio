---
name: imported-resume-rendering-fix
description: Fixed import parser bug causing skills-in-profile, missing section separation, and experience dupes
metadata:
  type: project
---

Fixed a latent bug in `detectSections()` in `packages/ai/src/import/text-parser.ts`: `sections.has(id)` always returned `false` during the header-collection loop because the `sections` map was only populated **after** the loop completed. This caused duplicate headers for sections like "certifications" (when a cert content line like "HubSpot Certificate" matched the section pattern), corrupting boundary detection.

**Changes:**
- **`detectSections()`** — use a `seen` Set (not `sections.has()`) to track matched IDs during the loop
- **`SECTION_PATTERNS`** — added `references` and `professionalQualities` section patterns
- **`parseResumeText()` switch** — handle `professionalQualities` (store as array), `references` (skip entirely)
- **Experience parsing** — added pipe `|` format splitting, role/company deduplication
- **Preamble cleaner** — filter "References available upon request" and page numbers before parsing
- **`packages/domain/src/index.ts`** — added `professionalQualities: string[]` to `ResumeDocument`, added `references` to `ResumeSectionId`
- **`packages/rendering/src/index.tsx`** — hide targetRole when empty, added ProfessionalQualitiesSection
- **`packages/rendering/src/pdf.tsx`** — same fixes for PDF output
- **`apps/web/lib/resume-store.ts`** — pass through `professionalQualities`
- **`apps/web/app/import/page.tsx`** — pass through `professionalQualities`
- **`apps/web/app/builder/resume-builder.tsx`** — add professional qualities editor panel, update section labels+handlers

**Test:** `packages/ai/__tests__/import/text-parser.test.ts` — regression test verifying skills not in profile, section separation, references exclusion, experience dedup.

**Why:** Imported resumes looked unpolished before paid export, risking user trust. The section boundary bug meant skills and certifications bled into the Profile/Summary paragraph.

**How to apply:** 233 tests pass, build compiles. The fix is live in the parser layer — any new import will benefit automatically.
