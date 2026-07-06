---
name: import-coverage-delta-analytics
description: Track coverage before and after AI recovery to measure improvement
metadata:
  type: feedback
---

Feedback from user (2026-07-06): Don't just log final coverage — log the delta.

Example for experience section:
- coverage_experience_before: 0.22
- coverage_experience_after: 0.96

This is one of the strongest metrics for stakeholders: "AI recovery improved average experience preservation from 41% to 96%."

**Why:** A single final coverage number hides the value of AI recovery. The delta tells the story of how much the parser missed and how much AI fixed.

**How to apply:** In the import route handler, after AI recovery completes, emit a PostHog event with per-section `{before: ratio, after: ratio}`. Key sections: experience, education, skills.
