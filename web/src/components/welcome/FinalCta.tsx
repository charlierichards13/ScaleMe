import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import { getStartedHref } from "@/lib/auth-status";
import { container, cta } from "./styles";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="py-24 sm:py-32">
      <div className={container}>
        <div className="sm-reveal rounded-[2rem] border border-line bg-surface px-6 py-16 text-center shadow-card sm:px-12 sm:py-20">
          <h2 id="cta-title" className="mx-auto max-w-2xl text-3xl font-semibold tracking-[-0.025em] text-ink sm:text-[2.75rem] sm:leading-[1.1]">
            Ready to look around?
          </h2>
          <p className="mx-auto mt-5 max-w-md text-lg leading-8 text-slate-600">
            Open the guest workspace. Skip anything you are not sure about. Nothing is saved.
          </p>
          <div className="mt-10 flex justify-center">
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
