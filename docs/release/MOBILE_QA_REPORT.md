# Mobile QA Report — v0.9.5-alpha

**Date:** 2026-07-05

**Target Viewport:** 375px width (mobile-first breakpoint)

**Status:** ⬜ PENDING (requires browser-based verification on mobile viewport)

---

## Screens to Verify

| Screen | Status | Overflow | Tap Targets | Forms | Navigation | Issues |
|---|---|---|---|---|---|---|
| Login / Register | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| Dashboard | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| Resume Builder | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| AI Tailoring Panel | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| Cover Letter Builder | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| Billing / Pricing | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| Account / Billing | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| Export | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |

---

## Key Checks

### No Content Overflow
- [ ] All screens fit within 375px without horizontal scroll
- [ ] Tables and grids reflow or collapse
- [ ] Long text wraps properly

### Tap Targets (min 44×44px)
- [ ] All primary CTAs (buttons, links) are ≥44px in both dimensions
- [ ] Spacing between tappable elements prevents mis-taps

### Forms
- [ ] Inputs don't trigger unwanted zoom on iOS
- [ ] Form fields are fully visible when keyboard is open
- [ ] Dropdowns and selects are usable on mobile

### Critical Flow
- [ ] Login → Builder → AI Analysis → Export completes on mobile
- [ ] All modals are scrollable and closable

### Navigation
- [ ] Hamburger menu (or equivalent) operable
- [ ] Sidebar collapses or slides in/out
- [ ] Back navigation works correctly

---

## Issues Found

| # | Screen | Issue | Severity | Notes |
|---|---|---|---|---|
| — | | | | |

---

## Acceptance Criteria

- [ ] No content overflow or horizontal scroll on 375px viewport
- [ ] All primary CTAs ≥44×44px tap target
- [ ] Forms fillable without unwanted zoom
- [ ] Critical flows functional: login → builder → AI → export
- [ ] Navigation operable
