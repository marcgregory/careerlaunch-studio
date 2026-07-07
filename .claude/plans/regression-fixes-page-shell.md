# Plan: Fix Three Page-Shell Regressions

## Problem Summary

Three regressions remain after the AppHeader refactor, all caused by inconsistent page layout usage across internal authenticated pages.

## Current State Audit

| Page | AppHeader | ← Dashboard Breadcrumb | Sticky Sidebar | Notes |
|------|-----------|----------------------|----------------|-------|
| `/` (homepage) | ✅ | N/A (public) | N/A | Correct |
| `/dashboard` | ✅ | N/A (is Dashboard) | ❌ `top-7` wrong | Sidebar doesn't stay visible on scroll |
| `/billing` (Pricing) | ✅ | ❌ Missing | N/A | Uses bare `AppHeader` with no breadcrumb |
| `/account/billing` | ❌ Missing | ✅ Has breadcrumb in content | N/A | No AppHeader, no `pt-[52px]` offset |
| `/import` | ❌ Missing | ✅ Has breadcrumb in content | N/A | No AppHeader, no `pt-[52px]` offset |
| `/builder` | ✅ | ✅ (via ArrowLeft button) | N/A | Correct, specialized header |

## Root Cause

The `AppHeader` was centralized, but the **page shell/layout** was not. Each page independently decides:
- Whether to render AppHeader at all
- What goes inside AppHeader (logo vs breadcrumb)
- Whether to add `pt-[52px] sm:pt-[60px]` for header offset
- Whether the content has a breadcrumb

## Implementation Plan

### 1. Fix Dashboard Sidebar Sticky Positioning

**File**: `apps/web/app/dashboard/page.tsx`

**Problem**: The workshop sidebar has `lg:sticky lg:top-7 lg:self-start` but `top-7` (28px) is too low — it places the sticky position behind the fixed header (60px).

**Fix**: Change `lg:top-7` to `lg:top-[84px]` (= 60px header + 24px gap). Also verify parent container doesn't break sticky: the section parent uses `grid` which is safe for sticky children. No `overflow:hidden`, `transform`, or `filter` on ancestors.

**Change**: Line 133: `lg:top-7` → `lg:top-[84px]`

### 2. Add AppHeader + Breadcrumb to `/account/billing`

**File**: `apps/web/app/account/billing/page.tsx`

**Current state**: Renders bare `<main>` with no AppHeader at all. Has a manual `← Dashboard` link.

**Fix**: 
- Import and render `AppHeader` + `AppLogo` inside the `<main>` element
- Add `pt-[52px] sm:pt-[60px]` to the `<main>` className
- Keep the existing `← Dashboard` breadcrumb (it's already there and correct)
- The AppHeader goes at line 114-115, before the content wrapper

### 3. Add AppHeader + Breadcrumb to `/import`

**File**: `apps/web/app/import/page.tsx`

**Current state**: Renders bare `<main>` with no AppHeader. Has a `← Dashboard` link in the header area.

**Fix**:
- Import and render `AppHeader` + `AppLogo` inside the `<main>` element  
- Add `pt-[52px] sm:pt-[60px]` to the `<main>` className
- Keep the existing `← Dashboard` link in content area
- Move the existing dashboard link to match the pattern

### 4. Add `← Dashboard` Breadcrumb to `/billing` (Pricing)

**File**: `apps/web/app/billing/page.tsx`

**Current state**: Uses AppHeader with AppLogo only. Content inside a `max-w-5xl` wrapper with Pricing title.

**Fix**: 
- Add `← Dashboard` breadcrumb inside the content area, before the Pricing header
- Match the breadcrumb styling from `/account/billing`:
  ```
  ← Dashboard
  ```
  "Pricing" title follows after.

## Acceptance Criteria

**Desktop:**
- ✅ AppHeader remains fixed on all authenticated pages
- ✅ `/dashboard` sidebar stays visible while scrolling resume list (`lg:top-[84px]`)
- ✅ Only the right content column scrolls
- ✅ `/account/billing` has AppHeader matching other pages
- ✅ `/import` has AppHeader matching other pages  
- ✅ `/billing` (Pricing) shows `← Dashboard` breadcrumb before the title
- ✅ All internal pages have consistent `← Dashboard` breadcrumb pattern

**Mobile:**
- ✅ Sidebar naturally stacks below content
- ✅ Sticky disabled via `lg:` prefix on Tailwind classes
