import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import { getStartedHref } from "@/lib/auth-status";
import { container, cta, eyebrow } from "./styles";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className={cx(container, "pb-8 pt-10 sm:pb-20 sm:pt-16 lg:pb-28 lg:pt-20")}>
      <div className="sm-rise max-w-xl">
        <p className={cx(eyebrow, "flex items-center gap-2.5")}>
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand" />
          Career workspace preview
        </p>
        <h1
          id="hero-title"
          className="mt-6 text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-6xl lg:text-[4.25rem]"
        >
          Your career.
          <br />
          <span className="text-slate-500">Your potential.</span>
          <br />
          <span className="text-brand">Scaled.</span>
        </h1>
        <p className="mt-7 max-w-md text-lg leading-8 text-slate-600">
          Practice a scripted interview and review labeled sample stories in one workspace.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href={getStartedHref()} className={cta.primary}>
            Get Started
            <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
          <a href="#features" className={cta.secondary}>
            Learn More
          </a>
        </div>
        <p className="mt-6 text-sm text-muted">Free guest preview. No account needed, and nothing is saved.</p>
      </div>
    </section>
  );
}
