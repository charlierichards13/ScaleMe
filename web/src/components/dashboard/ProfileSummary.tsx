import Link from "next/link";
import { Briefcase, CalendarRange, FileText, Globe2, MapPin, type LucideIcon } from "lucide-react";
import { Badge, Card, SectionHeading, buttonStyles, cx } from "@/components/ui/primitives";
import type { CandidateProfile } from "@/lib/dashboard/types";
import { routes } from "@/lib/routes";

type Row = { label: string; value?: string; icon: LucideIcon; emptyText: string };

export function ProfileSummary({ profile, isDemo }: { profile: CandidateProfile; isDemo: boolean }) {
  const guidance =
    profile.authorizationGuidance === null
      ? undefined
      : profile.authorizationGuidance
        ? "On: show what listings say"
        : "Off";

  const rows: Row[] = [
    { label: "Resume", value: profile.hasResume ? profile.resumeLabel ?? "Added" : undefined, icon: FileText, emptyText: "Not added yet" },
    { label: "Target role", value: profile.targetRole, icon: Briefcase, emptyText: "Not set" },
    { label: "Work period", value: profile.workPeriod, icon: CalendarRange, emptyText: "Not set" },
    { label: "Location", value: profile.locationPreference, icon: MapPin, emptyText: "Not set" },
    { label: "Work-authorization notes", value: guidance, icon: Globe2, emptyText: "Optional, not chosen" },
  ];

  const isEmpty = !profile.hasResume && !profile.targetRole;

  return (
    <Card aria-labelledby="profile-heading">
      <SectionHeading
        id="profile-heading"
        title="Profile & goals"
        description={isDemo ? "Fictional profile." : isEmpty ? "Optional goals are in guest setup." : undefined}
        action={isDemo ? <Badge tone="demo">Sample</Badge> : undefined}
      />
      <ul className="divide-y divide-line">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-slate-500">{row.label}</span>
                <span className={cx("block break-words text-sm", row.value ? "font-medium text-ink" : "text-slate-500")}>
                  {row.value ?? row.emptyText}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <Link href={routes.onboarding} className={cx(buttonStyles.secondary, "mt-5 w-full")}>
        Preview goal setup
      </Link>
    </Card>
  );
}
