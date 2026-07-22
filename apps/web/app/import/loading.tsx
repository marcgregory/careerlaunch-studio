/**
 * Streaming loading state for /import.
 *
 * Mirrors the real page structure:
 *   1. AppHeader (logo only — no actions on this page)
 *   2. Header block with "Dashboard" back link, "Import resume" title, helper
 *   3. Card with the paste-textarea + character counter
 *   4. Cancel link + "Parse resume" button
 */
import { Skeleton, SkeletonHeader, SkeletonPage } from "../../components/skeletons";

export default function ImportLoading() {
  return (
    <>
      <SkeletonHeader actions={0} />

      <SkeletonPage maxWidthClass="max-w-5xl">
        {/* Header block — mirrors the back link + title + subtitle */}
        <div className="flex items-center justify-between border-b border-[#123c3a]/10 pb-6">
          <div>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-10 w-64" />
            <Skeleton className="mt-2 h-4 w-3/4 max-w-md" />
          </div>
        </div>

        {/* Idle-state card with textarea */}
        <div className="mt-8 space-y-6" aria-hidden="true">
          <div className="rounded-2xl border border-[#123c3a]/10 bg-white p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-[18px] w-[18px]" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="mt-4 h-[320px] w-full rounded-xl border border-[#123c3a]/15 bg-[#fafafa]" />
            <div className="mt-3 flex justify-end">
              <Skeleton className="h-3 w-28" />
            </div>
          </div>

          {/* Actions row — Cancel link + "Parse resume" button */}
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-3 w-16" />
            <div className="h-11 w-40 rounded-[14px] border-2 border-[#123c3a] bg-[#123c3a] animate-pulse" />
          </div>
        </div>
      </SkeletonPage>
    </>
  );
}
