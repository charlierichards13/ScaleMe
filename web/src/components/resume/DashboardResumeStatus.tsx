import Link from "next/link";
import { FileCheck } from "lucide-react";
import { Card, buttonStyles, cx } from "@/components/ui/primitives";
import { routes } from "@/lib/routes";
import type { Resume } from "@/lib/ai/schemas";

export function DashboardResumeStatus({ resume, isDemo }: { resume: Resume; isDemo: boolean }) {
  return <Card role="status" className="mt-5" aria-labelledby="tab-resume-status">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><h2 id="tab-resume-status" className="flex items-center gap-2 font-semibold"><FileCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-brand" />Resume ready to review</h2>
        <p className="mt-2 break-all text-sm text-muted">{resume.filename ?? "Extracted resume"}</p>
        <p className="mt-1 text-sm leading-6 text-muted">Available in this browser tab, not a saved profile.{isDemo ? " Separate from the fictional sample profile below." : " Cleared when removed or reloaded."}</p>
      </div>
      <div className="flex flex-wrap gap-3"><Link href={routes.resumeLab} className={cx(buttonStyles.primary, "min-h-11")}>Continue in Resume Lab</Link><Link href={routes.fitInsights} className={cx(buttonStyles.secondary, "min-h-11")}>Open Fit Explorer</Link></div>
    </div>
  </Card>;
}
