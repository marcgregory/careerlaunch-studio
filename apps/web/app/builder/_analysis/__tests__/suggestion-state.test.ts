import { describe, expect, it } from "vitest";
import {
  countAppliedSuggestions,
  countDetectedIssues,
  countDismissedSuggestions,
  isAppliedSuggestion,
  isDismissedSuggestion,
} from "../suggestion-state";

describe("resume health suggestion state", () => {
  it("treats applied suggestions as resolved", () => {
    expect(isAppliedSuggestion({ status: "applied" })).toBe(true);
    expect(isAppliedSuggestion({ status: "accepted" })).toBe(true);
    expect(countDetectedIssues([{ status: "applied" }, { status: "accepted" }])).toBe(0);
  });

  it("treats dismissed suggestions as dismissed, not resolved", () => {
    expect(isDismissedSuggestion({ status: "dismissed" })).toBe(true);
    expect(isDismissedSuggestion({ status: "rejected" })).toBe(true);
    expect(isAppliedSuggestion({ status: "dismissed" })).toBe(false);
    expect(isAppliedSuggestion({ status: "rejected" })).toBe(false);
  });

  it("keeps dismissed suggestions in detected issue counts", () => {
    const suggestions = [
      { status: "pending" },
      { status: "dismissed" },
      { status: "rejected" },
      { status: "applied" },
    ] as const;

    expect(countAppliedSuggestions(suggestions)).toBe(1);
    expect(countDismissedSuggestions(suggestions)).toBe(2);
    expect(countDetectedIssues(suggestions)).toBe(3);
  });
});
