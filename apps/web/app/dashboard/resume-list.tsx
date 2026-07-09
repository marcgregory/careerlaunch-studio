"use client";

import { useCallback, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { ResumeCard } from "./resume-card";
import { EmptyState } from "./empty-state";
import { DeleteResumeModal } from "./delete-modal";

type SerializedResume = {
  id: string;
  title: string;
  targetRole: string | null;
  updatedAt: string;
  analysisRunCount: number;
  exportCount: number;
};

type SortMode = "updated" | "alpha" | "oldest";
type FilterMode = "all" | "targeted" | "untargeted" | "analyzed";

type ResumeListProps = {
  resumes: SerializedResume[];
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


export function ResumeList({ resumes }: ResumeListProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("updated");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [resumeToDelete, setResumeToDelete] = useState<SerializedResume | null>(null);
  const isDeleteModalOpen = !!resumeToDelete;

  // Stable callbacks
  const handleMenuOpenChange = useCallback(
    (resumeId: string, open: boolean) => setActiveMenuId(open ? resumeId : null),
    [],
  );

  const handleDeleteClick = useCallback(
    (id: string, title: string) => {
      // Force close menu before modal opens
      setActiveMenuId(null);
      setTimeout(() => {
        setResumeToDelete({ id, title, targetRole: null, updatedAt: "", analysisRunCount: 0, exportCount: 0 });
      }, 0);
    },
    [],
  );

  const handleDeleteClose = useCallback(() => setResumeToDelete(null), []);
  const handleDeleted = useCallback(() => {
    setResumeToDelete(null);
  }, []);

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

  // Empty state
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

  if (sorted.length === 0 && !hasActiveFilters) {
    return <EmptyState variant="no-resumes" />;
  }

  return (
    <div className="space-y-5">
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

      {/* Resume cards — no inner scroll, page is the only scroll container */}
      {groups.map((group) => (
        <section key={group.label}>
          <GroupHeader label={group.label} count={group.items.length} />
          <div className="space-y-3">
            {group.items.map((r) => (
              <ResumeCard
                key={r.id}
                id={r.id}
                title={r.title}
                targetRole={r.targetRole}
                updatedAt={r.parsedDate}
                analysisRunCount={r.analysisRunCount}
                menuOpen={!isDeleteModalOpen && activeMenuId === r.id}
                onMenuOpenChange={handleMenuOpenChange}
                onDeleteClick={handleDeleteClick}
                actionsDisabled={isDeleteModalOpen}
              />
            ))}
          </div>
        </section>
      ))}
      {/* Global delete modal — rendered once, outside card map */}
      <DeleteResumeModal
        resumeId={resumeToDelete?.id ?? ""}
        resumeTitle={resumeToDelete?.title ?? ""}
        open={!!resumeToDelete}
        onClose={handleDeleteClose}
        onDeleted={handleDeleted}
      />
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
