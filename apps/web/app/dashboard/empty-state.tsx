import { FileText, Search, RotateCcw } from "lucide-react";
import { NewResumeButton } from "./new-resume-button";

type EmptyStateProps = {
  /** Which view is empty — determines the icon and messaging */
  variant?: "no-resumes" | "no-results";
  /** Search term that produced no results (only shown for no-results) */
  searchTerm?: string;
  /** Which filter is active (only shown alongside no-results) */
  activeFilter?: string;
  /** Callback to reset active search and filters */
  onClearFilters?: () => void;
};

export function EmptyState({
  variant = "no-resumes",
  searchTerm,
  activeFilter,
  onClearFilters,
}: EmptyStateProps) {
  if (variant === "no-resumes") {
    return (
      <article className="relative overflow-hidden rounded-[30px] border border-[#123c3a]/10 bg-white p-7 shadow-[0_24px_70px_rgba(18,60,58,0.10)]">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#b9ff66]/45 blur-3xl" />
        <div className="relative z-10">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[#b9ff66] text-[#123c3a] shadow-[0_4px_0_#123c3a]">
            <FileText size={28} aria-hidden="true" />
          </div>
          <h2 className="font-signal mt-7 max-w-xl text-4xl font-black leading-[0.95] tracking-[-0.06em]">
            No drafts in the pipeline yet.
          </h2>
          <p className="mt-4 max-w-xl text-base font-medium leading-7 text-[#3d3d3d]">
            Create your first database-backed resume draft and continue editing from any authenticated session.
          </p>
          <div className="mt-8">
            <NewResumeButton variant="first-draft" fallbackHref="/login" />
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-[30px] border border-dashed border-[#123c3a]/15 bg-white/60 p-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-[#f3f3f3] text-[#123c3a]">
        <Search size={24} aria-hidden="true" />
      </div>
      <h3 className="font-signal mt-5 text-xl font-black tracking-[-0.04em] text-[#123c3a]">
        No resumes found
      </h3>
      <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-[#3d3d3d]">
        {searchTerm && (
          <>
            No resumes match &ldquo;<span className="font-semibold">{searchTerm}</span>&rdquo;.
          </>
        )}
        {!searchTerm && activeFilter && activeFilter !== "all" && (
          <>
            No resumes match the <span className="font-semibold">{activeFilter}</span> filter.
          </>
        )}
        {!searchTerm && !activeFilter && (
          <>Try adjusting your search or filter to find what you&apos;re looking for.</>
        )}
      </p>
      {onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#123c3a]/15 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#123c3a] shadow-sm transition hover:bg-[#b9ff66]"
        >
          <RotateCcw size={14} aria-hidden="true" /> Clear all filters
        </button>
      )}
    </div>
  );
}
