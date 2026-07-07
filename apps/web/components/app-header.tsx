import Link from "next/link";
import type { ReactNode } from "react";

interface AppHeaderProps {
  /** Left-side content (logo, breadcrumb, back button, title, etc.) */
  children: ReactNode;
  /** Right-side actions (sign out, export, save, etc.) */
  actions?: ReactNode;
  /** Optional "Studio" badge next to the logo */
  showStudioBadge?: boolean;
}

/**
 * Shared fixed header used across homepage, dashboard, and builder pages.
 *
 * Renders a fixed top bar with the same height, background, and positioning
 * everywhere. Left slot via `children`, right slot via `actions`.
 *
 * Main content area must offset the fixed header:
 *   pt-[52px] sm:pt-[60px]
 */
export function AppHeader({ children, actions }: AppHeaderProps) {
  return (
    <header className="no-print fixed inset-x-0 top-0 z-40 w-full border-b border-[#123c3a]/10 bg-[#f3f3f3]/85 px-3 py-2 backdrop-blur-xl sm:px-4 sm:py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
          {children}
        </div>
        {actions && (
          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

/** Standard logo link used across all pages */
export function AppLogo() {
  return (
    <Link
      href="/"
      className="font-signal inline-flex items-center gap-2 text-xl font-black tracking-[-0.08em] transition hover:text-[#6bbf22] sm:text-2xl"
    >
      CareerLaunch
      <span className="rounded-full bg-[#b9ff66] px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#123c3a] sm:py-1">
        Studio
      </span>
    </Link>
  );
}
