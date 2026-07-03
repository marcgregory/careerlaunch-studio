# Template System Refactor Plan

## Goals

1. Add metadata (premium, accentColor, thumbnail) for data-driven gallery
2. Remove per-template conditionals (`isAts`, `isExecutive`) from renderers
3. Make PDF use the registry instead of duplicating CSS
4. Add Playwright visual regression tests for all 4 templates
5. Lay groundwork for future theme separation

## Current Problems

- `ResumePreview` and `ResumePdfDocument` have `isAts`, `isExecutive` checks
- PDF renderer duplicates all template styles as raw CSS in `renderResumeHtml()`
- Template thumbnails missing (gallery shows abstract shape + swatches)
- No `premium` flag, no `accentColor` for gallery data-driven rendering
- Adding a new template requires editing both React components AND the PDF CSS

## File Changes

### 1. `packages/rendering/src/index.tsx` — Template registry refactor

**Enhance `TemplateDefinition` type:**
- Add `premium`, `accentColor`, `thumbnail` fields
- Add `layout` object: `{ type: "standard" | "single-column", headerStyle: "accent-bar" | "double-rule" | "thin-rule" | "simple" }`
- Add `typography` object: `{ name: "display" | "large-serif" | "plain", role: "uppercase-mono" | "uppercase-small" | "plain" }`
- Add `styles` object that groups all CSS classes: container, header, roleClass, nameClass, contactClass, heading, marker, skill, headingBorder

**Remove per-template conditionals:**
- `isAts` → `template.layout.headerStyle === "simple"`
- `isExecutive` → `template.layout.headerStyle === "double-rule"`
- `template.id === "ats" ? "text-4xl font-bold" : "font-signal text-5xl font-black tracking-[-0.06em]"` → `template.typography.name === "plain" ? "text-4xl font-bold" : "font-signal text-5xl font-black tracking-[-0.06em]"`

**Effect:** Adding a new template = one object in `resumeTemplates[]` + no renderer changes.

### 2. `packages/rendering/src/pdf.tsx` — PDF uses the registry

**Replace raw CSS classes with programmatic generation from template:**
- Compute CSS from `template.styles`, `template.typography`, `template.colors`
- Each template generates CSS rules from its definition object
- `renderResumeHtml()` builds the `<style>` block from template data

**Effect:** Browser preview and PDF now share the same source of truth.
Adding a template adds PDF rendering for free.

### 3. `apps/web/app/builder/resume-builder.tsx` — Data-driven gallery

- Use `template.premium` → show "Premium" badge or lock icon
- Use `template.accentColor` → style hover/selected states
- Use `template.thumbnail` → could upgrade abstract shapes to actual thumbnails later

No structural changes needed — gallery already iterates `resumeTemplates`.

### 4. `apps/web/tests/resume-flow.spec.ts` — Visual regression tests

Add test block after the builder section ordering test:

```ts
test("all templates render without visual regression", async ({ page }) => {
  // sign in, create resume
  // for each template (modern, executive, minimal, ats):
  //   click template in gallery
  //   wait for preview to update
  //   expect(page.locator("article")).toHaveScreenshot(`template-${id}.png`)
})
```

Requires `playwright.config.ts` update to enable screenshots.

### 5. `packages/domain/src/index.ts` — No changes needed

`templateId` already lives in the domain model. The `ResumeTemplateId` union type stays.

## Test strategy

- **Unit tests**: No new ones needed — the refactor preserves behavior
- **Visual regression**: New Playwright `toHaveScreenshot()` tests for all 4 templates
- **Existing e2e**: All existing tests continue passing (backward compat preserved)
- **Manual**: Switch between templates in the gallery, verify preview updates and PDF exports match

## Out of scope (future)

- Full theme system (blue/green/purple variants per template)
- Actual thumbnail images
- Creative template with two-column layout
- Template editor / customization UI
