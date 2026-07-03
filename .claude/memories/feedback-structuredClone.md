---
name: feedback-structured-clone
description: Replace JSON roundtrip clone with structuredClone before v1.0
metadata:
  type: feedback
---

Replace `JSON.parse(JSON.stringify(resume))` in `packages/ai/src/apply/apply.ts` with `structuredClone(resume)` before v1.0.

**Why:** JSON roundtrip silently drops `Date`, `Map`, `Set`, `undefined`, `Infinity`, and custom class instances. The current `ResumeDocument` doesn't use these, but it's a ticking type bomb.

**How to apply:** One-line change in `packages/ai/src/apply/apply.ts` line 28. Verify with existing immutability tests (`npm run test` in `packages/ai`).
