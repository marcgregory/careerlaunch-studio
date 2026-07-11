---
name: deprioritize-parser
description: Parser bugs have consumed disproportionate time; freeze as best-effort and focus on core product features
metadata:
  type: feedback
---

The import/PDF parser has consumed more development time than the rest of the application combined. Each fix introduces new edge cases. The pattern of patching without resolving root cause is a time sink.

**Decision:** Freeze the parser at its current state. Accept it as "best effort" with a user-facing note: "Review imported content before exporting."

**Redirect effort to:**
- Resume Builder UX
- Resume Tailoring workflow
- AI Analysis quality
- PDF Export reliability
- General UX polish
- UI/UX improvements with higher user-facing value

**Why:** The goal is shipping a SaaS product for portfolio/use. The ROI on builder, tailoring, export, and UX is far higher than chasing PDF parsing edge cases.

**How to apply:** Do not initiate parser refactors or edge-case fixes. If a parser issue blocks a higher-priority feature, fix only the minimum needed to unblock. Revisit parser quality only after the core product is stable and shipping.

**Hard rule for any parser work:** No parser fix may be merged unless the bug is reproduced by a regression test using the original source text (or extracted PDF text). Every fix must add a fixture so the bug never returns. Without a reproducible input + regression test, the fix is not considered done.

**In short:**
- **Core product** (builder, tailoring, AI analysis, PDF export, dashboard) → high priority
- **Parser patches** → only when there is a reproducible input and a regression test proving the fix

**Related:** [[sprint-6d-beta-hardening]], [[tailoring-reset-button]]
