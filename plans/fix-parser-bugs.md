# Fix Resume Parser Bugs

## Issues Detected

### 1. LinkedIn URL Truncated
- `LINKEDIN_RE`: `linkedin\.com\/[a-zA-Z0-9_-]+\/?` captures only `linkedin.com/in/` — the `/` before `marcturno` is outside the char class, so the match stops.
- **Fix**: `linkedin\.com\/in\/[a-zA-Z0-9_-]+` to capture the full `/in/username` path.

### 2. Portfolio/GitHub Websites Missing
- `ContactInfo` has only one `website` field. The parser overwrites: if LinkedIn matches first, LinkedIn fills `website`; if a personal site matches first, LinkedIn overwrites it.
- **Fix**: Add `linkedin` and `github` fields to `ContactInfo`. Route each URL type to its own field.

### 3. Location Missing for Non-US Formats
- Location regex `/^[A-Z][a-z]+(?:,\s*[A-Z]{2})$/` requires a two-letter state/territory. Fails for `Manila, Philippines` (8 letters), `London, UK` (2 chars after comma but not necessarily a state code in the regex).
- **Fix**: Widen regex to `/^[A-Za-z\s]+,\s*[A-Za-z\s.]{2,}$/` — city name + comma + region (2+ chars including periods, e.g. "Kyiv, Ukraine").

### 4. Education: School Truncated, Year Lost, Duplicates
- `extractSchool()` starts scanning at the word "University"/"College" and captures only 0-3 comma/dash-delimited tokens *after* it. `"Texas State University"` → matches at "University" → captures `"University"` only (no preceding tokens). `"University of Santo Tomas, 2019"` → matches at "University" → captures `"University of Santo Tomas, 2019"` with the year embedded.
- The graduation-year extraction on line 552-555 doesn't assign to the education entry's `graduation` field — dead code.
- No line-skipping after consuming a school line, so the school line can be re-processed as a new education entry in the next loop iteration.

### 5. Achievements Heading, No Items Parsed
- No `"achievements"` pattern in `SECTION_PATTERNS`.
- **Fix**: Add `\bachievements?\b`, `\bhono?urs?\b`, `\bawards?\b` patterns mapped to `professionalQualities`.

### 6. Volunteer Experience Missing Dates
- No `"volunteer"` pattern in the experience `SECTION_PATTERNS`.
- **Fix**: Add `\bvolunteer\b` and `\bvolunteer\s+experience\b` to experience patterns.

### 7. Project Descriptions Empty
- The project parser always sets `description: ""`. The line between a project name and its first bullet can be a one-line description (e.g. `"Full-stack SaaS platform for resume creation and AI-powered improvement."`).
- **Fix**: After detecting a project name, if the next non-blank, non-bullet line exists and is short (< 40 words), capture it as `description`, then continue collecting bullets.

### 8. Contact Parser: Site-specific URL Support
- Current code routes ALL non-email URLs to `contact.website`. Need separate detection for:
  - `linkedin.com/in/...` → `contact.linkedin`
  - `github.com/...` → `contact.github`
  - Everything else → `contact.website`
- Fix `extractContact()` to detect and route each URL type.

## Pre-existing Test Failure
The test `should not include references content in any parsed field` fails because references ARE parsed into the `references` array. The test needs updating — the guardrail should assert that references content doesn't appear in *other* fields (summary, experience, skills), not that it's missing entirely.

## Files Changed

### 1. `packages/domain/src/index.ts`
- Add `linkedin: string` and `github: string` to `ContactInfo`

### 2. `packages/domain/src/validation/resume.ts`  
- Add `linkedin` and `github` fields to `contactSchema` Zod validation

### 3. `packages/ai/src/import/text-parser.ts` (main parser fixes)
- Fix `LINKEDIN_RE` to capture full profile
- Add `GITHUB_RE`
- Fix location regex
- Fix `extractSchool()` to include text before the keyword
- Fix education line-skipping to prevent duplicates
- Add achievements section pattern → `professionalQualities`
- Add volunteer section pattern → `experience`
- Add project description capture
- Fix `extractContact()` URL routing

### 4. `packages/ai/__tests__/import/text-parser.test.ts`
- Fix the references test assertion
- Add regression tests for all fixed bugs

### 5. `packages/ai/__fixtures__/resume-parser-bugs.expected.json`
- Regenerate golden file

### 6. All other golden fixture `.expected.json` files  
- Regenerate to include new `linkedin` and `github` fields in contact

### 7. `packages/rendering/src/index.tsx`, `packages/rendering/src/pdf.tsx`
- Render `linkedin` and `github` contact fields

### 8. `packages/ai/src/analysis/static.ts`
- Check `linkedin` and `github` in contact completeness check

### 9. `apps/web/app/builder/resume-builder.tsx`
- Add `linkedin` and `github` input fields
