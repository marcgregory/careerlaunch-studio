---
name: resume-parser-confidence-scoring
description: Section-level confidence scoring added to text-parser.ts
metadata:
  type: project
---

Added `confidenceBySection: Record<string, SectionConfidence>` to `ParseResult` in `packages/ai/src/import/text-parser.ts`. Section confidence is `"high" | "medium" | "low"`.

Heuristics per section:
- **summary**: high when text length ≥ 30 chars, medium when ≥ 10, low otherwise
- **experience**: high when ≥1 entry with real role+company, medium if entries exist but weak, low if none
- **education**: high when ≥1 entry with degree+school, low otherwise
- **skills**: high when ≥5 parsed, medium when ≥1, low when 0
- **certifications**: high when ≥2 with multi-word names, medium when ≥1, low when 0
- **professionalQualities**: high when ≥3, medium when ≥1, low when 0
- **projects**: high when ≥1 with name, medium when ≥1 exists, low when 0
- **references**: high when header detected and content exists, low otherwise

The existing overall `confidence: number` (0/30/60/90) is unchanged.

**Why:** This allows the UI to warn users "Please review this section — we couldn't parse it confidently" on a per-section basis, without changing the rendering output.

**How to apply:** After parser confidence is stable, wire the UI warning into the import review screen using `result.confidenceBySection`.
