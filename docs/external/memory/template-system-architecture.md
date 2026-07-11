---
name: template-system-architecture
description: Template registry refactored to semantic properties, removing per-template conditionals and PDF CSS duplication
metadata:
  type: project
---

The template registry (`packages/rendering/src/index.tsx`) uses semantic layout properties instead of per-template conditionals. Each template defines `headerStyle`, `nameStyle`, `roleStyle` which map to Tailwind classes via helper functions. The PDF renderer (`packages/rendering/src/pdf.tsx`) generates its CSS programmatically from the same template definition via `pdfCss()`.

**Why:** Previously, adding a template meant editing `isAts`/`isExecutive` checks in the React preview AND duplicating CSS in the PDF renderer. Now templates are pure configuration — the renderer branches on semantics (`headerStyle === "simple"`) not on template IDs.

**How to apply:** To add a new template, add one entry to `resumeTemplates[]` with the correct semantic properties. No React component or PDF CSS changes needed. The gallery is data-driven from `premium`, `accentColor`, `swatches` — no gallery code changes either. Add a visual regression line in `apps/web/tests/resume-flow.spec.ts` inside the "all templates render without visual regression" test.

**Key files:**
- `packages/rendering/src/index.tsx` — template registry + helpers + preview
- `packages/rendering/src/pdf.tsx` — PDF CSS generation from template definition
- `apps/web/app/builder/resume-builder.tsx` — data-driven gallery (premium badge, accentColor highlight)
- `apps/web/tests/resume-flow.spec.ts` — screenshot regression per template
