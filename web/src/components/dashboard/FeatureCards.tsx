import Link from "next/link";
import { ArrowUpRight, Compass, MessageCircleQuestion, Mic, Scale, type LucideIcon } from "lucide-react";
import { buttonStyles, cx } from "@/components/ui/primitives";
import { routes } from "@/lib/routes";

type Feature = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Icon tile colors; kept to soft tints so the page stays calm. */
  tint: string;
  status: string;
};

const features: Feature[] = [
  {
    title: "Discover Opportunities",
    description: "Explore internships and jobs that fit your goals, skills, and schedule.",
    href: routes.discover,
    icon: Compass,
    tint: "bg-sky-50 text-sky-700",
    status: "Demo preview",
  },
  {
    title: "Analyze My Fit",
    description: "Compare your experience with a job and identify evidence-backed strengths and gaps.",
    href: routes.fit,
    icon: Scale,
    tint: "bg-emerald-50 text-emerald-700",
    status: "Coming soon",
  },
  {
    title: "Grill My Resume",
    description: "Discover the real impact behind your projects through challenging AI-guided questions.",
    href: routes.resumeLab,
    icon: MessageCircleQuestion,
    tint: "bg-brand-soft text-brand",
    status: "Coming soon",
  },
  {
    title: "Mock Interview",
    description: "Practice explaining your skills, decisions, and experience with a role-aware AI interviewer.",
    href: routes.interview,
    icon: Mic,
    tint: "bg-amber-50 text-amber-700",
    status: "Coming soon",
  },
];

export function FeatureCards() {
  return (
    <section aria-labelledby="tools-heading">
      <h2 id="tools-heading" className="sr-only">
        Career tools
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <li key={feature.title}>
              <Link
                href={feature.href}
                className={cx(
                  "group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-card-hover",
                  buttonStyles.focusRing,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={cx("flex h-11 w-11 items-center justify-center rounded-xl", feature.tint)} aria-hidden="true">
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="h-5 w-5 text-slate-300 transition-colors group-hover:text-brand"
                  />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-ink">{feature.title}</h3>
                <p className="mt-1.5 flex-1 text-sm leading-6 text-muted">{feature.description}</p>
                <span className="mt-4 text-xs font-medium text-slate-500">{feature.status}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
