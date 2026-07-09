# Plan: References Section

## Summary

Add a References section to the resume builder — data model, import parser, editor UI, template renderer, and privacy toggle — following the same patterns as Education/Projects sections.

## Files to Modify

### 1. Data Model — `packages/domain/src/index.ts`

**Add type:**
```ts
export type ReferenceItem = {
  id: string;
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  relationship: string;
};
```

**Add field to `ResumeDocument`:**
```ts
references: ReferenceItem[];
```

**Add `"references"` to `defaultSectionOrder`:**
```ts
export const defaultSectionOrder: ResumeSectionId[] = [
  "summary", "experience", "education", "skills",
  "certifications", "professionalQualities", "projects",
  "references"
];
```

**Update `estimateWordCount()`** to count reference fields.

**Add sample references** to `sampleResume`.

### 2. Zod Schema — `packages/domain/src/validation/resume.ts`

**Add schema:**
```ts
export const referenceItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required."),
  title: z.string().default(""),
  company: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  relationship: z.string().default(""),
});
```

**Add to `resumeSchema`:**
```ts
references: z.array(referenceItemSchema).default([]),
```

### 3. Import Parser — `packages/ai/src/import/text-parser.ts`

**Remove the skip (lines 1121-1126)**: Replace the `case "references"` block that currently just increments `totalFields` with actual parsing logic.

**Parsing strategy for references:**
Reference lines typically use pipe (`|`), dash (`-`), or comma (`,`) separators. Parse each non-empty line after the header as a reference:

```
Name | Title, Company | Phone
Name - Title - Company - Email - Phone
Name, Title, Company, Email, Phone
```

Use splitting heuristics:
1. Try `|` first (most structured, as in the example)
2. Fall back to `-` 
3. Fall back to `,` (least reliable)

Map parts by position: name, title+company (combined), phone/email.

Store parsed references in `parsed.references`.

**Update `parseReferenceLine()` helper** (new function) that returns `ReferenceItem | null`.

**Update `evaluateSection("references")`** to check `parsed.references?.length >= 1` for high confidence (instead of just `nonEmptyLines`).

**Update `calculateCoverage("references")`** to count parsed reference words.

### 4. Resume Store — `apps/web/lib/resume-store.ts`

**Update `createStarterResume()`** — add:
```ts
references: [],
```

**Update `toStoredResume()`** — add:
```ts
references: resume.references,
```

**Update `fromStoredResume()`** — references flows through automatically via spread.

**Update `parseResumePayload()`** — add:
```ts
references: Array.isArray(resume.references) ? resume.references : [],
```

**Update `normalizeSectionOrder`** — add `"references"` to the allowed set (already in `defaultSectionOrder` now, so this is automatic).

### 5. Builder UI — `apps/web/app/builder/resume-builder.tsx`

**Add state helpers** (following the Education/Experience pattern):

```ts
function addReference() { ... }
function updateReference(id: string, patch: Partial<ReferenceItem>) { ... }
```

**Add editor panel** between the Projects panel and the closing `</div>`:

```tsx
<Panel title="References" action={<button className={tinyButtonClass} type="button" onClick={addReference}><Plus size={15} /> Add reference</button>}>
  <StackEmpty when={resume.references.length === 0} label="No references added." action="Add professional or character references." />
  <div className="space-y-2 sm:space-y-4">
    {resume.references.map((item, index) => (
      <ItemCard
        key={item.id}
        title={item.name || `Reference ${index + 1}`}
        onDelete={() => setResume((current) => ({ ...current, references: current.references.filter((ref) => ref.id !== item.id) }))}
        onMoveUp={() => setResume((current) => ({ ...current, references: moveItem(current.references, index, -1) }))}
        onMoveDown={() => setResume((current) => ({ ...current, references: moveItem(current.references, index, 1) }))}
        disableUp={index === 0}
        disableDown={index === resume.references.length - 1}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" value={item.name} error={validation[`reference.${item.id}.name`]} onChange={(value) => updateReference(item.id, { name: value })} />
          <Field label="Job Title" value={item.title} onChange={(value) => updateReference(item.id, { title: value })} />
          <Field label="Company" value={item.company} onChange={(value) => updateReference(item.id, { company: value })} />
          <Field label="Phone" value={item.phone} onChange={(value) => updateReference(item.id, { phone: value })} />
          <Field label="Email" value={item.email} onChange={(value) => updateReference(item.id, { email: value })} />
          <Field label="Relationship" value={item.relationship} onChange={(value) => updateReference(item.id, { relationship: value })} />
        </div>
      </ItemCard>
    ))}
  </div>
</Panel>
```

**Add import** for `ReferenceItem` type.

### 6. Template Renderer — `packages/rendering/src/index.tsx`

**Add `renderSection` case** before the `return ProjectsSection` fallback:

```ts
if (section === "references")
  return <ReferencesSection key={section} resume={resume} template={template} />;
```

**Add component:**

```tsx
function ReferencesSection({ resume, template }: { resume: ResumeDocument; template: TemplateDefinition }) {
  const refs = resume.references.filter(r => r.name.trim());
  if (refs.length === 0) return null;
  return (
    <section className="mt-8">
      <ResumeHeading template={template}>References</ResumeHeading>
      <div className="mt-4 space-y-3">
        {refs.map((item) => (
          <div key={item.id} className="text-[15px] leading-relaxed">
            <p className="font-black text-[#4b4b4b]">{item.name}</p>
            <p className="font-medium text-[#33343b]">
              {[item.title, item.company].filter(Boolean).join(", ")}
            </p>
            <p className="text-[#555]">
              {[item.phone, item.email].filter(Boolean).join(" · ")}
            </p>
            {item.relationship && (
              <p className="text-[#777] text-sm">{item.relationship}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
```

### 7. Privacy Toggle (in builder UI)

Add a `showReferences` toggle field to the document model. Alternatively, simplify: since references are a section like any other, users can add/remove the section via section order, or leave it empty. However, the requirement says "Show references on resume" toggle OR "References available upon request".

**Simplest approach**: If references exist but user doesn't want to display them, they can just not include `"references"` in `sectionOrder`. The display text "References available upon request" can be rendered when the section is in order but all reference items are empty.

Actually, let's add a `referencesNote` field that when set to `"References available upon request"` and no references exist, renders that text instead. Let me reconsider.

**Approach:** 
- References section renders normally if `name` entries exist.
- Add `referencesNote?: string` field. When no references have names but `referencesNote` is set, render the note text.
- This gives the privacy behavior without extra toggles.

Actually, let me simplify: just track it with section order. If `references` is in `sectionOrder` and references have content, show them. If references is in section order but all names are empty → show nothing.

For "References available upon request": We can add a single toggle/checkbox that, when checked, adds a single "References available upon request" line in place of the individual references. This is a simple boolean on the resume document.

**Let me use a simpler approach**: Add `referencesNote: string` to `ResumeDocument`. When it's set to "References available upon request" (or any custom text), the template renderer shows that instead of individual references. In the editor, add a text field for this note and/or a quick-toggle checkbox.

### 8. Updated Privacy Approach (simplified)

After further thought — the cleanest approach matching existing patterns:

- **Add `referencesNote` field** to `ResumeDocument` (string, default `""`).
- **Builder UI**: Add a small text input or checkbox below the references list:
  - Checkbox: "Show 'References available upon request' instead"
  - When checked, set `referencesNote` to `"References available upon request"` and clear individual references.
  - When unchecked, clear the note.
- **Template renderer**: If `referencesNote` is set and has content, render that as a single italic line. Else render individual references.

This way it's a tiny addition — one more string field, one checkbox, one extra render condition.

---

## Detailed File Changes Summary

| # | File | Change |
|---|------|--------|
| 1 | `packages/domain/src/index.ts` | Add `ReferenceItem` type, add `references` field to `ResumeDocument`, add to `defaultSectionOrder`, add `referencesNote` field, update `estimateWordCount`, add sample refs |
| 2 | `packages/domain/src/validation/resume.ts` | Add `referenceItemSchema`, add to `resumeSchema` |
| 3 | `packages/ai/src/import/text-parser.ts` | Parse references content (remove skip), update `evaluateSection`, update `calculateCoverage` |
| 4 | `apps/web/lib/resume-store.ts` | Add `references: []` to `createStarterResume`, add to `toStoredResume`/`parseResumePayload` |
| 5 | `apps/web/app/builder/resume-builder.tsx` | Add `addReference`/`updateReference` helpers, add References Panel with `ItemCard`, add checkbox for `referencesNote` |
| 6 | `packages/rendering/src/index.tsx` | Add `ReferencesSection` component and `renderSection` case |

## Verification

1. Build passes (`npm run build`)
2. TypeScript passes (`npm run lint`)
3. Import captures all 3 sample reference formats
4. References appear in editor after import
5. References can be edited, reordered, removed
6. References appear in preview/export only if enabled
7. Privacy toggle renders "References available upon request"
8. Validation: name is required; phone/email preserve formatting
