import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import { getStartedHref } from "@/lib/auth-status";
import { container, cta, eyebrow } from "./styles";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className={cx(container, "relative pb-8 pt-10 sm:pb-20 sm:pt-16 lg:pb-28 lg:pt-20")}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_80%_20%,var(--brand-soft),transparent_65%)]" />
      <div className="sm-rise relative mx-auto max-w-xl">
        <p className={cx(eyebrow, "flex items-center gap-2.5")}>
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand" />
          Career workspace preview
        </p>
        <h1
          id="hero-title"
          className="mt-6 text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-6xl lg:text-[4.25rem]"
        >
          Invest in your own <span className="text-brand">potential.</span>
        </h1>
        <p className="mt-7 max-w-md text-lg leading-8 text-slate-600">
          Build confidence through evidence-driven career preparation. Practice a scripted interview and explore the quotes behind clearly labeled sample stories.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href={getStartedHref()} className={cta.primary}>
            Get Started
            <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
          <a href="#features" className={cta.secondary}>
            See how it works
          </a>
        </div>
        <p className="mt-6 text-sm text-muted">Free guest preview. No account needed, and nothing is saved.</p>
      </div>
    </section>
  );
}
