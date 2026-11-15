import type { CandidateProfile, EvidenceInsight, JobPreview } from "./types";

/*
 * DEMO FIXTURES — every company, role and resume line below is fictional.
 * They exist only to preview the dashboard layout. They are not live job
 * openings, real applicants, or output from AWS Bedrock / the Rust matcher.
 */

export const demoProfile: CandidateProfile = {
  hasResume: true,
  resumeLabel: "Sample resume (fictional)",
  targetRole: "Software engineering internship",
  workPeriod: "Summer 2027",
  locationPreference: "Remote or hybrid · Phoenix, AZ area",
  authorizationGuidance: true,
};

export const demoJobs: JobPreview[] = [
  {
    id: "demo-job-1",
    title: "Software Engineering Intern",
    company: "Fernwood Analytics",
    location: "Phoenix, AZ",
    arrangement: "hybrid",
    employmentType: "internship",
    period: "May – Aug 2027",
    authorization: { kind: "not_stated" },
    fictional: true,
  },
  {
    id: "demo-job-2",
    title: "Frontend Developer Intern",
    company: "Bluepine Health",
    location: "Remote (US)",
    arrangement: "remote",
    employmentType: "internship",
    period: "Summer 2027",
    authorization: {
      kind: "sponsorship_mentioned",
      quote: "Open to candidates eligible for CPT.",
    },
    fictional: true,
  },
  {
    id: "demo-job-3",
    title: "Associate Platform Engineer",
    company: "Quarry & Kite Systems",
    location: "Tempe, AZ",
    arrangement: "on_site",
    employmentType: "full_time",
    authorization: {
      kind: "citizenship_required",
      quote: "U.S. citizenship required for this role.",
    },
    fictional: true,
  },
];

export const demoInsights: EvidenceInsight[] = [
  {
    id: "demo-insight-1",
    requirement: "Builds user interfaces with React and TypeScript",
    status: "supported",
    explanation: "The resume names both technologies in a described project.",
    evidence: [
      {
        source: "resume",
        quote: "Built an internal employee portal with React and TypeScript",
      },
    ],
  },
  {
    id: "demo-insight-2",
    requirement: "Writes automated tests",
    status: "not_evidenced",
    explanation:
      "The resume doesn't mention testing. That isn't proof of a gap, so add an example if you have one.",
    evidence: [],
  },
  {
    id: "demo-insight-3",
    requirement: "Integrates REST APIs",
    status: "unclear",
    explanation:
      "APIs are mentioned, but not what you built or decided. A follow-up question would clarify your role.",
    evidence: [{ source: "resume", quote: "integrated REST APIs" }],
  },
];
