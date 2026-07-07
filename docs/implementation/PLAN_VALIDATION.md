# Plan: Apply react-hook-form + Zod Validation to All Forms

## Summary

The project currently has **no client-side validation library**. Auth forms rely on basic HTML5 attributes (`required`, `type="email"`, `minLength`) and server-side error redirects. The resume builder has a custom `validateResume()` function. We will add `react-hook-form` + `zod` + `@hookform/resolvers` to provide consistent, type-safe validation across every form.

---

## Step 1 — Install Dependencies

Add to `apps/web/package.json`:

- `zod`, `react-hook-form`, `@hookform/resolvers`

---

## Step 2 — Define Zod Schemas

Create `packages/domain/src/validation/auth.ts` with schemas for:

| Schema | Fields |
|---|---|
| `loginSchema` | email (required, valid email), password (required, min 8) |
| `registerSchema` | name (required, min 2), email (required, valid email), password (required, min 8) |
| `forgotPasswordSchema` | email (required, valid email) |
| `resetPasswordSchema` | password (required, min 8, at least 1 letter + 1 digit) |

Create `packages/domain/src/validation/resume.ts` with schemas for:

| Schema | Fields |
|---|---|
| `contactSchema` | fullName (required), email (required, valid email), phone (required), location, website |
| `experienceItemSchema` | role (required), company (required), location, start, end, bullets (string[]) |
| `educationItemSchema` | school (required), degree (required), location, graduation |
| `projectItemSchema` | name (required), description, bullets (string[]) |
| `summarySchema` | optional string, min 60 if non-empty |

---

## Step 3 — Convert Auth Pages to Client-Component Forms

All four auth pages move from **server-rendered `<form action="/api/...">`** to **client `"use client"` components** using `useForm` + zod resolver + `fetch()` submission.

### 3a — Login (`/login`)
- Convert to `"use client"` component
- `useForm<z.infer<typeof loginSchema>>()` with zod resolver
- Client-side: email + password validation with inline error messages
- On submit: POST `/api/auth/login` via `fetch()` as JSON
- On success: `router.push("/dashboard")`
- On error: show server error from redirect or JSON response
- Keep rate-limit/server error params from URL

### 3b — Register (`/register`)
- Same pattern. Fields: name, email, password.
- POST `/api/auth/register` as JSON
- Show inline errors: name required, email format, password min 8

### 3c — Forgot Password (`/forgot-password`)
- Same pattern. Field: email.
- POST `/api/auth/forgot-password` as JSON
- On success: show "Check your email" state (already exists in template)

### 3d — Reset Password (`/reset-password`)
- Same pattern. Field: password.
- POST `/api/auth/reset-password` as JSON with hidden token + email
- On success: `router.push("/login?reset=success")`

---

## Step 4 — Resume Builder Validation Upgrade

### 4a — Replace `validateResume()` with zod + `useForm`
- Create a `resumeSchema` combining all sub-schemas
- Initialize `useForm` with default values from `initialResume`
- Use `zodResolver(resumeSchema)`
- Remove the manual `validateResume()` function
- Keep the existing `patchResume`/`updateContact` state management but feed errors from `useForm` instead of the manual `ValidationErrors` object

### 4b — Wire `Field` and `ErrorText` components
- Replace `validation[field]` error lookups with `formState.errors[field]?.message`
- The `Field` component already accepts `error?: string` — we pass `errors.field?.message`
- Use `Controller` for complex array fields (bullets, editable lists)

### 4c — Field Arrays
- Experience, education, projects already use `item.id` as keys — map to `useFieldArray` names like `experience.0.role`
- Editable lists (skills, certifications, qualities) work with `useFieldArray`

---

## Step 5 — Update API Routes

Update auth API routes to accept **JSON** in addition to `formData` (to support client-side form submissions):

| Route | Change |
|---|---|
| `/api/auth/login` | Accept JSON `{ email, password }` in addition to formData |
| `/api/auth/register` | Accept JSON `{ name, email, password }` in addition to formData |
| `/api/auth/forgot-password` | Accept JSON `{ email }` in addition to formData |
| `/api/auth/reset-password` | Accept JSON `{ token, email, password }` in addition to formData |

---

## Step 6 — Testing

- Auth forms: submit with invalid data → inline errors appear
- Auth forms: submit with valid data → POST succeeds, redirect works
- Resume builder: blank fields → required errors shown
- Resume builder: invalid email → email format error
- Resume builder: existing flow (add/remove items, save, export) unchanged
