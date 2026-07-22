/**
 * Streaming loading state for /builder.
 *
 * Mirrors the real builder structure:
 *   1. AppHeader with back button, title block, save badge, reset, export
 *   2. Mobile tab strip (preview / edit / analyze)
 *   3. Two-column layout: editor sidebar (with Panels) | resume preview
 *
 * The preview side renders a real page-shape skeleton so the A4 paper
 * rectangle the user expects is reserved while the resume data loads.
 */
import { SkeletonHeader, SkeletonFormPanel } from "../../components/skeletons";

export default function BuilderLoading() {
  return (
    <>
      <SkeletonHeader actions={3} showBackButton showSubtitle />

      <main className="signal-site min-h-screen bg-[#f3f3f3] pt-[52px] text-[#123c3a] sm:pt-[60px]">
        {/* Mobile tab strip — same three tabs as the real builder, all set
            to the unselected state since we don't know which is active. */}
        <div className="sticky-tab-strip -mx-4 z-10 mt-8 border-b border-[#123c3a]/10 bg-[#f3f3f3]/85 px-4 backdrop-blur-xl xl:hidden">
          <nav className="flex h-12 min-h-12 gap-1 overflow-visible" aria-label="Builder view" aria-hidden="true">
            {(["preview", "edit", "analyze"] as const).map((tab) => (
              <div
                key={tab}
                className="box-border flex flex-1 items-center justify-center rounded-t-xl px-2 text-sm font-black uppercase tracking-[0.08em] text-[#4b4b4b]/40"
              >
                {tab === "preview" ? "Preview" : tab === "edit" ? "Edit" : "Analyze"}
              </div>
            ))}
          </nav>
        </div>

        {/* Two-column grid: editor sidebar (420px) + preview pane (1fr) */}
        <div className="mx-auto grid max-w-7xl min-w-0 gap-3 px-4 py-4 sm:gap-6 sm:py-7 xl:h-[calc(100vh-60px)] xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] xl:overflow-hidden">
          {/* Editor sidebar */}
          <aside className="no-print min-w-0 max-w-full space-y-3 overflow-x-hidden sm:space-y-5 xl:overflow-y-auto xl:pb-4" aria-hidden="true">
            <SkeletonFormPanel fields={1} />
            <SkeletonFormPanel fields={4} />
            <SkeletonFormPanel fields={7} />
            <SkeletonFormPanel fields={1} />
            <SkeletonFormPanel fields={2} />
            <SkeletonFormPanel fields={4} />
          </aside>

          {/* Preview pane — reserves the A4-paper-shaped resume rectangle */}
          <aside className="min-w-0 max-w-full xl:sticky xl:top-6 xl:block xl:max-h-[calc(100vh-4rem)] xl:self-start xl:overflow-y-auto" aria-hidden="true">
            <div className="flex justify-center rounded-none border-0 bg-transparent p-0 xl:rounded-[30px] xl:border xl:border-[#123c3a]/10 xl:bg-[#d8d4cb] xl:p-6 xl:shadow-inner">
              <div className="max-h-[calc(100vh-8rem)] w-full max-w-[900px] min-w-0 overflow-auto xl:rounded-xl">
                {/* The actual resume page — same proportions as the real
                    A4 sheet, with a header band, section rows, and side
                    content blocks to mirror the rendered resume. */}
                <div className="mx-auto aspect-[1/1.414] w-full max-w-[820px] animate-pulse rounded-md bg-white p-10 shadow-md">
                  {/* Top: name + contact row */}
                  <div className="space-y-2 border-b border-[#123c3a]/10 pb-6">
                    <div className="h-7 w-1/2 rounded-md bg-[#123c3a]/15" />
                    <div className="h-3 w-1/3 rounded bg-[#123c3a]/10" />
                  </div>
                  {/* Summary block */}
                  <div className="mt-5 space-y-2">
                    <div className="h-3 w-24 rounded bg-[#123c3a]/20" />
                    <div className="h-2.5 w-full rounded bg-[#123c3a]/10" />
                    <div className="h-2.5 w-11/12 rounded bg-[#123c3a]/10" />
                    <div className="h-2.5 w-4/5 rounded bg-[#123c3a]/10" />
                  </div>
                  {/* Experience section */}
                  <div className="mt-5 space-y-3">
                    <div className="h-3 w-32 rounded bg-[#123c3a]/20" />
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="space-y-1.5 border-l-2 border-[#123c3a]/15 pl-3">
                        <div className="h-3 w-1/2 rounded bg-[#123c3a]/15" />
                        <div className="h-2.5 w-1/3 rounded bg-[#123c3a]/10" />
                        <div className="ml-3 mt-1 space-y-1">
                          <div className="h-2 w-11/12 rounded bg-[#123c3a]/10" />
                          <div className="h-2 w-10/12 rounded bg-[#123c3a]/10" />
                          <div className="h-2 w-9/12 rounded bg-[#123c3a]/10" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Education + Skills grid */}
                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="h-3 w-24 rounded bg-[#123c3a]/20" />
                      <div className="h-2.5 w-3/4 rounded bg-[#123c3a]/10" />
                      <div className="h-2.5 w-2/3 rounded bg-[#123c3a]/10" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-16 rounded bg-[#123c3a]/20" />
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="h-5 w-14 rounded-full bg-[#123c3a]/10" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
