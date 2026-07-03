---
name: apply-engine-architecture
description: Every accepted suggestion goes through a pure Apply Engine before touching the resume
metadata:
  type: reference
---

## Core Rule

Accepted suggestions do not write directly to the resume. They pass through an Apply Engine:

```
Suggestion → Apply Engine → updatedResume + appliedChanges
```

The Apply Engine is a **pure function** — no React, no Prisma, no Next.js, no HTTP. It takes a resume and a suggestion, and returns the updated resume plus a record of what changed.

## Why

- **Testability**: 100+ unit tests for apply logic without any framework or database
- **Separation**: Analysis, suggestion, and application are three independent concerns
- **Auditability**: Every resume mutation has a recorded operation + payload

## Folder Structure

```text
packages/ai/
  apply/
    apply-summary.ts      — replace_summary operation
    apply-experience.ts    — replace_bullet, add_bullet, remove_bullet operations
    apply-skill.ts         — add_skill, remove_skill operations
    apply-keywords.ts      — keyword-specific operations
    apply.ts               — orchestrator: dispatches by operation type
```

## Suggestion Operation Model

Instead of storing `beforeText` / `afterText`, store operations:

```json
{
  "operation": "replace_summary",
  "target": "summary",
  "payload": { "newText": "..." }
}
```

```json
{
  "operation": "replace_bullet",
  "experienceId": "exp-1",
  "bulletIndex": 2,
  "payload": { "newText": "..." }
}
```

This makes the Apply Engine a simple dispatcher:

```ts
applySuggestion(resume, suggestion): { updatedResume, appliedChanges }
```

## API Pattern (after Apply Engine exists)

```text
POST /api/resumes/:id/suggestions/:id/apply
```

Which is just: Load Resume → Apply Engine → Save Resume → Return

The API is trivial because the Apply Engine does the real work.

## Persistence

- **Accepted suggestions**: store the operation + payload (not the resulting text)
- **Dismissed suggestions**: keep client-side only until user feedback proves the feature is needed
- No notification/history system yet — don't build what users haven't asked for

## Current Sprint 3A Status

Based on user review (tech lead):

| Category | Score |
|----------|-------|
| AI Package structure | 10/10 |
| Analysis Engine (static → AI → merge) | 10/10 |
| Health Dashboard (analyze → review → accept) | 10/10 |
| Apply Engine | ⏳ Next |
| Sprint 3B Rewrite | Not started |
| Sprint 3C Job Matching | Not started |
| Sprint 3D Cover Letter | Not started |

The architecture is no longer the bottleneck. From here on: implement Apply Engine cleanly, then move to rewrite/job-matching while preserving the analysis/application/persistence separation.

See also: [[ai-architecture-rule]]
