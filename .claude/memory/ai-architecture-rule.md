---
name: ai-architecture-rule
description: AI must never mutate the resume directly — all AI output flows through a suggestion → user accept → apply pipeline
metadata:
  type: reference
---

## Core Rule

**AI must never mutate the resume directly.** Every AI action follows:

```
Resume → AI Analysis → Suggestions → User Accepts → Resume Updated
```

Never:

```
Resume → AI → Resume overwritten
```

## Rationale

This single architectural rule prevents a cascade of UX problems: loss of user control, hard-to-revert changes, trust erosion, and confusing undo semantics. It also cleanly separates analysis (read-only, cacheable) from generation (LLM calls with cost/ latency), making both easier to test, swap providers, and cost-control.

## Sprint 3 Split

Sprint 3 should be decomposed into sequential epics, each independently shippable:

- **Sprint 3A — Resume Analysis** (read-only): ATS score, grammar, weak verbs, measurable achievements, keyword density, missing sections. No rewriting.
- **Sprint 3B — AI Rewrite** (suggestions require approval): Rewrite bullet, rewrite summary, improve headline, shorten, expand. Every action requires explicit user accept.
- **Sprint 3C — Job Matching**: Resume + Job Description → match %, missing keywords, missing skills, suggested improvements.
- **Sprint 3D — Cover Letter**: Reuse resume, job description, template engine, and PDF renderer.

## Target Architecture

```
Resume
      │
      ▼
Normalization
      │
      ▼
Analysis Engine
      │
      ├── ATS
      ├── Grammar
      ├── Keywords
      ├── Metrics
      └── Completeness
      │
      ▼
Suggestion Engine
      │
      ▼
Accept / Reject
      │
      ▼
Resume Store
```

Analysis and generation are separate concerns — this makes testing, provider swapping, and cost control straightforward.

## Pre-Work

Before writing AI code, create `docs/architecture/AI.md` covering:
- Supported AI providers (OpenAI, Anthropic, local models)
- Prompt architecture and versioning
- Rate limiting and retry/fallback behavior
- Caching strategy (analysis results are cacheable; generation isn't)
- Cost controls per-user and globally
- Privacy: what data is sent to AI, what stays local
- Structured response schema (typed, validated outputs from LLM calls)

## Context

Given by user as tech-lead-level review feedback after Sprints 1-2 completion. See also [[sprint-progress-milestone]].
