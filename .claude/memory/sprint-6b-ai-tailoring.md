---
name: sprint-6b-ai-tailoring
description: Sprint 6B — AI Resume Tailoring as the flagship feature
metadata:
  type: project
---

Sprint 6B focuses on making CareerLaunch Studio genuinely useful for job seekers by building AI-powered resume tailoring against job descriptions. Approved by user on 2026-07-05.

**Key decisions:**
- Stop building more AI infrastructure. The provider layer (Gemini/Groq), prompts, validation, cache, cost controls are sufficient.
- Sprint 6B is the **flagship feature**: user pastes a JD → AI analyzes it → gap analysis against resume → AI rewrites sections → before/after diff → apply suggestions.
- Reuse existing AI provider architecture. No new providers, no billing changes, no new templates.
- Never invent experience or achievements. AI improves wording only.
- Every suggestion includes `before`/`after`/`reason`/`confidence` for transparent diff display.
- Success: user pastes JD, clicks Analyze, sees match score + missing keywords + rewrite suggestions + before/after comparison, applies selectively, exports.

**Why:** The infrastructure (Sprint 6A) is complete. Users will subscribe for AI that meaningfully improves their resumes, not for more plumbing. This sprint delivers the core value proposition.

**How to apply:**
- Start with `docs/implementation/ROADMAP.md` — move Sprint 6B from "to be decided" to "In Progress"
- Update `PROJECT_STATUS.md` to reflect the new sprint goal
- Build phase order: AI Job Analysis → Resume Gap Analysis → AI Tailoring → Before/After Diff → Apply Suggestions
- Success criteria: end-to-end flow from JD paste to tailored export
