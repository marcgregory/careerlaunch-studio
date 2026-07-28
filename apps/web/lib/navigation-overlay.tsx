"use client";

/**
 * Global navigation overlay — masks the entire screen across Next.js route
 * transitions, so the user never sees a brief blank/dashboard flash between
 * the originating page unmounting and the destination page painting.
 *
 * Why this lives at the root layout (not in the originating component):
 *
 *   When the dashboard's "New resume" handler calls `router.push(...)`, the
 *   dashboard route segment unmounts as soon as the new segment takes over.
 *   A `<ProgressOverlay>` rendered inside the dashboard is unmounted at the
 *   same instant — leaving a window where no overlay is on screen and the
 *   user sees the bare shell layout before the destination's `loading.tsx`
 *   or first paint. That window is the "flicker".
 *
 *   Mounting the overlay in the root layout (which never unmounts) keeps the
 *   backdrop visible across the entire transition. The actual store lives
 *   in `navigation-overlay-store.ts` (a plain `.ts` module) so it survives
 *   any number of route-segment unmounts.
 *
 * Usage:
 *   1. Wrap the app in `<NavigationOverlayProvider>` inside `app/layout.tsx`.
 *   2. In a component about to start a long-running create/import/etc.,
 *      call `useNavigationOverlay().show({ title, subtitle, slowSubtitle })`.
 *   3. When the destination route has finished mounting (or the operation
 *      has resolved), call `hide()`.
 */

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import {
  getNavigationOverlayServerSnapshot,
  getNavigationOverlaySnapshot,
  hide as hideOverlay,
  show as showOverlay,
  subscribeNavigationOverlay,
  type NavigationOverlayState,
} from "./navigation-overlay-store";

export {
  hide,
  show,
  type NavigationOverlayShowArgs,
} from "./navigation-overlay-store";

export function NavigationOverlayProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <NavigationOverlayMount />
    </>
  );
}

/**
 * Hook used by long-running client operations to claim/release the global
 * overlay. The `show`/`hide` references come from the module-level store,
 * so the hook does not depend on being rendered inside the provider for
 * the imperative side to work — but `useSyncExternalStore` still requires
 * a React-rendered subscription to drive the portal.
 */
export function useNavigationOverlay() {
  return { show: showOverlay, hide: hideOverlay };
}

/**
 * Subscribes to the store and renders the portal. Kept as a sibling of
 * `{children}` (not nested inside it) so the portal is independent of any
 * route-segment unmount.
 */
function NavigationOverlayMount() {
  const state = useSyncExternalStore(
    subscribeNavigationOverlay,
    getNavigationOverlaySnapshot,
    getNavigationOverlayServerSnapshot
  );

  if (!state.open) return null;
  return <NavigationOverlayPortal state={state} />;
}

/**
 * The actual overlay markup, rendered into `document.body` via a portal so
 * it is independent of any layout-tree unmounts during navigation.
 */
function NavigationOverlayPortal({ state }: { state: NavigationOverlayState }) {
  // `isSlow` flips after `slowThresholdMs`. The component early-returns
  // when `open` is false, so the timer is naturally torn down on next
  // mount/unmount cycle.
  const isSlow = useSlow(state.slowThresholdMs);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="navigation-overlay"
      className="fixed inset-0 z-[100] grid place-items-center bg-[#123c3a]/55 px-4 backdrop-blur-md"
    >
      <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-white p-8 text-center shadow-[0_30px_80px_rgba(18,60,58,0.45)]">
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-[28px] bg-[#b9ff66]/15 blur-2xl" />

        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a] shadow-[0_4px_0_#123c3a]">
          <Loader2 size={32} className="animate-spin" aria-hidden="true" />
        </div>

        <h2 className="font-signal mt-6 text-2xl font-black leading-[0.95] tracking-[-0.04em] text-[#123c3a]">
          {state.title}
        </h2>
        <p className="mx-auto mt-3 max-w-xs text-sm font-medium leading-6 text-[#4b4b4b]">
          {isSlow ? state.slowSubtitle : state.subtitle}
        </p>

        <div className="mt-6 flex items-center justify-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-[#123c3a]/40 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function useSlow(thresholdMs: number): boolean {
  // The hook only runs while the overlay is open (its parent returns null
  // otherwise), so a freshly-mounted instance always starts at `false` and
  // the timer is a per-mount side effect.
  const [isSlow, setIsSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setIsSlow(true), thresholdMs);
    return () => window.clearTimeout(id);
  }, [thresholdMs]);
  return isSlow;
}