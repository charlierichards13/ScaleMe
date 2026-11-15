"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { Card, EmptyState, SectionHeading, buttonStyles } from "@/components/ui/primitives";
import type { JobPreview } from "@/lib/dashboard/types";
import { routes } from "@/lib/routes";
import { JobPreviewCard } from "./JobPreviewCard";

export function RecommendedJobs({ jobs, showAuthorization }: { jobs: JobPreview[]; showAuthorization: boolean }) {
  // Saved state lives only in this component's memory; it resets when the
  // dashboard is re-rendered fresh (demo toggle, reload, or navigation).
  // There is no persistence yet.
  const [saved, setSaved] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = (id: string) =>
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card aria-labelledby="jobs-heading">
      <SectionHeading
        id="jobs-heading"
        title="Recommended roles"
        description={
          jobs.length > 0
            ? "Fictional sample listings. Saves are temporary and may reset when you leave this page."
            : undefined
        }
        action={
          <Link href={routes.discover} className={buttonStyles.ghost}>
            About Discover
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        }
      />
      {jobs.length === 0 ? (
        <EmptyState
          icon={<Compass className="h-5 w-5" />}
          title="No roles on this page"
          description="Turn on sample data to see fictional roles."
          action={
            <Link href={routes.interview} className={buttonStyles.secondary}>
              Practice an interview
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobPreviewCard
              key={job.id}
              job={job}
              saved={saved.has(job.id)}
              onToggleSave={() => toggle(job.id)}
              showAuthorization={showAuthorization}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
