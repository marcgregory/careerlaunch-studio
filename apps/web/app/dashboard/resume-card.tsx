import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import { secondaryButtonClass } from "@careerlaunch/ui";
import { resumeTemplates, type TemplateDefinition } from "@careerlaunch/rendering";
import { ResumeActions } from "./resume-actions";
import { memo, useCallback, useMemo } from "react";

type ResumeCardProps = {
  id: string;
  title: string;
  targetRole: string | null;
  updatedAt: Date;
  templateId?: string;
  analysisRunCount?: number;
  menuOpen?: boolean;
  /** Stable callback — receives the card's own id so no closure-per-card is needed. */
  onMenuOpenChange?: (resumeId: string, open: boolean) => void;
  onDeleteClick?: (resumeId: string, resumeTitle: string) => void;
};

function getTemplateInfo(id: string | undefined): TemplateDefinition {
  return resumeTemplates.find((t) => t.id === id) ?? resumeTemplates[0];
}

function getStatusBadge(analysisRunCount: number): {
  label: string;
  classes: string;
  dotClass: string;
} {
  if (analysisRunCount > 0) {
    return {
      label: "Analyzed",
      classes: "bg-[#b9ff66]/20 text-[#3a7a1a]",
      dotClass: "bg-[#6bbf22]",
    };
  }
  return {
    label: "Draft",
    classes: "bg-[#f3f3f3] text-[#4b4b4b]",
    dotClass: "bg-[#999]",
  };
}

function timeAgo(date: Date): string {
  const now = Date.now();
  const ms = now - date.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;

  const dateDay = new Date(date);
  dateDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - dateDay.getTime()) / 86400000);

  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ResumeCardInner({
  id,
  title,
  targetRole,
  updatedAt,
  templateId,
  analysisRunCount = 0,
  menuOpen,
  onMenuOpenChange,
  onDeleteClick,
}: ResumeCardProps) {
  const template = useMemo(() => getTemplateInfo(templateId), [templateId]);
  const badge = useMemo(() => getStatusBadge(analysisRunCount), [analysisRunCount]);
  const timeAgoLabel = useMemo(() => timeAgo(updatedAt), [updatedAt]);
  const editHref = useMemo(() => `/builder?resumeId=${id}`, [id]);

  const handleMenuOpenChange = useCallback(
    (open: boolean) => {
      onMenuOpenChange?.(id, open);
    },
    [onMenuOpenChange, id],
  );

  const handleDeleteClick = useCallback(() => {
    onDeleteClick?.(id, title);
  }, [onDeleteClick, id, title]);

  return (
    <article className="group grid gap-4 rounded-[28px] border border-[#123c3a]/10 bg-white p-5 shadow-sm transition-shadow duration-200 hover:-translate-y-0.5 hover:border-[#b9ff66] hover:shadow-[0_12px_30px_rgba(18,60,58,0.08)] md:grid-cols-[72px_1fr_auto] md:items-start">
      {/* Thumbnail placeholder */}
      <div className="hidden md:block">
        <div
          className="flex h-[72px] w-[72px] items-center justify-center rounded-[18px] border-2 shadow-[0_3px_0_rgba(0,0,0,0.10)]"
          style={{
            borderColor: template.swatches[0],
            backgroundColor: template.swatches[1],
          }}
        >
          <FileText
            size={26}
            style={{ color: template.swatches[0] }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0">
        {/* Status badge */}
        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${badge.classes}`}>
          <span className={`relative flex h-1.5 w-1.5 ${badge.dotClass} rounded-full`} />
          {badge.label}
        </div>

        {/* Target role (primary) */}
        {targetRole ? (
          <h2 className="font-signal mt-2 text-2xl font-black leading-none tracking-[-0.06em] text-[#123c3a]">
            {targetRole}
          </h2>
        ) : (
          <h2 className="font-signal mt-2 text-2xl font-black leading-none tracking-[-0.06em] text-[#4b4b4b]/60">
            General Resume
          </h2>
        )}

        {/* Resume title (secondary) */}
        <p className="mt-1 truncate text-sm font-semibold text-[#4b4b4b]/70">
          {title}
        </p>

        {/* Updated timestamp */}
        <p className="mt-1.5 text-xs font-medium text-[#4b4b4b]/50">
          Updated {timeAgoLabel}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 self-start md:self-center">
        <ResumeActions
          resumeId={id}
          resumeTitle={title}
          menuOpen={menuOpen}
          onMenuOpenChange={handleMenuOpenChange}
          onDeleteClick={handleDeleteClick}
        />
        <Link
          href={editHref}
          className={`${secondaryButtonClass} whitespace-nowrap`}
        >
          Edit Resume <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}

export const ResumeCard = memo(ResumeCardInner);
