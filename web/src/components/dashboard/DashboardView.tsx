"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FlaskConical, UserRound } from "lucide-react";
import { buttonStyles, cx } from "@/components/ui/primitives";
import { getDashboardSnapshot } from "@/lib/dashboard/snapshot";
import type { DataSource } from "@/lib/dashboard/types";
import { routes } from "@/lib/routes";
import { EvidenceInsights } from "./EvidenceInsights";
import { FeatureCards } from "./FeatureCards";
import { HeroPanel } from "./HeroPanel";
import { NextSteps } from "./NextSteps";
import { ProfileSummary } from "./ProfileSummary";
import { RecommendedJobs } from "./RecommendedJobs";

/**
 * Client container: owns the empty/demo toggle and passes a typed snapshot to
 * presentational sections. Initial render is deterministic ("empty"), so
 * server prerender and hydration always match.
 */
export function DashboardView() {
  const [source, setSource] = useState<DataSource>("empty");
  const snapshot = useMemo(() => getDashboardSnapshot(source), [source]);
  const isDemo = snapshot.source === "demo";

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {isDemo
              ? "Previewing ScaleMe with a fictional sample profile."
              : "Welcome to ScaleMe. Start with your resume to unlock personalized guidance."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DemoSwitch checked={isDemo} onChange={(on) => setSource(on ? "demo" : "empty")} />
          <Link href={routes.settings} aria-label="Profile and settings" className={cx(buttonStyles.icon, "border border-line bg-surface")}>
            <UserRound aria-hidden="true" className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {isDemo && (
        <div
          role="status"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p className="flex items-center gap-2">
            <FlaskConical aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>
              <strong className="font-semibold">Demo mode.</strong> Fictional profile, listings and analysis. No live AI, job data or saved account.
            </span>
          </p>
          <button
            type="button"
            onClick={() => setSource("empty")}
            className={cx("rounded-lg px-2 py-1 text-sm font-semibold underline-offset-2 hover:underline", buttonStyles.focusRing)}
          >
            Exit demo
          </button>
        </div>
      )}

      <div className="mt-6 space-y-6">
        <HeroPanel
          hasResume={snapshot.profile.hasResume}
          showDemoButton={!isDemo}
          onStartDemo={() => setSource("demo")}
        />

        <FeatureCards />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            <RecommendedJobs
              key={snapshot.source}
              jobs={snapshot.jobs}
              showAuthorization={snapshot.profile.authorizationGuidance === true}
            />
            <EvidenceInsights insights={snapshot.insights} isDemo={isDemo} />
          </div>
          <div className="min-w-0 space-y-6">
            <ProfileSummary profile={snapshot.profile} isDemo={isDemo} />
            <NextSteps steps={snapshot.nextSteps} />
          </div>
        </div>

        <p className="pb-4 text-center text-xs leading-5 text-slate-500">
          ScaleMe offers coaching guidance, not hiring predictions or legal advice. For work-authorization questions,
          check with the employer or your school&apos;s DSO.
        </p>
      </div>
    </div>
  );
}

function DemoSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        "inline-flex h-10 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-canvas",
        buttonStyles.focusRing,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-brand" : "bg-slate-300",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
      Sample data
    </button>
  );
}
