---
name: import-analytics-funnel-metrics
description: Track full user funnel from import to PDF export to correlate parser quality with user behavior
metadata:
  type: feedback
---

Feedback from user (2026-07-06): The current analytics stop at Import but should track the full funnel:

```
Import → Created Draft → Abandoned → Edited → Exported PDF
```

This closes the loop from technical quality to actual user behavior. Key questions it answers:

- Which layouts lead to users abandoning the flow?
- Does AI recovery increase draft creation?
- Which parser failures correlate with drop-off?

**Why:** Without funnel data, you can't connect parser quality to business outcomes. A parser metric (e.g., coverage ratio) is abstract; a funnel metric (e.g., "pipe-format imports edit less often") drives real priorities.

**How to apply:** Add PostHog events at each funnel step with layout classification tags so you can segment by layout type. The AI recovery event should carry `recoveredLayouts` to measure which formats benefit most.
