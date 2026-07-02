# CareerLaunch Studio PRD

Last updated: 2026-07-03

## Objective

Help job seekers create better application documents faster, with enough guidance to reduce blank-page anxiety and enough control to make the final resume feel personal.

## Competitive Reference

Zety's public site presents a category benchmark with resume, CV, and cover-letter builders; resume templates; resume checking; job matches; template filters; ready-made content; and PDF, Word, and TXT downloads. CareerLaunch Studio should compete on the same user problem while using original design, copy, workflows, and content.

## Personas

### Career Switcher

Needs to reposition prior experience for a new role. Values transferable-skill prompts, examples, and confidence that the resume will pass screening.

### Early-Career Job Seeker

Needs structure and wording help. Values templates, examples, and simple explanations of what to include.

### Busy Professional

Needs to update an existing resume quickly for a specific job. Values import, rewrite assistance, versioning, and fast export.

### Subscription Buyer

May only need the product for a short period. Values transparent pricing, clear cancellation, and immediate access to polished exports.

## Functional Requirements

- Users can register, sign in, sign out, and recover account access.
- Users can create, edit, duplicate, rename, and delete resume documents.
- Users can edit structured resume sections with validation and autosave.
- Users can preview a resume while editing.
- Users can choose at least one original ATS-friendly template in Sprint 1.
- Users can receive section-specific suggestions for summary, experience bullets, skills, and missing fields.
- Users can run a resume check that reports completeness, readability, action verbs, measurable achievements, section coverage, and contact readiness.
- Users can export a PDF in Sprint 1.
- Users can manage subscription status before paid feature release.
- Admins can review anonymized product metrics, template usage, and error rates after MVP.

## Non-Functional Requirements

- Builder screens should feel responsive on common laptop and mobile widths.
- Resume drafts must autosave without losing user input.
- P95 app route response time should stay under 500 ms for non-AI actions.
- PDF export should complete in under 10 seconds for normal resumes.
- Accessibility target is WCAG 2.2 AA for core builder flows.
- Sensitive data must be encrypted in transit and protected with least-privilege access.
- Billing, auth, and export actions must be auditable.

## User Stories

- As a job seeker, I can create an account so my resumes are saved across devices.
- As a job seeker, I can fill guided sections so I know what information belongs in a resume.
- As a career switcher, I can get rewrite suggestions so my experience matches a target role.
- As a busy professional, I can duplicate a resume so I can tailor it for a new job.
- As a paying user, I can export a polished PDF so I can apply immediately.
- As a cautious buyer, I can understand what is free and what is paid before checkout.

## Acceptance Criteria

- A new user can sign up and reach the builder in under two minutes.
- A resume draft persists after refresh and sign out/sign in.
- Required fields show clear validation.
- The preview updates after edits without layout breakage.
- Resume scoring returns at least five actionable checks.
- PDF export matches preview closely enough for user trust.
- Paid feature gates are explicit and do not trap user data.

## Metrics

- Activation: percentage of new users who create a resume draft.
- Builder completion: percentage of drafts with contact, experience or education, skills, and summary.
- Export conversion: percentage of completed resumes exported.
- Paid conversion: percentage of active users who start a paid plan.
- Time to first export.
- Resume checker engagement.
- Refund and cancellation reasons.

## Open Questions

- Should the first niche be general job seekers, students, or career switchers?
- Should AI suggestions be included in free tier with limits or reserved for paid plans?
- Should import from existing PDF/DOCX be Sprint 2 or later?
- Which export engine provides the best balance of fidelity and operational simplicity?

