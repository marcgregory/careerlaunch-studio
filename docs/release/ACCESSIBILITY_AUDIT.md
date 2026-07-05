# Accessibility Audit — v0.9.5-alpha

**Date:** 2026-07-05

**Standard:** WCAG 2.1 AA

**Method:** Keyboard-only navigation + code review

**Status:** ⬜ PENDING (requires browser-based verification)

---

## Areas Audit

### Navigation
- [ ] Sidebar links receive focus in logical order
- [ ] Skip-to-content link present and functional
- [ ] Breadcrumbs navigable via keyboard
- [ ] Focus indicator visible on all nav items

### Resume Builder
- [ ] Add/remove/reorder sections keyboard-operable
- [ ] Autosave indicators announced by screen reader
- [ ] Section fields accessible via Tab
- [ ] Drag-and-drop has keyboard alternative

### AI Suggestions
- [ ] Accept/dismiss buttons keyboard-operable (Enter/Space)
- [ ] Feedback 👍/👎 accessible via keyboard
- [ ] Confidence bar has accessible label
- [ ] SuggestionDiffModal focus-trapped and closable with Escape
- [ ] "Why" heading properly structured

### Diff View
- [ ] Before/after comparison keyboard-operable
- [ ] Changes announced by screen reader

### Billing / Pricing
- [ ] Plan selection keyboard-operable
- [ ] Upgrade/downgrade CTAs clearly labeled
- [ ] Feature comparison table has proper headers

### Export
- [ ] Download button keyboard-operable
- [ ] Format selection accessible

### Dialogs
- [ ] Focus trap enabled when dialog opens
- [ ] Escape closes dialog
- [ ] Focus returns to trigger element on close
- [ ] Close button labeled

### Forms
- [ ] All inputs have associated labels
- [ ] Error messages announced by screen reader
- [ ] Required fields indicated

## Keyboard Testing

| Check | Login | Dashboard | Builder | AI Panel | Billing | Export |
|---|---|---|---|---|---|---|
| Tab through all elements | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Focus indicator visible | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| All actions available | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Screen reader labels | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

## Issues Found

| # | Area | Violation | WCAG Criterion | Severity | Fix |
|---|---|---|---|---|---|
| — | | | | | |

---

## Acceptance Criteria

- [ ] Visible focus indicators on all interactive elements (≥2:1 contrast ratio against background)
- [ ] Logical tab order follows visual reading order
- [ ] All controls keyboard-operable (Enter/Space for buttons, Arrow keys for lists)
- [ ] No keyboard traps
- [ ] Screen reader identifies key actions: "Apply suggestion", "Dismiss", "Export PDF"
- [ ] All error messages are announced
- [ ] Dialogs trap focus and return it on close
