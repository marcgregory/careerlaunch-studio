---
name: parser-structural-experience-detection
description: Post-beta issue — detect experience entries structurally instead of relying on section headers
metadata:
  type: project
  status: backlog
---

Identified by user feedback (2026-07-06): The parser currently depends on Section Detection → Experience Parsing, but pipe-format entries like "Jun 2021 – Present | Senior Developer | Acme" already contain enough information to be identified as experience without a preceding "Experience" section header.

**Why:** This limitation means pipe-format resumes parse correctly only when they have an "Experience" header. Many real resumes (especially from LinkedIn exports or concatenated text) have pipe-delimited entries without explicit section headers.

**How to apply:** After beta, refactor the parser to detect experience entries structurally — scan for date-range + pipe-separated fields anywhere in the text, not just inside an explicitly detected experience section. See [[import-analytics-funnel-metrics]] for the data that will tell us how often this matters.
