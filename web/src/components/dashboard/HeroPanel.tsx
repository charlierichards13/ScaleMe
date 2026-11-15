import Link from "next/link";
import { ArrowRight, Mic, Sparkles } from "lucide-react";
import { buttonStyles } from "@/components/ui/primitives";
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
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8"
    >
      {/* Single soft accent wash; decorative only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-soft opacity-70 blur-3xl"
      />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            Your career workspace
          </p>
          <h2 id="hero-heading" className="mt-4 max-w-xl text-2xl font-bold leading-tight tracking-tight text-ink sm:text-[28px]">
            Practice interviews. Review labeled samples.
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-7 text-muted">
            Sample data on this page is fictional. Interview practice uses a fixed script.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {hasResume ? (
              <Link href={routes.impactLab} className={buttonStyles.primary}>
                Review the sample story
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            ) : (
              <Link href={routes.interview} className={buttonStyles.primary}>
                <Mic aria-hidden="true" className="h-4 w-4" />
                Practice an interview
              </Link>
            )}
            {showDemoButton ? (
              <button type="button" onClick={onStartDemo} className={buttonStyles.secondary}>
                Explore with sample data
              </button>
            ) : (
              <Link href={routes.fitInsights} className={buttonStyles.secondary}>
                Open fit explorer
              </Link>
            )}
          </div>
        </div>

        {/* Hidden on phones so the four tools stay near the top of the page. */}
        <div className="hidden rounded-xl border border-line bg-canvas/80 p-4 sm:block">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">What a clear story covers</p>
          <ol className="mt-3 space-y-2">
            {impactLadder.map((step, index) => (
              <li key={step} className="flex items-center gap-3 text-sm text-ink">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-semibold text-brand ring-1 ring-line"
                >
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
