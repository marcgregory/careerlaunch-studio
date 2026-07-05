---
name: golden-file-test-suite
description: Golden-file regression tests for resume text parser using fixture resumes
metadata:
  type: reference
---

Created `packages/ai/__fixtures__/` with 6 anonymized resume fixtures (.txt) and their expected parser outputs (.expected.json). Each fixture covers a distinct edge case:

- **resume-full.txt** — full-featured resume (all sections, references to exclude, pipe-format experience)
- **resume-certifications.txt** — heavy certifications (6 certs), 3 experience entries, technical skills
- **resume-linkedin-style.txt** — LinkedIn-style format (month-prefixed dates, "Summary" header, international)
- **resume-minimal.txt** — minimal resume (1 experience, 1 education, no skills/qualifications/summary)
- **references-only.txt** — resume with "Available upon request" and "References furnished upon request" lines to verify boilerplate removal
- **resume-skills-qualities.txt** — skills before experience (unusual section order), professional qualities without separate summary

Tests in `packages/ai/__tests__/import/golden-file.test.ts` assert `parseResumeText()` output matches expected JSON exactly. Regenerate with `npx tsx packages/ai/scripts/generate-fixtures.ts` after intentional parser changes.

Combined with existing text-parser.test.ts (unit tests), covers sections detection, references exclusion, certification parsing, experience dedup, pipe-format support, boilerplate removal, and skills/qualities separation.
