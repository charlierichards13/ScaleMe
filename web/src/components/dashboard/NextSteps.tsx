import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, SectionHeading, buttonStyles, cx } from "@/components/ui/primitives";
import type { NextStep } from "@/lib/dashboard/types";

export function NextSteps({ steps }: { steps: NextStep[] }) {
  return (
    <Card aria-labelledby="next-heading">
      <SectionHeading
        id="next-heading"
        title="Choose your next step"
        description="Each opens a separate workspace. Dashboard data and saves stay here."
      />
      <ol className="divide-y divide-line">
        {steps.map((step, index) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={cx(
                "group flex items-center gap-3 rounded-xl px-1 py-4 transition-colors hover:bg-canvas",
                buttonStyles.focusRing,
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  index === 0 ? "bg-brand-strong text-white" : "bg-brand-soft text-brand-strong",
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
