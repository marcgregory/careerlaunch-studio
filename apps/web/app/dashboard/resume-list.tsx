"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { ResumeCard } from "./resume-card";
import { EmptyState } from "./empty-state";

type SerializedResume = {
  id: string;
  title: string;
  targetRole: string | null;
  updatedAt: string; // ISO string from server
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
      // Search
      if (q) {
        const matchesTitle = r.title.toLowerCase().includes(q);
        const matchesRole = r.targetRole?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesRole) return false;
      }
      // Filter
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
      // "updated" — default (already in desc order from server)
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
    // Return in order: Today, Yesterday, This Week, Earlier
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

  const hasActiveFilters = search.trim() || filter !== "all";
  const showFilterBar = showFilters || hasActiveFilters;

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#4b4b4b]/40"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search resumes..."
          className="w-full rounded-[14px] border border-[#123c3a]/15 bg-white py-2.5 pl-10 pr-10 text-sm text-[#123c3a] shadow-sm outline-none transition placeholder:text-[#4b4b4b]/50 focus:border-[#6bbf22] focus:ring-4 focus:ring-[#b9ff66]/40"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4b4b4b]/40 transition hover:text-[#4b4b4b]"
          >
            <X size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-[#4b4b4b]/40 transition hover:text-[#4b4b4b] ${search ? "right-10" : ""}`}
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {/* Filter and sort chips */}
      {showFilterBar && (
        <div className="space-y-3">
          {/* Sort */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#4b4b4b]/60">
              Sort:
            </span>
            {sortModes.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSort(s.value)}
                className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] transition ${
                  sort === s.value
                    ? "bg-[#123c3a] text-white"
                    : "bg-[#f3f3f3] text-[#4b4b4b] hover:bg-[#e5e5e5]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#4b4b4b]/60">
              Filter:
            </span>
            {filterModes.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] transition ${
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
                onClick={() => { setSearch(""); setFilter("all"); setSort("updated"); }}
                className="ml-1 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-red-600 transition hover:bg-red-50"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Resume cards / empty state */}
      {sorted.length === 0 && hasActiveFilters ? (
        <EmptyState
          variant="no-results"
          searchTerm={search.trim() || undefined}
          activeFilter={filter !== "all" ? filter : undefined}
        />
      ) : sorted.length === 0 && !hasActiveFilters ? (
        <EmptyState variant="no-resumes" />
      ) : (
        groups.map((group) => (
          <section key={group.label}>
            <h3 className="font-signal mb-4 text-sm font-black uppercase tracking-[0.12em] text-[#4b4b4b]/60">
              {group.label}
              <span className="ml-1.5 font-mono text-[10px] font-normal tracking-normal text-[#4b4b4b]/30">
                ({group.items.length})
              </span>
            </h3>
            <div className="space-y-3">
              {group.items.map((r) => (
                <ResumeCard
                  key={r.id}
                  id={r.id}
                  title={r.title}
                  targetRole={r.targetRole}
                  updatedAt={r.parsedDate}
                  analysisRunCount={r.analysisRunCount}
                  menuOpen={activeMenuId === r.id}
                  onMenuOpenChange={(open) => setActiveMenuId(open ? r.id : null)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
