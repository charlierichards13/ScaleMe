import Link from "next/link";
import { ArrowUpRight, Compass, FileText, Mic, Scale, type LucideIcon } from "lucide-react";
import { Badge, buttonStyles, cx } from "@/components/ui/primitives";
import { routes } from "@/lib/routes";

type Feature = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  status: string;
};

const features: Feature[] = [
  { title: "Discover", description: "Role browsing is planned. See what’s coming.", href: routes.discover, icon: Compass, status: "Planned" },
  { title: "Analyze my fit", description: "Local resume/job drafts or fictional examples. Live analysis is off.", href: routes.fitInsights, icon: Scale, status: "Preview" },
  { title: "Resume Lab", description: "Review fictional sample quotes and copy a bullet they support.", href: routes.impactLab, icon: FileText, status: "Sample" },
  { title: "Mock Interview", description: "Five fixed questions. Separate private contextual entry inside; live AI off by default.", href: routes.interview, icon: Mic, status: "Practice" },
];

export function FeatureCards() {
  return (
    <section aria-labelledby="tools-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-1">
        <h2 id="tools-heading" className="text-base font-semibold tracking-tight text-ink">Your career tools</h2>
        <p className="text-xs leading-5 text-muted">Choose a workspace to explore</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <li key={feature.title} className="min-w-0">
              <Link href={feature.href} className={cx(
                "group flex h-full flex-col rounded-2xl border border-line bg-surface p-3.5 shadow-card transition-colors hover:border-brand/50 hover:bg-brand-soft/30 sm:p-5",
                buttonStyles.focusRing,
              )}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-strong sm:h-10 sm:w-10" aria-hidden="true">
                    <Icon className="h-5 w-5" />
                  </span>
                  <Badge tone={feature.status === "Sample" ? "demo" : "neutral"}>{feature.status}</Badge>
                </div>
                <h3 className="mt-4 text-sm font-semibold leading-5 text-ink sm:text-[15px]">{feature.title}</h3>
                <p className="mt-2 flex-1 text-xs leading-5 text-muted sm:text-sm sm:leading-6">{feature.description}</p>
                <span className="mt-4 flex items-center gap-1 text-xs font-semibold text-brand-strong">
                  {feature.status === "Planned" ? "View plans" : "Open workspace"}
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
