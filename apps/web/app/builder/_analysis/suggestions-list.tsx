"use client";

/**
 * @deprecated This component is no longer used. Suggestion rendering is handled
 * inline in HealthDashboard and TailoringPanel. Keep the file for reference.
 *
 * Issues that led to deprecation:
 * - Didn't pass resumeId to SuggestionCard (broke the feedback widget)
 * - Didn't handle info-only suggestions (no suggestedText) separately
 * - HealthDashboard renders suggestions with severity grouping + score gauge
 * - TailoringPanel renders suggestions by category (summary/experience/skills)
 */

export {}
