# Sprint 4 — Import Existing Resume and Version Duplication

## Scope

Two independent features, implemented in order. 4C (PDF/DOCX Import) deferred.

### 4A — Version Duplication

**Goal:** Users can duplicate any existing resume, preserving all content, template, and structure. The copy is a new draft — edits to one do not affect the other.

**Files:**

| File | Change |
|---|---|
| `apps/web/app/api/resumes/[resumeId]/duplicate/route.ts` | **New** — `POST` endpoint, clones resume + creates version record |
| `apps/web/app/api/resumes/route.ts` | No change (existing `POST` creates blank) |
| `apps/web/app/dashboard/page.tsx` | Add "Duplicate" button + API call per resume card |
| `packages/domain/src/index.ts` | No change needed |

**API contract:**
```
POST /api/resumes/:resumeId/duplicate
→ 201 { resume: ResumeDocument }
```

**Behavior:**
- Ownership check (same user)
- Reads existing resume body
- Creates new `ResumeDocument` with title `"Copy of {title}"`
- Creates initial `ResumeVersion` with note `"Duplicated from {originalId}"`
- Returns the new resume so the dashboard can redirect or re-render

**Client (Dashboard):**
- Each resume card gets a "Duplicate" icon button (secondary style, no text)
- On click: `POST /api/resumes/{id}/duplicate`
- On success: refresh the resume list (client-side router refresh)
- On error: show a toast / alert
- Loading state: spinner on the clicked card

**E2E coverage (`apps/web/tests/duplicate-flow.spec.ts`):**
- Sign up → create resume → duplicate → verify copy exists with different id
- Verify original is unchanged after duplicate
- Verify duplicate title is `"Copy of ..."`

### 4B — Resume Import MVP (text / paste)

**Goal:** Users can paste resume text and have it parsed into a structured draft. No direct mutation of existing resumes.

**Flow:**
1. User clicks "Import resume" on dashboard
2. Textarea appears — user pastes plain text
3. Click "Parse" → `POST /api/import/text` → returns parsed `ResumeDocument`
4. Preview shows the parsed result in a read-only template preview
5. User clicks "Create draft" → saves as a new resume → redirects to builder

**Files:**

| File | Change |
|---|---|
| `apps/web/app/api/import/text/route.ts` | **New** — parse endpoint |
| `apps/web/app/import/page.tsx` | **New** — import UI (textarea → preview → confirm) |
| `packages/ai/src/import/text-parser.ts` | **New** — pure parser logic |
| `packages/ai/src/import/index.ts` | **New** — barrel export |
| `packages/ai/package.json` | Add `exports` entry for `./import` |
| `apps/web/lib/resume-store.ts` | No change (reuses `createStarterResume`, `toStoredResume`) |
| `apps/web/app/dashboard/page.tsx` | Add "Import resume" button |

**Parser approach:**
- Pure function, no AI dependency
- Regex-based section detection: split text on common section headers (Experience, Education, Skills, Summary, Projects, Certifications)
- Basic contact extraction: email regex, phone regex, first line as name heuristic
- Returns `{ parsed: Partial<ResumeDocument>, confidence: number, warnings: string[] }`

**API contract:**
```
POST /api/import/text
Body: { text: string }
→ 200 { parsed: Partial<ResumeDocument>, confidence: number, warnings: string[] }
```

**State machine for import page:**
- `idle` — empty textarea + instructions
- `parsing` — loading spinner
- `preview` — parsed result shown in read-only preview, "Create draft" + "Edit" buttons
- `error` — parse failed, retry button

**Edge cases:**
- Empty text → 400
- Text too long (>50k chars) → 413
- Parse returns low confidence → warning banner but still show preview
- Unparseable text → show "Could not detect sections" but still create a draft with raw text in summary

### 4C — PDF/DOCX Import

Deferred. No implementation in this sprint.

## Verification

- `npm run build`
- `npm run test`
- `npm run typecheck`
- E2E: duplicate flow
- Manual: paste text → parse → preview → create → builder loads

## What is NOT in this sprint

- PDF/DOCX import (deferred to future)
- Import version history tracking
- Merge/compare UI
- Batch import
