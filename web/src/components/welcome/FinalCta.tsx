import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import { getStartedHref } from "@/lib/routes";
import { container, cta } from "./styles";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="py-24 sm:py-32">
      <div className={container}>
        <div className="sm-reveal relative overflow-hidden rounded-[2rem] border border-line bg-surface px-6 py-16 text-center shadow-card sm:px-12 sm:py-20">
          <CtaRibbon />
          <h2 id="cta-title" className="relative mx-auto max-w-2xl text-3xl font-semibold tracking-[-0.025em] text-ink sm:text-[2.75rem] sm:leading-[1.1]">
            Ready for your next opportunity?
          </h2>
          <p className="relative mx-auto mt-5 max-w-md text-lg leading-8 text-slate-600">
            Set up your workspace in about a minute. Skip anything you&apos;re not sure about yet.
          </p>
          <div className="relative mt-10 flex justify-center">
            <Link href={getStartedHref()} className={cx(cta.primary, "px-8")}>
              Get Started
              <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A faint echo of the hero ribbon so the page closes on the same motif. */
function CtaRibbon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1000 300"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id="sm-cta-ribbon" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#eef0ff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#dcdcff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#eef0ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M -20 270 C 220 250 340 150 520 160 C 700 170 800 80 1020 40 L 1020 70 C 820 110 720 196 520 194 C 350 192 230 286 -20 300 Z" fill="url(#sm-cta-ribbon)" />
    </svg>
  );
}
