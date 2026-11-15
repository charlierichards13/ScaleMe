"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FlaskConical, UserRound } from "lucide-react";
import { Badge, buttonStyles, cx } from "@/components/ui/primitives";
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
    <div className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted">Workspace</span>
            <Badge tone={isDemo ? "demo" : "neutral"}>{isDemo ? "Fictional sample" : "Guest · empty"}</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Dashboard</h1>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            {isDemo
              ? "Fictional sample profile on this page."
              : "A place to practice, reflect and find your next step."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DemoSwitch checked={isDemo} onChange={(on) => setSource(on ? "demo" : "empty")} />
          <Link href={routes.onboarding} aria-label="Guest setup" className={cx(buttonStyles.icon, "border border-line bg-surface")}>
            <UserRound aria-hidden="true" className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {isDemo && (
        <div
          role="status"
            className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
        >
          <p className="flex min-w-0 flex-1 basis-64 items-start gap-2">
            <FlaskConical aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
            <span>
              <strong className="font-semibold">Demo mode.</strong> Fictional profile, listings and analysis. No live AI, job data or saved account.
            </span>
          </p>
          <button
            type="button"
            onClick={() => setSource("empty")}
            className={cx("min-h-11 rounded-lg px-2 py-2 text-sm font-semibold underline underline-offset-4", buttonStyles.focusRing)}
          >
            Exit demo
          </button>
        </div>
      )}

      <div className="mt-5 space-y-6 sm:mt-6 sm:space-y-7">
        <HeroPanel
          hasResume={snapshot.profile.hasResume}
          showDemoButton={!isDemo}
          onStartDemo={() => setSource("demo")}
        />

        <FeatureCards />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <EvidenceInsights insights={snapshot.insights} isDemo={isDemo} />
            <RecommendedJobs
              key={snapshot.source}
              jobs={snapshot.jobs}
              showAuthorization={snapshot.profile.authorizationGuidance === true}
            />
          </div>
          <div className="min-w-0 space-y-6">
            <NextSteps steps={snapshot.nextSteps} />
            <ProfileSummary profile={snapshot.profile} isDemo={isDemo} />
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
          "inline-flex min-h-11 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-canvas",
        buttonStyles.focusRing,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "relative block h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-brand" : "bg-slate-300",
        )}
      >
        {/* Anchored to the track's left edge; 2px inset each side (36 - 16 - 2*2 = 16px travel). */}
        <span
          className={cx(
            "absolute left-0.5 top-0.5 block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </span>
      Sample data
    </button>
  );
}
