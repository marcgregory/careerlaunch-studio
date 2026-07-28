/**
 * `navigation-overlay-store` — pure store for the global navigation overlay.
 *
 * Lives in a `.ts` file (not `.tsx`) so Vitest's import-analysis pipeline
 * doesn't choke on JSX when a test suite imports the show/hide functions.
 * The React-facing mount component in `navigation-overlay.tsx` subscribes
 * to this store via `useSyncExternalStore`.
 *
 * Why a module-level store (and not React Context)?
 *
 *   The dashboard's `NewResumeButton` calls `show()` synchronously on click
 *   and then triggers a soft navigation to `/builder?resumeId=…`. The
 *   dashboard route segment unmounts in the same tick — anything held in a
 *   React Context inside that segment would unmount too, and the user
 *   would see a brief bare-shell flash before the builder's first paint
 *   (the "flicker" this whole change set fixes).
 *
 *   A module-level singleton is unaffected by tree mutations, so the
 *   overlay portal mounted in the root layout survives any number of
 *   route segments mounting and unmounting on top of it.
 */

const SLOW_THRESHOLD_MS = 4000;

export type NavigationOverlayShowArgs = {
  title: string;
  subtitle: string;
  slowSubtitle: string;
  slowThresholdMs?: number;
};

export type NavigationOverlayState = {
  open: boolean;
  title: string;
  subtitle: string;
  slowSubtitle: string;
  slowThresholdMs: number;
};

export const INITIAL_NAVIGATION_OVERLAY_STATE: NavigationOverlayState = {
  open: false,
  title: "",
  subtitle: "",
  slowSubtitle: "",
  slowThresholdMs: SLOW_THRESHOLD_MS,
};

let currentState: NavigationOverlayState = INITIAL_NAVIGATION_OVERLAY_STATE;
const listeners = new Set<() => void>();

/** `useSyncExternalStore` snapshot reader. */
export function getNavigationOverlaySnapshot(): NavigationOverlayState {
  return currentState;
}

/** `useSyncExternalStore` SSR snapshot (always closed, never shows). */
export function getNavigationOverlayServerSnapshot(): NavigationOverlayState {
  return INITIAL_NAVIGATION_OVERLAY_STATE;
}

/** `useSyncExternalStore` subscription. Returns an unsubscribe function. */
export function subscribeNavigationOverlay(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Imperative API used by mutations (`useCreateResume`, future flows). */
export function show(args: NavigationOverlayShowArgs): void {
  currentState = {
    open: true,
    title: args.title,
    subtitle: args.subtitle,
    slowSubtitle: args.slowSubtitle,
    slowThresholdMs: args.slowThresholdMs ?? SLOW_THRESHOLD_MS,
  };
  emit();
}

export function hide(): void {
  if (!currentState.open) return;
  currentState = { ...currentState, open: false };
  emit();
}

function emit() {
  for (const l of listeners) l();
}

/**
 * Test-only reset. Production code should never need this — the overlay is
 * a singleton, and `hide()` is a no-op when nothing is open. Used to keep
 * tests deterministic when they import the module-level `currentState`.
 */
export function __resetNavigationOverlayForTests(): void {
  currentState = INITIAL_NAVIGATION_OVERLAY_STATE;
  listeners.clear();
}