"use client";

import { useCallback } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { primaryButtonClass } from "@careerlaunch/ui";
import { useCreateResume } from "./use-create-resume";

type Variant = "new-resume" | "first-draft";

type NewResumeButtonProps = {
  /** Which icon + label pair to render. */
  variant?: Variant;
  /** Fallback href for anonymous users (where they go if not signed in). */
  fallbackHref?: string;
};

/**
 * NewResumeButton — single entry point for creating a starter resume from
 * any dashboard surface. Replaces the old `<Link href="/builder">` that
 * relied on the builder route's create-then-redirect chain (which produced
 * two server passes and an observable blank-flash).
 *
 * Behavior:
 *   - Authenticated user: triggers the global NavigationOverlay (mounted in
 *     the root layout, so it survives the dashboard unmount), calls POST
 *     /api/resumes, navigates to /builder?resumeId=… on success.
 *   - Anonymous user: clicking navigates to `fallbackHref` (default /login)
 *     so the sign-up flow can route them to the builder afterwards.
 *
 * The button is disabled while the mutation is pending so accidental
 * double-clicks cannot trigger a second create (which would hit the
 * resume-limit entitlement gate).
 */
export function NewResumeButton({
  variant = "new-resume",
  fallbackHref = "/login",
}: NewResumeButtonProps) {
  const { create, isCreating } = useCreateResume();

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      // Allow modifier keys / middle-click to keep native navigation semantics
      // (open in new tab, etc.) — only intercept the primary click path.
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }
      event.preventDefault();
      create();
    },
    [create]
  );

  const isFirstDraft = variant === "first-draft";

  return (
    <a
      href={fallbackHref}
      onClick={onClick}
      className={`${primaryButtonClass} ${isCreating ? "pointer-events-none opacity-70" : ""}`}
      aria-busy={isCreating}
      aria-disabled={isCreating}
      data-testid="new-resume-button"
    >
      {isFirstDraft ? (
        <>
          Create first draft
          <ArrowRight size={18} aria-hidden="true" />
        </>
      ) : (
        <>
          <Plus size={16} aria-hidden="true" />
          <span className="hidden sm:inline">New resume</span>
        </>
      )}
    </a>
  );
}