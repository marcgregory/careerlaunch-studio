/**
 * Pure helpers for the Builder's save pipeline.
 *
 * The component (resume-builder.tsx) holds the actual refs and effects;
 * the helpers in this file are pure so they can be unit-tested without
 * React, Next.js, or TanStack Query.
 *
 * Contract:
 *  - runSaveAttempt attempts one PUT, returns whether the server accepted it.
 *  - flushSave attempts to wait for the in-flight save, then re-saves if the
 *    resume has changed in the meantime. Returns true only when the latest
 *    snapshot is confirmed by the server.
 *  - decideBackAction encapsulates the navigation-guard policy: should the
 *    back button navigate, flush, or block?
 */

export type SaveState = "Saved" | "Unsaved" | "Saving" | "Error";

export type BackAction = "navigate" | "flush" | "block";

/**
 * Decide what the back-to-dashboard button should do given the current
 * save state and whether a save is in flight.
 *
 * - "navigate": nothing to save, safe to leave.
 * - "flush":    there are pending or in-flight changes; wait, save, then go.
 * - "block":    a save just failed; stay so the user can retry.
 */
export function decideBackAction(args: {
  saveState: SaveState;
  hasInFlightSave: boolean;
  hasUnsavedSnapshot: boolean;
}): BackAction {
  if (args.saveState === "Error") return "block";
  if (args.saveState === "Saving" || args.hasInFlightSave) return "flush";
  if (args.saveState === "Unsaved" || args.hasUnsavedSnapshot) return "flush";
  return "navigate";
}

/**
 * Apply the back button's policy. Returns true if the caller should
 * navigate to /dashboard, false if the caller should stay in the builder.
 */
export async function applyBackAction(
  decide: BackAction,
  flush: () => Promise<boolean>
): Promise<boolean> {
  if (decide === "navigate") return true;
  if (decide === "block") return false;
  return await flush();
}
