---
name: import-recovered-layouts-tracking
description: Track which layouts were fixed by AI recovery to prioritize parser improvements
metadata:
  type: feedback
---

Feedback from user (2026-07-06): Add a `recoveredLayouts` analytics field alongside the existing `layouts` field.

Example shape:
```json
{
  "layouts": ["pipe-experience", "table-format"],
  "aiRecoveredLayouts": ["pipe-experience"]
}
```

This answers: "AI fixed 93% of pipe resumes" — directly guiding post-beta parser priorities.

**Why:** Without `recoveredLayouts`, you know how many imports used a given layout but not whether AI recovery actually helped that layout. The overlap between "layouts that fail" and "layouts AI can fix" is the key insight for deciding where to improve the parser vs. where AI recovery already handles it.

**How to apply:** After AI recovery succeeds, re-run `classifyLayout` on the recovery result text or just copy the `layouts` field from the initial `ParseResult` when `aiRecovered === true`.
