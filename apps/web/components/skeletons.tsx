/**
 * Reusable skeleton primitives.
 *
 * These mirror the geometry, spacing, border radius, and color tokens of the
 * real UI components. They are intentionally structural placeholders — no
 * content — so loading states reserve approximately the same space as the
 * final rendered UI and don't cause layout shift.
 *
 * The pulse is driven by `animate-pulse` and the color matches the muted text
 * token used throughout the app (`#123c3a` at low opacity).
 */

const BASE_BG = "bg-[#123c3a]/10";
const PULSE = "animate-pulse";

type SkeletonProps = {
  className?: string;
};

/** A solid block. Combine with width/height utilities. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`${BASE_BG} ${PULSE} rounded-md ${className}`} />;
}

/**
 * Mirrors `AppHeader` so the top fixed bar reserves the same vertical space
 * on every loading state. Renders the logo wordmark and right-side actions
 * as skeletons, matching the real header's structure exactly.
 */
export function SkeletonHeader({
  actions = 3,
  showBackButton = false,
  showSubtitle = false,
}: {
  /** Number of right-side action buttons/indicators to render. */
  actions?: number;
  /** Whether to render a back button on the left. */
  showBackButton?: boolean;
  /** Whether to render a small "Resume Builder"-style subtitle above the title. */
  showSubtitle?: boolean;
}) {
  return (
    <header
      aria-hidden="true"
      className="no-print fixed inset-x-0 top-0 z-40 w-full border-b border-[#123c3a]/10 bg-[#f3f3f3]/85 px-3 py-2 backdrop-blur-xl sm:px-4 sm:py-3"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
          {showBackButton && (
            <div className={`h-10 w-10 shrink-0 rounded-full border border-[#123c3a]/10 bg-white ${PULSE}`} />
          )}
          {/* AppLogo placeholder — "CareerLaunch" + Studio pill */}
          <div className="flex items-center gap-2">
            <div className={`h-6 w-28 rounded-md ${BASE_BG} ${PULSE} sm:h-7 sm:w-36`} />
            <div className={`h-4 w-12 rounded-full ${BASE_BG} ${PULSE} sm:h-5 sm:w-14`} />
          </div>
          {/* Optional subtitle + title block, mirroring the builder header */}
          {showSubtitle && (
            <div className="ml-2 hidden min-w-0 sm:block">
              <div className={`h-3 w-24 rounded ${BASE_BG} ${PULSE}`} />
              <div className={`mt-1 h-5 w-40 rounded ${BASE_BG} ${PULSE}`} />
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
          {Array.from({ length: actions }).map((_, i) => (
            <div
              key={i}
              className={`h-9 w-20 rounded-[14px] border border-[#123c3a]/10 bg-white ${PULSE} sm:h-10`}
            />
          ))}
        </div>
      </div>
    </header>
  );
}

/**
 * Mirrors the page main container — fixed header offset, max width, and
 * horizontal/vertical padding match the real page wrappers. Pages that
 * need a different max-width can override via `maxWidthClass`.
 */
export function SkeletonPage({
  children,
  maxWidthClass = "max-w-7xl",
  background = "transparent",
}: {
  children: React.ReactNode;
  maxWidthClass?: string;
  background?: string;
}) {
  return (
    <main
      className={`signal-site min-h-screen pt-[52px] text-[#123c3a] sm:pt-[60px] ${background}`}
    >
      <div className={`mx-auto ${maxWidthClass} px-5 py-6`}>{children}</div>
    </main>
  );
}

/**
 * Mirrors the `ResumeCard` used in the dashboard list — same border radius,
 * padding, and grid layout. Renders a thumbnail, badge, title, subtitle,
 * and an action button, all sized to match the real card.
 */
export function SkeletonResumeCard() {
  return (
    <article className="grid gap-4 rounded-[28px] border border-[#123c3a]/10 bg-white p-5 shadow-sm md:grid-cols-[72px_1fr_auto] md:items-start">
      <div className={`hidden h-[72px] w-[72px] rounded-[18px] ${BASE_BG} ${PULSE} md:block`} />
      <div className="min-w-0 space-y-3">
        <div className={`h-4 w-20 rounded-full ${BASE_BG} ${PULSE}`} />
        <div className={`h-6 w-48 rounded-lg ${BASE_BG} ${PULSE}`} />
        <div className={`h-4 w-36 rounded-lg ${BASE_BG} ${PULSE}`} />
        <div className={`h-3 w-24 rounded-lg ${BASE_BG} ${PULSE}`} />
      </div>
      <div className="flex items-center gap-2 self-center">
        <div className={`h-9 w-9 rounded-xl ${BASE_BG} ${PULSE}`} />
        <div className={`h-9 w-28 rounded-full ${BASE_BG} ${PULSE}`} />
      </div>
    </article>
  );
}

/**
 * Mirrors the `WorkspaceStats` sidebar on the dashboard — same dark
 * background, rounded-28px corners, and grid-of-stats layout.
 */
export function SkeletonWorkspaceStats() {
  return (
    <aside className="rounded-[28px] border border-[#123c3a] bg-[#123c3a] p-5 text-white shadow-[0_24px_70px_rgba(18,60,58,0.22)] lg:sticky lg:top-[84px] lg:self-start xl:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className={`h-12 w-12 rounded-full ${BASE_BG} ${PULSE} xl:h-14 xl:w-14`} />
        <div className={`h-7 w-16 rounded-full border border-[#b9ff66]/40 bg-white/10 ${PULSE}`} />
      </div>
      <div className="mt-6 space-y-2">
        <div className={`h-8 w-3/4 rounded-md bg-white/20 ${PULSE}`} />
        <div className={`h-5 w-1/2 rounded-md bg-white/10 ${PULSE}`} />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
          >
            <div className={`h-4 w-4 rounded ${BASE_BG} ${PULSE}`} />
            <div className={`mt-2 h-6 w-10 rounded bg-white/20 ${PULSE}`} />
            <div className={`mt-2 h-3 w-12 rounded bg-white/10 ${PULSE}`} />
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-2">
        <div className={`h-4 w-full rounded bg-white/10 ${PULSE}`} />
        <div className={`h-4 w-11/12 rounded bg-white/10 ${PULSE}`} />
        <div className={`h-4 w-3/4 rounded bg-white/10 ${PULSE}`} />
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className={`h-12 rounded-2xl border border-white/10 bg-white/[0.04] ${PULSE}`}
          />
        ))}
      </div>
      <div className={`mt-5 h-12 rounded-2xl bg-[#b9ff66]/30 ${PULSE}`} />
      <div className={`mt-4 h-11 rounded-full border-2 border-[#b9ff66]/40 bg-[#b9ff66]/20 ${PULSE}`} />
    </aside>
  );
}

/**
 * Mirrors a `Panel` shape from the builder — bordered card with a title row
 * and a body containing form fields. This is the smaller-scale builder
 * panel, not the same as the dashboard cards above.
 */
export function SkeletonFormPanel({ fields = 3 }: { fields?: number }) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#123c3a]/10 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-[#123c3a]/10 pb-2 sm:pb-3">
        <div className={`h-5 w-24 rounded ${BASE_BG} ${PULSE}`} />
        <div className={`h-7 w-16 rounded-xl ${BASE_BG} ${PULSE}`} />
      </div>
      <div className="mt-2 space-y-3 sm:mt-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className={`h-3 w-16 rounded ${BASE_BG} ${PULSE}`} />
            <div className={`h-10 w-full rounded-[14px] border border-[#123c3a]/10 bg-white ${PULSE}`} />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Mirrors a plan card on the /billing page — the rounded-30px white card with
 * a title, price, list of features, and an action button at the bottom.
 */
export function SkeletonPlanCard() {
  return (
    <article className="relative overflow-hidden rounded-[30px] border border-[#123c3a]/10 bg-white p-7 shadow-[0_24px_70px_rgba(18,60,58,0.10)]">
      <div className="space-y-3">
        <div className={`h-6 w-24 rounded-md ${BASE_BG} ${PULSE}`} />
        <div className={`h-10 w-32 rounded-md ${BASE_BG} ${PULSE}`} />
      </div>
      <ul className="mt-6 space-y-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className={`mt-0.5 h-4 w-4 rounded-full ${BASE_BG} ${PULSE}`} />
            <div className={`h-3 rounded ${BASE_BG} ${PULSE}`} style={{ width: `${75 - i * 4}%` }} />
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <div className={`h-12 w-full rounded-full border border-[#123c3a]/15 bg-white ${PULSE}`} />
      </div>
    </article>
  );
}

/**
 * Mirrors the invoice/transaction row used on the /account/billing page.
 */
export function SkeletonInvoiceRow() {
  return (
    <div className="grid gap-4 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 h-[18px] w-[18px] rounded-full ${BASE_BG} ${PULSE}`} />
        <div className="space-y-2">
          <div className={`h-4 w-28 rounded ${BASE_BG} ${PULSE}`} />
          <div className={`h-3 w-44 rounded ${BASE_BG} ${PULSE}`} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <div className={`h-4 w-16 rounded ${BASE_BG} ${PULSE}`} />
        <div className={`h-3 w-12 rounded ${BASE_BG} ${PULSE}`} />
        <div className={`h-3 w-14 rounded ${BASE_BG} ${PULSE}`} />
      </div>
    </div>
  );
}
