import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole, Scale } from "lucide-react";
import { Badge, Card, buttonStyles } from "@/components/ui/primitives";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Fit Analysis | ScaleMe" };

export default function FitPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <Link href={routes.dashboard} className={buttonStyles.ghost}>
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to dashboard
      </Link>
      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Scale aria-hidden="true" className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            Fit Analysis
          </h1>
          <Badge>Local preview</Badge>
        </div>
        <p className="mt-4 text-[15px] leading-7 text-muted">
          Prepare a resume and target role, then explore how requirements
          connect to evidence. The Fit Evidence Explorer is ready to try with
          local drafts and clearly labeled fictional samples.
        </p>
        <h2 className="mt-6 text-sm font-semibold text-ink">
          Available in the explorer
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
          <li>
            Check pasted resume and job drafts locally without submitting them.
          </li>
          <li>
            Explicitly load a fixed fictional API sample with quotes,
            explanations and questions.
          </li>
          <li>
            Try a separate offline interview walkthrough and inspect its sample
            evidence changes.
          </li>
        </ul>
        <div className="mt-6 flex gap-3 rounded-xl bg-canvas px-4 py-3 text-sm leading-6 text-slate-600">
          <LockKeyhole aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
          <p>
            Live analysis is not available yet. The preview does not analyze
            your drafts, run live AI, upload files or fetch job links.
          </p>
        </div>
        <Link href="/fit-insights" className={`${buttonStyles.primary} mt-6`}>
          Open Fit Evidence Explorer{" "}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </Card>
    </div>
  );
}
