# Fix Parser Bugs — Analysis & Plan

## Root Cause Analysis

After tracing the parser code against `resume-marc-style.txt` (the user's uploaded resume pattern), I've identified 5 parser bugs:

### Bug 1: Skills "Category Proficiency" table bleeds into Summary
**Root cause**: `detectSections()` has `\bskills\b` but NOT `/category/i` or `/proficiency/i`. If a resume lists skills in a table format under a "Category" column header (instead of "Skills"), `detectSections` never creates a skills section boundary. Those lines then fall into the preceding section — typically Summary.

Additionally, `parseSummary()` has NO filtering for table-formatted content (lines with 2+ spaces indicating columns). It blindly joins everything.

### Bug 2: Experience bullet extraction stops early (missing "timelines were met.")
**Root cause**: In the date-only bullet collection loop (lines 295-332), unmarked lines after `bulletCount > 0` trigger a date-range peek-ahead. If a bullet is the last fragment of an entry and the NEXT section header's line (e.g., "Education") is within 3 lines, the peek finds no date but the section header check via `isLikelyHeader` on the NEXT iteration breaks the loop. More critically: the date-only entry check `if (isLikelyHeader(lines[i])) break;` fires BEFORE the bullet-marker check — but the normal entry path has the same issue.

The real problem is visible in the normal-path bullet collection (lines 381-397): it collects EVERY non-empty line without checking `isLikelyHeader` per line. The date-only path DOES check `isLikelyHeader`, but in a slightly different order. A fragment like "timelines were met." on its own line after a bullet can get missed.

### Bug 3: Education truncation (graduation year absorbed into school)
**Root cause**: `extractSchool()` uses `/^[^,-]+(?:[,-][^,-]+){0,3}/` which captures comma-separated suffixes like ", 2019". When the school line is "University of Santo Tomas, 2019", `school` becomes "University of Santo Tomas, 2019" — including the graduation year. The `nextGrad` code at line 470-476 finds the year match but is DEAD CODE: it never assigns the graduation year to the entry.

### Bug 4: Skills 0 words parsed
**Root cause**: `parseSkills()` drops category labels from table rows. Lines like `Frontend  HTML, CSS, TypeScript` split on 2+ spaces into `["Frontend", "HTML, CSS, TypeScript"]`. Only the last column is used. The 6 category labels ("Frontend", "Backend", "Cloud / Infra", "IT / Hardware", "LLM", "Coding with AI") are all dropped. In cases where the Skills header IS detected but the table's second column contains proficiency levels instead of skill names (e.g., "Advanced", "Intermediate"), the parser captures almost nothing.

Additionally, `parseSkills` skips lines containing commas — but the second TABLE column contains commas. When `target.includes(",")`, it splits on commas. But if the target has no commas (proficiency words), it pushes the single word. With 1-2 proficiency words and a threshold of `< 3` skills, the section triggers `unparsedContent.skills`.

### Bug 5: Projects not detected
**Root cause**: The projects section pattern `/^(?:personal\s+)?projects?\s*$/im` requires the word "Projects" to be at the START of a line (`^`). If "Projects" appears mid-line or has leading whitespace, the `^` anchor with `im` flag doesn't help if the line starts with spaces. The `m` flag makes `^` match after `\n`, but `lines[i]` in `detectSections` has already been `.trim()`-checked — actually the line IS the raw line, and `pattern.test(line)` is on the raw line. So leading spaces would cause `^` to NOT match.

Wait — looking at `detectSections`:
```javascript
const line = lines[i].trim();
if (!line || /^[•\-*]\s/.test(line)) continue;
```
It uses the trimmed version for the check! Then the patterns use `line` (trimmed). So `^` in the pattern SHOULD match because the line is trimmed. So what's the issue?

The real issue: the PROJECTS patterns require either `^` anchor (with `im` flag) OR `\bprojects?\b`. The third pattern `/^(?:personal\s+)?projects?\s*$/im` and fourth `/^(?:personal\s+)?projects?:/im` both require `^`. The fifth pattern `/\b(?:personal|key|technical|academic|side)\s+projects?\b/i` requires a qualifier word before "Projects". The sixth pattern `/\bprojects?\s+undertaken\b/i` requires "undertaken" after.

So if the section title is just "Projects" on its own line, it should match the FIRST project pattern `^(?:personal\s+)?projects?\s*$`. Let me verify: `line` = "Projects", pattern = `/^(?:personal\s+)?projects?\s*$/im`. 
- `^` matches start of string
- `(?:personal\s+)?` matches nothing
- `projects?` matches "Projects"
- `\s*` matches nothing
- `$` matches end of string
- Result: MATCH

So "Projects" on its own line SHOULD be detected. But `detectSections` has the condition `line.length < 60` — "Projects" is 8 characters, so it passes.

Wait but there's also the check `seen.has(id)` — once a section ID is matched, subsequent potential matches are skipped. If "Projects" appears after Certifications, it should be fine.

Hmm, let me look at the trace output again. It shows:
```
Line 46: "Projects" -> SECTION "projects"
```
So projects IS detected. And the expected output shows all 3 projects with their bullets.

So bug 5 might not be about the current fixture. Maybe a different resume format where "Projects" isn't cleanly on its own line. Or where the section boundary overlaps with the following "References" section.

Actually, the real bug for projects is likely the same class as bug 1: if the section title doesn't match exactly (e.g., "Personal Projects" with a qualifier like "Related" or "Other"), or the "Projects" header comes before "Certifications" but after "Education" (different order than expected).

## Fix Plan

### Fix 1: Summary should not contain skills table
**Change `parseSummary()`** to filter out lines that look like table rows (2+ spaces indicating column alignment) or lines that match known skill-category keywords.

### Fix 2: Skills category labels preserved
**Change `parseSkills()`** to also include the category label (first column) when a table format is detected. The category label IS part of the skills content and should be counted.

### Fix 3: Experience bullet extraction — stop at section boundaries properly  
**Change the date-only bullet loop** to also break when the line matches `isLikelyHeader()`, and ensure the peek-ahead for date ranges doesn't skip legitimate bullets.

### Fix 4: Education — extract graduation year from school line
**Change `parseEducation()`** to extract graduation year from the school line when present, and strip it from the school field.

### Fix 5: Projects detection — make more robust
**Change PROJECTS patterns** to also match "Projects" as a standalone word even when qualified with less common prefixes.

## Test Plan

1. Create a comprehensive new fixture that models all 5 bug patterns
2. Add targeted regression tests in `text-parser.test.ts`
3. Fix each bug, verify golden files, and update expected output
4. Run full test suite to confirm no regressions
