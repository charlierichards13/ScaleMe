import Link from "next/link";
import { ArrowRight, Mic } from "lucide-react";
import { buttonStyles, cx } from "@/components/ui/primitives";
import { routes } from "@/lib/routes";

const impactLadder = ["Problem", "Your contribution", "Technical decisions", "Trade-offs", "Evidence", "Impact"];

export function HeroPanel({
  hasResume,
  showDemoButton,
  onStartDemo,
}: {
  hasResume: boolean;
  showDemoButton: boolean;
  onStartDemo: () => void;
}) {
  return (
    <section aria-labelledby="hero-heading" className="rounded-2xl bg-ink p-5 text-white sm:p-7 lg:p-8">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-highlight">
            {showDemoButton ? "Start with your story" : "Explore a fictional story"}
          </p>
          <h2 id="hero-heading" className="mt-3 max-w-lg text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {showDemoButton ? "Make your experience easier to explain." : "See what the evidence actually says."}
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">
            {showDemoButton
              ? "Rehearse with five fixed questions, or explore clearly labeled fictional examples."
              : "This dashboard shows sample quotes, roles and goals. Nothing here is a live assessment of you."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={hasResume ? routes.impactLab : routes.interview} className={cx(buttonStyles.primary, "focus-visible:ring-offset-ink")}>
              {hasResume ? <>Review the sample story <ArrowRight aria-hidden="true" className="h-4 w-4" /></> : <><Mic aria-hidden="true" className="h-4 w-4" /> Practice an interview</>}
            </Link>
            {showDemoButton ? (
              <button type="button" onClick={onStartDemo} className={cx(buttonStyles.secondary, "focus-visible:ring-offset-ink")}>
                Explore with sample data
              </button>
            ) : (
              <Link href={routes.fitInsights} className={cx(buttonStyles.secondary, "focus-visible:ring-offset-ink")}>
                Open fit explorer
              </Link>
            )}
          </div>
        </div>
        <div className="hidden border-l border-white/15 pl-7 xl:block">
          <p className="text-xs font-medium text-slate-300">What a clear story covers</p>
          <ol className="mt-4 space-y-2.5">
            {impactLadder.map((step, index) => (
              <li key={step} className="flex items-center gap-3 text-sm">
                <span aria-hidden="true" className="w-5 text-xs tabular-nums text-brand-highlight">0{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
