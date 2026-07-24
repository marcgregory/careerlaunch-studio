# AI-Powered Job Application Tracker

> **Status:** Proposed — Not yet scheduled  
> **Phase:** Future Feature (post-MVP)  
> **Author:** Product Team  
> **Last Updated:** 2026-07-24

---

## Overview

Extend the Resume Builder into a **Career Management Platform** by introducing an Application Tracker that helps users organize and monitor every job application from a single dashboard.

The goal is **not** to replace Indeed, LinkedIn, JobStreet, Greenhouse, Lever, or Workday, but to provide a centralized place where users can track their job search regardless of where they applied.

---

## Objectives

- Track every job application in one place.
- Link applications to the exact resume version used.
- Reduce manual updates through AI-assisted email detection.
- Provide analytics across the user's entire job search.
- Keep users in full control of every status change.

---

## Phase 1 — MVP

### Create Application

Users can manually create an application with the following fields:

| Field | Type | Notes |
|-------|------|-------|
| Company | Text | Required |
| Position | Text | Required |
| Job URL | URL | Optional |
| Source | Enum | See values below |
| Resume Used | Relation | Links to `ResumeDocument` |
| Date Applied | Date | Required |
| Notes | Rich text | Optional |

**Source values:** Indeed · LinkedIn · JobStreet · Greenhouse · Lever · Workday · Company Website · Other

---

### Application Status

```
Wishlist → Preparing → Applied → Assessment → Phone Screen
→ Interview → Final Interview → Offer → Accepted
                                              ↓
                                          Rejected / Withdrawn
```

| Status | Description |
|--------|-------------|
| Wishlist | Saved, not yet applied |
| Preparing | Tailoring resume / cover letter |
| Applied | Submitted |
| Assessment | Online test received |
| Phone Screen | Initial recruiter call |
| Interview | On-site or video interview |
| Final Interview | Last round |
| Offer | Offer received |
| Accepted | Offer accepted |
| Rejected | Application rejected |
| Withdrawn | User withdrew application |

---

### Timeline

Every status change automatically creates an immutable event log entry.

```
Jul 10  Application created
Jul 11  Applied
Jul 18  Assessment received
Jul 25  Interview scheduled
Jul 30  Offer received
```

---

### Dashboard Statistics

| Metric | Description |
|--------|-------------|
| Total Applications | All tracked applications |
| Applied | Count in Applied+ states |
| Interviews | Count in Interview states |
| Offers | Count in Offer/Accepted |
| Accepted | Count of Accepted |
| Rejected | Count of Rejected |

**Charts:**
- Applications per week (bar)
- Application → Interview conversion rate (funnel)
- Interview → Offer conversion rate (funnel)
- Offer → Accepted rate (funnel)

---

## Data Architecture

```
ResumeDocument
    │
    ├── Application (many)
    │       │
    │       ├── Timeline Events (many)
    │       ├── Notes
    │       ├── Attachments
    │       ├── AI Suggestions
    │       └── Email Events (future)
    │
    └── CoverLetter (many)
```

> **Important:** Application status lives on `Application`, not on `ResumeDocument`.  
> One resume may be linked to many applications (Google, Stripe, Canva, Shopify, etc.).

---

## Phase 2 — AI Email Integration

### Supported Providers

- Gmail (OAuth 2.0)
- Outlook / Microsoft 365 (OAuth 2.0)

> No passwords stored. OAuth tokens only. User can revoke access at any time.

### AI Email Detection

The system watches for recruiting-related emails and **suggests** a status update — it never applies one automatically.

| Email Type | Suggested Status |
|------------|-----------------|
| Interview invitation | Interview |
| Assessment email | Assessment |
| Offer letter | Offer |
| Rejection email | Rejected |

### UX Rule — User Always Confirms

```
AI detects: "Interview invitation from Stripe"
                        ↓
         Show notification to user:
  "We detected an interview invitation from Stripe."
         [ Update Status ]   [ Dismiss ]
```

**Rationale:**
- Prevents incorrect AI decisions from corrupting data.
- Keeps users in full control of their application history.
- Builds trust in the AI feature through transparency.

---

## Phase 3 — Browser Extension

**Supported job boards:** Indeed · LinkedIn Jobs · JobStreet · Greenhouse · Lever · Ashby · Workday

**Flow:**
```
User clicks "Save Job" on job board
            ↓
Extension extracts:
  - Company
  - Position
  - Location
  - Salary range
  - Job URL
  - Job description
            ↓
Application created automatically in CareerLaunch
```

---

## Phase 4 — Calendar Integration

- Detect interview invitations in email.
- Suggest `Interview Scheduled` status update.
- Extract: date, time, meeting link, recruiter name.
- One-click confirmation from notification.

---

## AI Features (Future)

| Feature | Phase |
|---------|-------|
| Detect interview emails | 2 |
| Detect rejection emails | 2 |
| Detect offer letters | 2 |
| Suggest follow-ups after X days | 2 |
| Summarize recruiter emails | 2 |
| Generate interview preparation checklists | 3 |
| Generate company research | 3 |
| Generate tailored cover letters | 1 (partial — exists) |
| Suggest resume improvements for a job description | 1 (partial — exists) |

---

## Notifications

Examples of proactive nudges:

- *"Your Google application hasn't been updated in 10 days."*
- *"Interview tomorrow at 2:00 PM."*
- *"Offer expires in 3 days."*
- *"Follow up with recruiter?"*

---

## Analytics (Advanced)

```
Applications
    ↓
Interviews
    ↓
Offers
    ↓
Accepted
```

Additional metrics:

| Metric | Description |
|--------|-------------|
| Average response time | Days from Applied → first recruiter contact |
| Most successful resume | Which resume generates the most interviews |
| Most successful job board | Which source generates the most offers |
| Most responsive companies | Companies with fastest response times |

---

## Security Requirements

- OAuth only — no email passwords stored.
- User explicitly grants and controls email access.
- User can disconnect integrations at any time.
- Minimize requested OAuth scopes (read-only where possible).
- Encrypt OAuth tokens at rest.
- Follow least-privilege principles throughout.
- Audit log for all AI-triggered suggestions.

---

## Out of Scope (Initial Release)

| Feature | Reason |
|---------|--------|
| Auto-applying to jobs | TOS violations on most job boards |
| Auto-changing status without user confirmation | Breaks trust, risk of data corruption |
| Reading emails without explicit user consent | Privacy / legal risk |
| Editing external job applications | Not technically feasible |
| Bypassing job board APIs or ToS | Legal risk |

---

## Success Criteria

Users should be able to:

- ✅ Track every application in one place.
- ✅ Link applications to the exact resume version used.
- ✅ Receive AI-assisted status suggestions from recruiting emails.
- ✅ Confirm status updates with a single click.
- ✅ View analytics across their entire job search.
- ✅ Manage applications independently of the job board used.

The system must **augment** the user's workflow while keeping them in **full control** of all application status changes.
