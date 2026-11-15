import { Compass, Flame, Mic, ScanSearch, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import { container, eyebrow } from "./styles";

type Feature = { title: string; description: string; icon: LucideIcon; signature?: boolean };

const features: Feature[] = [
  {
    title: "Discover Opportunities",
    description: "Role browsing is planned. The workspace explains what the deck will include.",
    icon: Compass,
  },
  {
    title: "Understand Your Fit",
    description: "Prepare a resume and job on this device, or open a labeled fictional sample. Live analysis is off.",
    icon: ScanSearch,
  },
  {
    title: "Grill My Resume",
    description: "Review a fictional bullet and the quotes behind it. You can copy a bullet only after confirming those quotes.",
    icon: Flame,
    signature: true,
  },
  {
    title: "Practice Interviews",
    description: "Answer a fixed set of questions and reread what you wrote. The next question does not depend on your answer.",
    icon: Mic,
  },
];

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-6 py-20 sm:py-32">
      <div className={container}>
        <div className="sm-reveal mx-auto max-w-3xl text-center">
          <p className={eyebrow}>Features</p>
          <h2 id="features-title" className="mt-4 text-3xl font-semibold tracking-[-0.025em] text-ink sm:text-[2.75rem] sm:leading-[1.1]">
            Everything you need to move forward.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Four tools in one workspace. Sample stories and the practice script are labeled.
          </p>
        </div>

        <ul className="mt-14 grid gap-5 sm:mt-16 md:grid-cols-2">
          {features.map((feature) => (
            <li key={feature.title} className="sm-reveal">
              <FeatureCard feature={feature} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  return (
    <article
      className={cx(
        "group h-full rounded-2xl border border-line bg-surface p-7 shadow-card transition-[border-color,box-shadow] duration-300 sm:p-8",
        "hover:border-brand/25 hover:shadow-card-hover",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand transition-colors duration-300 group-hover:bg-brand group-hover:text-white"
        >
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
        {feature.signature && (
          <span className="rounded-full border border-brand/20 bg-brand-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-strong">
            Signature
          </span>
        )}
      </div>
      <h3 className="mt-7 text-lg font-semibold tracking-tight text-ink">{feature.title}</h3>
      <p className="mt-2 text-[15px] leading-7 text-muted">{feature.description}</p>
    </article>
  );
}
