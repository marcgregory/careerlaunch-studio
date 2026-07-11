# Fix Parser Bugs — Round 2

## Root Cause: Section Boundary Detection

The `detectSections()` function uses `seen.has(id)` to ensure each section ID only appears once. 

**The problem**: When different headings map to the same `ResumeSectionId` (e.g., "Professional Qualities" and "Achievements" both → `professionalQualities`, "Experience" and "Volunteer Experience" both → `experience`), the `seen` set blocks the **second heading from being detected entirely**.

### Cascading failures this causes:

1. **"Achievements" heading skipped** → content bleeds into the previous section (Professional Qualities), producing the garbage line `"Employee of the Year (2023)—Analytics Excellence Award (2022)—Speaker..."` in the qualities output.

2. **"Languages" heading skipped** → content bleeds into whatever section was before it. Also, there's no Languages section defined at all, so even if detected, it has no handler.

3. **"Volunteer Experience" heading skipped** → content bleeds into previous section, volunteer date parsing doesn't trigger.

4. **Education section boundaries wrong** → without proper end boundary, education may capture too much or too little content.

5. **Projects losing bullets** → if the next section after "Projects" (e.g. "Achievements", "Languages") is not detected as a section start, the projects section extends past the project bullets into the next section's content, potentially confusing the project parser.

### Fix: Remove `seen.has(id)` guard

Replace the `seen` set with a dedup **after** collection. Remove `seen` entirely:
- Each line can match patterns independently, regardless of whether that section ID was already seen
- After building the full `headers` array, adjacent same-ID headers are merged (keep first start, use later end)

This lets "Experience" and "Volunteer Experience" both be detected (both → `experience`), and "Professional Qualities" and "Achievements" both be detected (both → `professionalQualities`).

## Remaining Issues After Round 1

### Issue A: Education degree duplicated, school/year lost
- **Root cause**: `parseEducation()` only looks one line ahead (`i + 1`) for school info. When the school line is `"University of Texas"` and the graduation year is on the next line `"2016"` (line i+2), the year is missed.
- **Fix**: After consuming `i + 1`, also check `i + 2` for a standalone 4-digit year → set as `graduation`.

### Issue B: Volunteer start year missing
- **Root cause**: Volunteer experience (e.g. "2021 – Present") is in the date-only line format. The `parseExperience` function's date-only handler looks BACKWARD for role/company, but volunteer sections may not match `DATE_RANGE_RE` if the year format is just "2021 – Present" (matches `YEAR_RANGE_RE`). Or the issue is that the volunteer lines aren't being routed to `parseExperience` at all because the section header isn't detected.
- **Fix**: After section boundary fix, volunteer content will be routed to `parseExperience` correctly. The date format "2021 – Present" already matches `YEAR_RANGE_RE = /(\d{4})\s*[-–]\s*(\d{4}|present|current|now)/i`.

### Issue C: Languages section not parsed
- **Fix**: Add `languages` section pattern → map to `skills` array (best semantic fit without schema change). Add handler in the `parseResumeText` switch.

### Issue D: Projects losing bullets
- **Root cause**: After section boundary fix, the projects section boundary will end at the correct next detected section header, preserving all bullets.
- **Fix**: The section fix alone should resolve this. Verify with tests.

## Files Changed

### `packages/ai/src/import/text-parser.ts`
1. `detectSections()` — Remove `seen` set. Add post-dedup for adjacent same-ID headers.
2. `SECTION_PATTERNS` — Merge all `professionalQualities` patterns (incl. achievements/honors/awards) into one entry. Merge all `experience` patterns (incl. volunteer/community) into one entry. Add `languages` section.
3. `parseEducation()` — After lookahead at i+1, also check i+2 for standalone 4-digit year.
4. `parseResumeText()` switch — Add `languages` case (parse bullet/comma items → append to `parsed.skills`).
5. `allSectionIds` — Add `"languages"` to the list.

### `packages/ai/__tests__/import/text-parser.test.ts`
- Add regression tests: achievements heading, volunteer dates, languages section, project bullets, education with 3-line format (degree/school/year on separate lines).

### Golden fixture files
- Regenerate all `.expected.json` files.
