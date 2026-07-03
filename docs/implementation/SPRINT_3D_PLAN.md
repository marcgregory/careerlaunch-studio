# Sprint 3D — Cover Letter Builder MVP

**Goal:** Let users generate, edit, save, and export a cover letter draft associated with their existing resume. No auto-send, no email integration.

## Principles

- Reuse everything possible: auth, template styling, PDF engine, sidebar panel pattern
- AI drafts → user edits → user exports (same pipeline as resume suggestions)
- Keep it tight — one panel in the existing builder sidebar, no separate page

---

## 1. Prisma Schema — `CoverLetter` model

A new model linked to `User` and `ResumeDocument` (one cover letter per resume for MVP).

```prisma
model CoverLetter {
  id              String   @id @default(cuid())
  userId          String
  resumeId        String
  title           String   @default("Cover Letter")
  recipientName   String?
  recipientTitle  String?
  companyName     String?
  companyAddress  String?
  salutation      String   @default("Dear Hiring Manager,")
  body            String   @default("")
  closing         String   @default("Sincerely,")
  jobDescription  String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  resume          ResumeDocument @relation(fields: [resumeId], references: [id], onDelete: Cascade)

  @@index([userId, updatedAt])
  @@index([resumeId])
}
```

Also make the `resume` relation on `CoverLetter` and `user` relation required (the existing User model gets an optional `coverLetters` backref).

---

## 2. AI Cover Letter Generator (`packages/ai/src/cover-letter/`)

**Files:**

- `types.ts` — `CoverLetterInput { resume, jobDescription? }`, `GeneratedCoverLetter { body: string }`
- `generate.ts` — `generateCoverLetterMock(input)` — mock that produces realistic placeholder text based on the resume's name, role, skills, and any pasted JD. Follows the deterministic, dictionary-based pattern used by the job-match engine (no AI calls for MVP).
- `index.ts` — re-exports

**Behavior:**
- Extracts the candidate name from `resume.contact.fullName`
- Mentions target role, 2–3 key skills, relevant experience highlights
- If a JD is provided, references it in the opening paragraph
- Returns a plain-text body (multi-paragraph)
- Mock latency 50–150ms for realistic UX

---

## 3. Cover Letter PDF (`packages/rendering/src/cover-letter-pdf.tsx`)

New file in the rendering package, following `pdf.tsx` exactly:

- `renderCoverLetterPdf(coverLetter, resume): Promise<ArrayBuffer>`
- Uses the resume's template `getResumeTemplate(resume.templateId)` for font styling (name font, accent color)
- Business letter format: date line, recipient block, salutation, body paragraphs, closing, name
- Single-page Letter format with same Playwright pipeline
- Exported via `package.json` exports as `./cover-letter-pdf`

---

## 4. API Routes

All under `apps/web/app/api/resumes/[resumeId]/cover-letter/`:

| Route | Method | Purpose |
|---|---|---|
| `/api/resumes/:resumeId/cover-letter` | `GET` | Load existing cover letter (or return null) |
| `/api/resumes/:resumeId/cover-letter` | `PUT` | Save cover letter edits (upsert by resumeId) |
| `/api/resumes/:resumeId/cover-letter/generate` | `POST` | AI-generate a draft, upsert, return |
| `/api/export/cover-letter-pdf` | `POST` | Render and return PDF bytes |

All routes authenticated via `requireApiUser()` + ownership check on the resume.

**Generate route** accepts optional `jobDescription` in body, calls `generateCoverLetterMock`, saves the result as a `CoverLetter` record (upsert by resumeId), returns the generated body.

**Save route** upserts the full cover letter fields.

**Export route** loads the cover letter + resume, calls `renderCoverLetterPdf`, returns PDF response (same pattern as `/api/export/pdf`).

---

## 5. UI — CoverLetterPanel (`apps/web/app/builder/_analysis/cover-letter-panel.tsx`)

A self-contained panel component (like `JobMatchPanel`) that mounts in the builder sidebar alongside `HealthDashboard` and `JobMatchPanel`.

### States

| State | What the user sees |
|---|---|
| **Idle (no cover letter)** | "Generate a cover letter" prompt + optional JD textarea + "Generate draft" button |
| **Generating** | Loading spinner with "Drafting your cover letter..." |
| **Editing** | Body textarea + Recipient fields (name, title, company, address) + Salutation + Closing + Auto-save indicator |
| **Saving** | Spinner on save button |
| **Exporting** | Download button shows spinner |
| **Error** | Error message with retry option |

### Layout (collapsed)

```
┌──────────────────────────────────┐
│ Cover Letter                     │
├──────────────────────────────────┤
│  [Optional: Paste job desc...]   │
│  [Generate draft]                │
│  ───  or  ───                   │
│  Recipient Name: [____]         │
│  Recipient Title: [____]        │
│  Company: [__________]          │
│  Body:                          │
│  ┌────────────────────────────┐ │
│  │ Generated cover letter     │ │
│  │ text in textarea...        │ │
│  │                            │ │
│  └────────────────────────────┘ │
│  Salutation: [__________]      │
│  Closing: [__________]         │
│  [Save] [Export PDF]           │
└──────────────────────────────────┘
```

### Integration

- Import `CoverLetterPanel` in `resume-builder.tsx` and render it in the sidebar `<aside>` after the existing panels
- Create a `CoverLetterDocument` type (exported from the domain package or defined in the panel)
- Uses the existing `handleApplySuggestion` pattern for error handling but with its own save/export flows

---

## 6. Package Exports

- `packages/ai/src/index.ts`: add `export { generateCoverLetter } from "./cover-letter/index"`
- `packages/rendering/package.json`: add `"./cover-letter-pdf": "./src/cover-letter-pdf.tsx"` to exports

---

## 7. Domain Type

Add `CoverLetterDocument` type to `packages/domain/src/index.ts`:

```typescript
export type CoverLetterDocument = {
  id: string;
  resumeId: string;
  title: string;
  recipientName: string;
  recipientTitle: string;
  companyName: string;
  companyAddress: string;
  salutation: string;
  body: string;
  closing: string;
  jobDescription: string;
};
```

---

## Files Changed (Summary)

| Layer | Files |
|---|---|
| Schema | `prisma/schema.prisma` + migration |
| Domain | `packages/domain/src/index.ts` |
| AI | `packages/ai/src/cover-letter/{types,generate,index}.ts`, `packages/ai/src/index.ts` |
| Rendering | `packages/rendering/src/cover-letter-pdf.tsx`, `packages/rendering/package.json` |
| API (cover letter) | `apps/web/app/api/resumes/[resumeId]/cover-letter/route.ts`, `generate/route.ts` |
| API (export) | `apps/web/app/api/export/cover-letter-pdf/route.ts` |
| UI | `apps/web/app/builder/_analysis/cover-letter-panel.tsx`, `apps/web/app/builder/resume-builder.tsx` |
| Docs | ROADMAP, PROJECT_STATUS, CHANGELOG |
| Tests | `packages/ai/__tests__/cover-letter/` (4–6 tests for mock generator) |

---

## What's NOT in scope

- No separate cover letter builder page (it's a panel in the existing builder)
- No live preview panel (user writes in the textarea, exports to see the result)
- No auto-send, email integration, or sharing
- No multiple cover letters per resume (upsert by resumeId)
- No AI provider integration beyond the mock generator
- No template selection (uses the resume's template styling)
