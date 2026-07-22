"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { ResumeCard } from "./resume-card";
import { EmptyState } from "./empty-state";
import { DeleteResumeModal } from "./delete-modal";
import { RenameModal } from "./rename-modal";

type SerializedResume = {
  id: string;
  title: string;
  targetRole: string | null;
  updatedAt: string;
  analysisRunCount: number;
  exportCount: number;
};

type PaginatedResponse = {
  resumes: SerializedResume[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
};

type SortMode = "updated" | "alpha" | "oldest";
type FilterMode = "all" | "targeted" | "untargeted" | "analyzed";

const PAGE_SIZE = 10;
const SCROLL_STORAGE_KEY = "dashboard-scroll-pos";

type ResumeListProps = {
  initialResumes: SerializedResume[];
  hasMoreInit: boolean;
  /** Total resume count (for stats — passed separately so cache doesn't invalidate) */
};

const sortModes: { value: SortMode; label: string }[] = [
  { value: "updated", label: "Recently Updated" },
  { value: "alpha", label: "Title A–Z" },
  { value: "oldest", label: "Oldest First" },
];

const filterModes: { value: FilterMode; label: string }[] = [
  { value: "all", label: "All" },
  { value: "targeted", label: "Targeted" },
  { value: "untargeted", label: "Untargeted" },
  { value: "analyzed", label: "Analyzed" },
];

function getRecencyGroup(updatedAt: Date): string {
  const now = Date.now();
  const ms = now - updatedAt.getTime();
  const days = ms / 86400000;

  if (days < 1) return "Today";
  if (days < 2) return "Yesterday";
  if (days < 7) return "This Week";
  return "Earlier";
}

/** Skeleton card shown while loading more */
function ResumeCardSkeleton() {
  return (
    <article className="grid animate-pulse gap-4 rounded-[28px] border border-[#123c3a]/10 bg-white p-5 shadow-sm md:grid-cols-[72px_1fr_auto] md:items-start">
      <div className="hidden h-[72px] w-[72px] rounded-[18px] bg-[#e5e5e5] md:block" />
      <div className="min-w-0 space-y-3">
        <div className="h-4 w-20 rounded-full bg-[#e5e5e5]" />
        <div className="h-6 w-48 rounded-lg bg-[#e5e5e5]" />
        <div className="h-4 w-36 rounded-lg bg-[#e5e5e5]" />
        <div className="h-3 w-24 rounded-lg bg-[#e5e5e5]" />
      </div>
      <div className="flex items-center gap-2 self-center">
        <div className="h-9 w-9 rounded-xl bg-[#e5e5e5]" />
        <div className="h-9 w-28 rounded-full bg-[#e5e5e5]" />
      </div>
    </article>
  );
}

async function fetchResumesPage(page: number): Promise<PaginatedResponse> {
  const res = await fetch(`/api/resumes?page=${page}&limit=${PAGE_SIZE}`);
  if (!res.ok) throw new Error("Failed to load resumes");
  return res.json();
}

export function ResumeList({ initialResumes, hasMoreInit }: ResumeListProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("updated");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [resumeToDelete, setResumeToDelete] = useState<SerializedResume | null>(null);
  const [resumeToRename, setResumeToRename] = useState<SerializedResume | null>(null);
  const isAnyModalOpen = !!resumeToDelete || !!resumeToRename;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);


  // ── Infinite query with cache ──
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["resumes"],
    queryFn: ({ pageParam }) => fetchResumesPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Seed cache with SSR data so first render is instant
    initialData: {
      pages: [{ resumes: initialResumes, pagination: { page: 1, limit: PAGE_SIZE, total: 0, hasMore: hasMoreInit } }],
      pageParams: [1],
    },
  });

  // Flatten all pages into one array
  const resumes = useMemo(
    () => data?.pages.flatMap((p) => p.resumes) ?? [],
    [data],
  );

  // ── Scroll position restoration ──
  useEffect(() => {
    const saved = sessionStorage.getItem(SCROLL_STORAGE_KEY);
    if (saved) {
      const pos = parseInt(saved, 10);
      if (!isNaN(pos)) {
        requestAnimationFrame(() => window.scrollTo(0, pos));
      }
      sessionStorage.removeItem(SCROLL_STORAGE_KEY);
    }
  }, []);

  // Save scroll position before navigating away
  useEffect(() => {
    function saveScroll() {
      sessionStorage.setItem(SCROLL_STORAGE_KEY, String(window.scrollY));
    }
    // Use visibilitychange to catch SPA navigations
    document.addEventListener("visibilitychange", saveScroll);
    window.addEventListener("beforeunload", saveScroll);
    return () => {
      document.removeEventListener("visibilitychange", saveScroll);
      window.removeEventListener("beforeunload", saveScroll);
    };
  }, []);

  // ── Intersection observer for infinite scroll ──
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Stable callbacks — called by ResumeCard with the card's own id/title
  const handleMenuOpenChange = useCallback(
    (resumeId: string, open: boolean) => setActiveMenuId(open ? resumeId : null),
    [],
  );

  const handleRenameClick = useCallback(
    (resume: SerializedResume) => {
      setActiveMenuId(null);
      setResumeToRename(resume);
    },
    [],
  );

  const handleDeleteClick = useCallback(
    (id: string, title: string) => {
      console.log('[ResumeList] handleDeleteClick called', { id, title, scrollY: window.scrollY, activeMenuId });
      setResumeToRename(null);
      setActiveMenuId(null);
      setResumeToDelete({ id, title, targetRole: null, updatedAt: "", analysisRunCount: 0, exportCount: 0 });
    },
    [],
  );

  // Parse dates once
  const parsed = useMemo(
    () =>
      resumes.map((r) => ({
        ...r,
        parsedDate: new Date(r.updatedAt),
      })),
    [resumes],
  );

  // Apply search + filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return parsed.filter((r) => {
      if (q) {
        const matchesTitle = r.title.toLowerCase().includes(q);
        const matchesRole = r.targetRole?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesRole) return false;
      }
      if (filter === "targeted") return !!r.targetRole;
      if (filter === "untargeted") return !r.targetRole;
      if (filter === "analyzed") return r.analysisRunCount > 0;
      return true;
    });
  }, [parsed, search, filter]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "alpha") {
      arr.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "oldest") {
      arr.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
    } else {
      arr.sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
    }
    return arr;
  }, [filtered, sort]);

  // Group by recency
  const groups = useMemo(() => {
    const map = new Map<string, typeof sorted>();
    for (const r of sorted) {
      const group = getRecencyGroup(r.parsedDate);
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(r);
    }
    const order = ["Today", "Yesterday", "This Week", "Earlier"];
    const result: { label: string; items: typeof sorted }[] = [];
    for (const label of order) {
      const items = map.get(label);
      if (items && items.length > 0) {
        result.push({ label, items });
      }
    }
    return result;
  }, [sorted]);

  const hasActiveFilters = search.trim().length > 0 || filter !== "all";

  // Callbacks
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
    [],
  );
  const handleSearchClear = useCallback(() => setSearch(""), []);
  const handleToggleFilters = useCallback(
    () => setShowFilters((v) => !v),
    [],
  );
  const handleSetSort = useCallback((s: SortMode) => setSort(s), []);
  const handleSetFilter = useCallback((f: FilterMode) => setFilter(f), []);
  const handleClearAll = useCallback(() => {
    setSearch("");
    setFilter("all");
    setSort("updated");
  }, []);
  const handleDeleteClose = useCallback(() => setResumeToDelete(null), []);
  const handleRenameClose = useCallback(() => setResumeToRename(null), []);

  // Empty state (only when we have data loaded)
  if (sorted.length === 0 && hasActiveFilters) {
    return (
      <div className="space-y-5">
        <SearchBar
          search={search}
          onSearchChange={handleSearchChange}
          onSearchClear={handleSearchClear}
          showFilters={showFilters}
          onToggleFilters={handleToggleFilters}
        />
        <EmptyState
          variant="no-results"
          searchTerm={search.trim() || undefined}
          activeFilter={filter !== "all" ? filter : undefined}
        />
      </div>
    );
  }

  if (sorted.length === 0 && !hasActiveFilters && !isFetchingNextPage) {
    return <EmptyState variant="no-resumes" />;
  }

  return (
    <div className="space-y-5" ref={listContainerRef}>
      <SearchBar
        search={search}
        onSearchChange={handleSearchChange}
        onSearchClear={handleSearchClear}
        showFilters={showFilters}
        onToggleFilters={handleToggleFilters}
      />

      {/* Filter and sort chips */}
      {(showFilters || hasActiveFilters) && (
        <FilterSortBar
          sort={sort}
          filter={filter}
          hasActiveFilters={hasActiveFilters}
          onSetSort={handleSetSort}
          onSetFilter={handleSetFilter}
          onClearAll={handleClearAll}
        />
      )}

      {/* Resume cards */}
      {groups.map((group) => (
        <section key={group.label}>
          <GroupHeader label={group.label} count={group.items.length} />
          <div className="space-y-3">
            {group.items.map((r) => (
              <ResumeCard
                key={r.id}
                resume={r}
                parsedDate={r.parsedDate}
                isMenuOpen={!isAnyModalOpen && activeMenuId === r.id}
                onMenuOpenChange={handleMenuOpenChange}
                onRenameClick={handleRenameClick}
                onDeleteClick={handleDeleteClick}
              />
            ))}
          </div>
        </section>
      ))}

      {/* ─── Infinite scroll sentinel & loading states ─── */}

      {/* Loading indicator */}
      {isFetchingNextPage && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 size={18} className="animate-spin text-[#6bbf22]" />
            <span className="text-sm font-semibold text-[#4b4b4b]/70">
              Loading more resumes...
            </span>
          </div>
          <ResumeCardSkeleton />
          <ResumeCardSkeleton />
          <ResumeCardSkeleton />
        </div>
      )}

      {/* Error state */}
      {isError && !isFetchingNextPage && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] border border-dashed border-red-200 bg-red-50/40 p-6 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-red-100 text-red-500">
            <AlertTriangle size={20} />
          </div>
          <p className="text-sm font-semibold text-red-600">
            {error instanceof Error ? error.message : "Couldn't load more resumes."}
          </p>
          <button
            type="button"
            onClick={() => fetchNextPage()}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-4 py-1.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* End-of-list message */}
      {!hasNextPage && !isFetchingNextPage && resumes.length > 0 && (
        <div className="flex items-center justify-center py-4">
          <p className="text-sm font-semibold text-[#4b4b4b]/50">
            You&apos;re all caught up.
          </p>
        </div>
      )}

      {/* Invisible sentinel for intersection observer */}
      <div ref={sentinelRef} className="h-px" />

      {/* Global delete modal */}
      <DeleteResumeModal
        resumeId={resumeToDelete?.id ?? ""}
        resumeTitle={resumeToDelete?.title ?? ""}
        open={!!resumeToDelete}
        onClose={handleDeleteClose}
      />
      {/* Global rename modal - one instance, outside card map */}
      {resumeToRename ? (
        <RenameModal
          open
          resume={resumeToRename}
          onClose={handleRenameClose}
        />
      ) : null}
    </div>
  );
}

/* ─── Extracted sub-components ─── */

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <h3 className="font-signal mb-4 text-sm font-black uppercase tracking-[0.12em] text-[#4b4b4b]/60">
      {label}
      <span className="ml-1.5 font-mono text-[10px] font-normal tracking-normal text-[#4b4b4b]/30">
        ({count})
      </span>
    </h3>
  );
}

function FilterSortBar({
  sort,
  filter,
  hasActiveFilters,
  onSetSort,
  onSetFilter,
  onClearAll,
}: {
  sort: SortMode;
  filter: FilterMode;
  hasActiveFilters: boolean;
  onSetSort: (s: SortMode) => void;
  onSetFilter: (f: FilterMode) => void;
  onClearAll: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#4b4b4b]/60">
          Sort:
        </span>
        {sortModes.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onSetSort(s.value)}
            className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] transition-colors ${
              sort === s.value
                ? "bg-[#123c3a] text-white"
                : "bg-[#f3f3f3] text-[#4b4b4b] hover:bg-[#e5e5e5]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#4b4b4b]/60">
          Filter:
        </span>
        {filterModes.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => onSetFilter(f.value)}
            className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] transition-colors ${
              filter === f.value
                ? "bg-[#123c3a] text-white"
                : "bg-[#f3f3f3] text-[#4b4b4b] hover:bg-[#e5e5e5]"
            }`}
          >
            {f.label}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="ml-1 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-red-600 transition-colors hover:bg-red-50"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

function SearchBar({
  search,
  onSearchChange,
  onSearchClear,
  showFilters,
  onToggleFilters,
}: {
  search: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchClear: () => void;
  showFilters: boolean;
  onToggleFilters: () => void;
}) {
  return (
    <div className="relative">
      <Search
        size={16}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#4b4b4b]/40"
      />
      <input
        type="text"
        value={search}
        onChange={onSearchChange}
        placeholder="Search resumes..."
        className="w-full rounded-[14px] border border-[#123c3a]/15 bg-white py-2.5 pl-10 pr-10 text-sm text-[#123c3a] shadow-sm outline-none transition-colors placeholder:text-[#4b4b4b]/50 focus:border-[#6bbf22] focus:ring-4 focus:ring-[#b9ff66]/40"
      />
      {search && (
        <button
          type="button"
          onClick={onSearchClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4b4b4b]/40 transition-colors hover:text-[#4b4b4b]"
        >
          <X size={16} />
        </button>
      )}
      <button
        type="button"
        onClick={onToggleFilters}
        className={`absolute right-3 top-1/2 -translate-y-1/2 text-[#4b4b4b]/40 transition-colors hover:text-[#4b4b4b] ${search ? "right-10" : ""}`}
      >
        <SlidersHorizontal size={16} />
      </button>
    </div>
  );
}
