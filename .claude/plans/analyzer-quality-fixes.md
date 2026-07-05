# Plan — Resume Analyzer Scoring & Suggestion Quality Fixes

**Sprint:** 6D (Beta Hardening — no new features, only quality)
**Files touched:** 5 source files, 1 test file
**Risk:** Low (all changes are to scoring parameters, filter rules, UI display, and verb lists)

---

## Why

The resume analyzer currently produces a score of **10/100** for a resume that a human reviewer would score **80–90/100**. This is because:

1. **Scoring penalties are too aggressive** — 3 major suggestions floor the score at 10 (3 × 12 = 36 → floor(100-36, 10) = 64 but combo with other items → floor). The floor hides real quality variation.
2. **Low-value suggestions appear as "Issues Found"** — certifications count, pronoun consistency — polluting the severity list.
3. **Action verb detection misses common tech verbs** — "installed", "troubleshot" are flagged as weak.
4. **"No measurable results" doesn't provide examples** — users can't act on it without a template.
5. **Score display obscures the denominator** — `/100` is 40% opacity, same visual weight as the tiny score number.
6. **JD keyword matching can suggest skills not in the JD** — needs prompt improvement.

---

## Phase 1 — Scoring + UI

### 1a. Soften scoring penalties (`packages/ai/src/scoring/index.ts`)

```diff
 const SEVERITY_PENALTIES = {
-  critical: 25,
-  major: 12,
-  medium: 7,
-  minor: 3,
+  critical: 15,
+  major: 8,
+  medium: 5,
+  minor: 2,
   info: 0,
 };
```

Raise the floor from **10 → 30** so a genuinely poor resume shows a low-but-believable score, and a good resume with minor issues scores 70–95.

```diff
- const baseScore = Math.max(10, MAX_POINTS - penalty);
+ const baseScore = Math.max(30, MAX_POINTS - penalty);
```

**Rationale:** With the new penalties, 4 criticals = 100 - 60 = 40 (vs 0 under old system). 3 majors + 3 mediums + 5 minors = 100 - (24+15+10) = 51. A strong resume with 5 minors = 100 - 10 = 90.

### 1b. Add category breakdown to health dashboard (`health-dashboard.tsx`)

Add a severity-count summary box below the score gauge showing:
- **Critical: N / Major: N / Medium: N / Minor: N**

This gives users immediate context for the score. Also add a "Resume Statistics" section (certifications, skills, projects, employers counts) separate from "Issues Found".

### 1c. Emphasize `/100` in score display (`score-gauge.tsx`)

```diff
- <span className="text-2xl text-[#123c3a]/40">/100</span>
+ <span className="text-2xl font-black text-[#123c3a]">/100</span>
```

Also add a text label below the gauge:
- **≥80**: "Excellent"
- **60–79**: "Good"  
- **40–59**: "Needs Work"
- **<40**: "Needs Improvement"

---

## Phase 2 — Suggestion Cleanup

### 2a. Move certifications from Issues to Statistics (`static.ts`)

Remove the **"N certification(s) listed"** info-level suggestion from `checkCompleteness()` (lines 388–402). Replace it with a computed stat that feeds into a new "Resume Statistics" section in the UI (count of skills, certs, projects, experience entries).

### 2b. Expand action verb list (`static.ts`)

Add these commonly used tech/IT verbs to the `actionVerbs` array (line 208):

```
installed, troubleshot, troubleshoot, maintained, configured,
deployed, tested, monitored, supported, documented, trained,
responded, resolved, diagnosed, authored, refactored, migrated,
coded, scaffolded, validated, triaged, patched, provisioned
```

Also fix a logic issue: "troubleshooting" (gerund) should not be flagged — the check currently only tests the first word of the bullet. A bullet starting with "Troubleshooting" is fine in context. The rule should check if the first word is a known verb **or a gerund that derives from a known verb**.

**Simpler approach:** Add common gerund forms directly to the verb list: `troubleshooting, maintaining, configuring, deploying, testing, monitoring, supporting, documenting, training, responding, resolving, diagnosing`.

### 2c. Remove pronoun-consistency / tone suggestions

In `orchestrator.ts`, add a post-merge filter that removes AI suggestions matching low-value patterns:

```typescript
const LOW_VALUE_PATTERNS = [
  /pronoun (use|consistency|switch)/i,
  /first.person/i,
  /I\s+believe|In my opinion/i,
];

suggestions = suggestions.filter(s => 
  !LOW_VALUE_PATTERNS.some(p => p.test(s.title) || p.test(s.reason))
);
```

This preserves the tone analysis for other useful feedback (formality level, consistency) while removing the one high-noise pattern.

### 2d. "No measurable results" with examples (`static.ts`)

For the `impact:no-metrics` suggestion, attach a concrete `suggestedText`:

```typescript
suggestedText: "Add numbers, percentages, or other measurable outcomes. Examples:\n" +
  "• \"Developed 15+ React components used across 4 internal applications\"\n" +
  "• \"Reduced page load time by 40% through code-splitting and lazy loading\"\n" +
  "• \"Supported 200+ end users across 3 departments\""
```

This turns a "you're doing it wrong" message into an actionable template.

---

## Phase 3 — JD Keyword Matching

### 3a. Investigate and fix JD skill extraction

Read `packages/ai/src/job-match/index.ts` to understand how skills are extracted from the JD. The bug report says "Go and Java" appear as missing when they aren't in the user's JD.

**Likely cause:** The dictionary-based matcher uses a static skill list and reports any skill in the list not found in either the resume or the JD. Fix: only report a skill as "missing" if it appears in the JD's extracted skills but NOT in the resume.

### 3b. Improve AI prompt for JD-aware suggestions (`gemini.ts`)

Update the `keywords` dimension prompt to emphasize that only terms actually present in the job description should be marked as missing. Add instruction:

```
IMPORTANT: Only list skills as "missing" if they clearly appear in the job 
description above. Do not infer skills from the role title alone. Only 
list skills as "present" if they appear in the resume.
```

---

## Test Plan

| Change | Test File | Assertion |
|--------|-----------|-----------|
| New penalties + floor | `scoring.test.ts` | Update expected values & floor test to expect 30, add test: 3 minors + 2 info = 94 |
| Verb list | `static.test.ts` (or integration) | A bullet starting with "Installed" or "Troubleshot" should NOT trigger weak-verb |
| Cert filter | `static.test.ts` (or integration) | Resume with 5 certs produces 0 completeness suggestions |
| Low-value filter | `orchestrator.ts` test | Suggestion with "pronoun use" in title is filtered out |
| Score display | Visual check only | `/100` is same weight as score number |
| No-metrics example | `static.test.ts` | Suggestion with category "impact" and code "no-metrics" has non-null `suggestedText` |

---

## Rollback Strategy

Each change is isolated to one file. Revert:
- **Scoring:** revert `packages/ai/src/scoring/index.ts`
- **Verb list:** revert the array in `static.ts`
- **Cert filter:** revert the removal in `static.ts`
- **Low-value filter:** revert the filter in `orchestrator.ts`
- **UI:** revert `score-gauge.tsx` and `health-dashboard.tsx`
- **JD fix:** revert `gemini.ts` prompt and/or `job-match/index.ts`
