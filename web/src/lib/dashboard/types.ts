/**
 * Dashboard view-model types.
 *
 * Evidence statuses intentionally mirror `RequirementAssessment.status` in
 * docs/api-contract.md ("supported" | "not_evidenced" | "unclear") so a live
 * `/api/fit/analyze` response can be mapped onto these cards without a new
 * shape. Nothing here represents a hiring probability.
 */

/** Where the dashboard data came from. Demo data must always be labeled. */
export type DataSource = "empty" | "demo";

export type EvidenceStatus = "supported" | "not_evidenced" | "unclear";

export type Evidence = {
  source: "resume" | "job" | "interview";
  quote: string;
};

export type EvidenceInsight = {
  id: string;
  requirement: string;
  status: EvidenceStatus;
  explanation: string;
  evidence: Evidence[];
};

export type WorkArrangement = "remote" | "hybrid" | "on_site" | "unknown";
export type EmploymentType = "internship" | "full_time" | "part_time" | "co_op";

/**
 * What the listing itself says about work authorization. "not_stated" must be
 * shown as "needs verification", never as ineligible.
 */
export type AuthorizationStatement =
  | { kind: "not_stated" }
  | { kind: "sponsorship_mentioned"; quote: string }
  | { kind: "citizenship_required"; quote: string };

export type JobPreview = {
  id: string;
  title: string;
  company: string;
  location: string;
  arrangement: WorkArrangement;
  employmentType: EmploymentType;
  period?: string;
  authorization: AuthorizationStatement;
  /** Always true until a live jobs service exists. */
  fictional: true;
};

export type CandidateProfile = {
  hasResume: boolean;
  resumeLabel?: string;
  targetRole?: string;
  workPeriod?: string;
  locationPreference?: string;
  /** null = the user has not chosen; false = declined; true = opted in. */
  authorizationGuidance: boolean | null;
};

export type NextStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
};

export type DashboardSnapshot = {
  source: DataSource;
  profile: CandidateProfile;
  jobs: JobPreview[];
  insights: EvidenceInsight[];
  nextSteps: NextStep[];
};
