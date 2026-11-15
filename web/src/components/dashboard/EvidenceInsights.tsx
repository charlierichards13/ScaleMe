import Link from "next/link";
import { CheckCircle2, CircleDashed, CircleHelp, ListChecks, type LucideIcon } from "lucide-react";
import { Badge, Card, EmptyState, SectionHeading, buttonStyles } from "@/components/ui/primitives";
import type { EvidenceInsight, EvidenceStatus } from "@/lib/dashboard/types";
import { routes } from "@/lib/routes";

const statusMeta: Record<EvidenceStatus, { label: string; tone: "success" | "neutral" | "warning"; icon: LucideIcon }> = {
  supported: { label: "Supported", tone: "success", icon: CheckCircle2 },
  not_evidenced: { label: "Not evidenced", tone: "neutral", icon: CircleDashed },
  unclear: { label: "Needs clarification", tone: "warning", icon: CircleHelp },
};

const sourceLabel = { resume: "Resume", job: "Job listing", interview: "Interview" } as const;

export function EvidenceInsights({ insights, isDemo }: { insights: EvidenceInsight[]; isDemo: boolean }) {
  return (
    <Card aria-labelledby="evidence-heading">
      <SectionHeading
        id="evidence-heading"
        title="Evidence insights"
        description="How well your resume shows each requirement. This is coaching, not a hiring prediction."
        action={isDemo ? <Badge tone="demo">Sample analysis</Badge> : undefined}
      />

      {insights.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-5 w-5" />}
          title="No analysis yet"
          description="Analyze a role to see which requirements your resume supports, and which need more detail."
          action={
            <Link href={routes.fit} className={buttonStyles.secondary}>
              Analyze a role
            </Link>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {insights.map((insight) => {
              const meta = statusMeta[insight.status];
              const Icon = meta.icon;
              return (
                <li key={insight.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm font-semibold text-ink">{insight.requirement}</p>
                    <Badge tone={meta.tone}>
                      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-muted">{insight.explanation}</p>
                  {insight.evidence.map((item) => (
                    <blockquote
                      key={`${item.source}-${item.quote}`}
                      className="mt-2.5 border-l-2 border-brand/40 pl-3 text-sm leading-6 text-slate-700"
                    >
                      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {sourceLabel[item.source]}
                      </span>
                      <q>{item.quote}</q>
                    </blockquote>
                  ))}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            &ldquo;Not evidenced&rdquo; means your resume doesn&apos;t show it yet, not that you lack the skill.
          </p>
        </>
      )}
    </Card>
  );
}
