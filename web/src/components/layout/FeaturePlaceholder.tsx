import Link from "next/link";
import { ArrowLeft, ArrowRight, Construction, type LucideIcon } from "lucide-react";
import { Badge, Card, buttonStyles } from "@/components/ui/primitives";
import { routes } from "@/lib/routes";

type PlaceholderAction = { href: string; label: string };

/**
 * Honest landing page for a workspace that hasn't been built yet. Callers
 * pass the primary action. The default matches the unedited /fit placeholder
 * until PR #46 replaces that page. Sidebar and dashboard links use
 * routes.fitInsights directly.
 */
export function FeaturePlaceholder({
  title,
  icon: Icon,
  summary,
  plannedSteps,
  dependsOn,
  action,
}: {
  title: string;
  icon: LucideIcon;
  summary: string;
  plannedSteps: string[];
  dependsOn: string;
  action?: PlaceholderAction;
}) {
  const next = action ?? { href: routes.coach, label: "Try the Career Coach demo" };
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <Link href={routes.dashboard} className={buttonStyles.ghost}>
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to dashboard
      </Link>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Icon className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
          <Badge tone="warning">
            <Construction aria-hidden="true" className="h-3.5 w-3.5" />
            Not available yet
          </Badge>
        </div>
        <p className="mt-4 text-[15px] leading-7 text-muted">{summary}</p>

        <h2 className="mt-6 text-sm font-semibold text-ink">What this workspace will do</h2>
        <ol className="mt-3 space-y-2">
          {plannedSteps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm leading-6 text-slate-700">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand"
              >
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        <p className="mt-6 rounded-xl bg-canvas px-4 py-3 text-sm leading-6 text-slate-600">
          <span className="font-semibold text-ink">Status:</span> {dependsOn}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={next.href} className={buttonStyles.primary}>
            {next.label}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          <Link href={routes.dashboard} className={buttonStyles.secondary}>
            Return to dashboard
          </Link>
        </div>
      </Card>
    </div>
  );
}
