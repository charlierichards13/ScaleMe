import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, SectionHeading, buttonStyles, cx } from "@/components/ui/primitives";
import type { NextStep } from "@/lib/dashboard/types";

export function NextSteps({ steps }: { steps: NextStep[] }) {
  return (
    <Card aria-labelledby="next-heading">
      <SectionHeading id="next-heading" title="Continue your progress" description="Suggested from what you've added so far." />
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={cx(
                "group flex items-center gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-line hover:bg-canvas",
                buttonStyles.focusRing,
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  index === 0 ? "bg-brand text-white" : "bg-brand-soft text-brand",
                )}
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{step.title}</span>
                <span className="block text-xs leading-5 text-muted">{step.description}</span>
              </span>
              <span className="sr-only">: {step.cta}</span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-brand" />
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
