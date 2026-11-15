import Link from "next/link";
import { Bookmark, BookmarkCheck, Building2, CalendarRange, MapPin } from "lucide-react";
import { Badge, buttonStyles, cx } from "@/components/ui/primitives";
import type { AuthorizationStatement, EmploymentType, JobPreview, WorkArrangement } from "@/lib/dashboard/types";
import { routes } from "@/lib/routes";

const arrangementLabel: Record<WorkArrangement, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  on_site: "On-site",
  unknown: "Arrangement not stated",
};

const employmentLabel: Record<EmploymentType, string> = {
  internship: "Internship",
  full_time: "Full-time",
  part_time: "Part-time",
  co_op: "Co-op",
};

/**
 * Describes only what the listing says. Unknown is never treated as a
 * rejection, and nothing here is a legal eligibility determination.
 */
function AuthorizationNote({ statement }: { statement: AuthorizationStatement }) {
  if (statement.kind === "not_stated") {
    return (
      <p className="text-xs leading-5 text-slate-600">
        <span className="font-semibold">Work authorization:</span> not stated · verify with the employer
      </p>
    );
  }
  return (
    <p className="text-xs leading-5 text-slate-600">
      <span className="font-semibold">Listing says:</span> <q className="italic">{statement.quote}</q>
    </p>
  );
}

export function JobPreviewCard({
  job,
  saved,
  onToggleSave,
  showAuthorization,
}: {
  job: JobPreview;
  saved: boolean;
  onToggleSave: () => void;
  showAuthorization: boolean;
}) {
  const SaveIcon = saved ? BookmarkCheck : Bookmark;
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand/30 sm:flex-row sm:items-start">
      <div
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-canvas text-slate-500 ring-1 ring-line"
      >
        <Building2 className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold text-ink">{job.title}</h3>
          {job.fictional && <Badge tone="demo">Fictional</Badge>}
        </div>
        <p className="mt-0.5 text-sm text-muted">{job.company}</p>

        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <li className="inline-flex items-center gap-1">
            <MapPin aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
            {job.location} · {arrangementLabel[job.arrangement]}
          </li>
          <li>{employmentLabel[job.employmentType]}</li>
          {job.period && (
            <li className="inline-flex items-center gap-1">
              <CalendarRange aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
              {job.period}
            </li>
          )}
        </ul>

        {showAuthorization && (
          <div className="mt-2.5 rounded-lg bg-canvas px-3 py-2">
            <AuthorizationNote statement={job.authorization} />
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-2 sm:flex-col sm:items-stretch">
        <button
          type="button"
          onClick={onToggleSave}
          aria-pressed={saved}
          aria-label={`${saved ? "Unsave" : "Save"} ${job.title} at ${job.company}`}
          className={cx(buttonStyles.secondary, "px-3 py-2", saved && "border-brand/40 bg-brand-soft text-brand-strong")}
        >
          <SaveIcon aria-hidden="true" className="h-4 w-4" />
          {saved ? "Saved" : "Save"}
        </button>
        <Link
          href={routes.fitInsights}
          aria-label={`Open the fit explorer. ${job.title} at ${job.company} is not sent there.`}
          className={cx(buttonStyles.ghost, "justify-center px-3 py-2")}
        >
          Fit explorer
        </Link>
      </div>
    </article>
  );
}
