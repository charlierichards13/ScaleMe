"use client";

import { useId, type Dispatch, type ReactNode } from "react";
import {
  Briefcase,
  Compass,
  GraduationCap,
  Info,
  Mic,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { buttonStyles, cx } from "@/components/ui/primitives";
import { ResumeUploadControls } from "@/components/resume/ResumeUploadControls";
import { useActiveResume } from "@/lib/resume/active-resume";
import type { ResumeUploadTask } from "@/lib/resume/use-resume-upload";
import {
  MAX_TEXT_LENGTH,
  goalOptions,
  timingOptions,
  workArrangementOptions,
  type GoalId,
  type OnboardingAction,
  type OnboardingAnswers,
} from "@/lib/onboarding/state";
import { ChoiceCard } from "./ChoiceCard";

type StepProps = { answers: OnboardingAnswers; dispatch: Dispatch<OnboardingAction> };

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-canvas px-4 py-3 text-sm leading-6 text-slate-600">
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
      <div>{children}</div>
    </div>
  );
}

/* Step 1 — Resume ------------------------------------------------------- */

/** Uses the same explicit upload controller as Resume Lab. */
export function ResumeStep({ upload }: { upload: ResumeUploadTask }) {
  const resume = useActiveResume();
  return <div className="space-y-5">
    {resume ? <div role="status" className="rounded-2xl border border-brand/30 bg-brand-soft/50 p-5">
      <p className="font-semibold text-ink">Resume extracted and ready to review.</p>
      <p className="mt-2 break-all text-sm text-muted">{resume.filename} · Available in this tab for Resume Lab and Fit Explorer.</p>
      <button type="button" className={cx(buttonStyles.secondary, "mt-4 min-h-11")} onClick={upload.clear}>Remove parsed resume</button>
    </div> : <ResumeUploadControls upload={upload} />}
    <Notice>Parsing is optional. Continue without a PDF, or select one and extract it during the demo window. Avoid uploading sensitive personal information.</Notice>
  </div>;
}
/* Step 2 — Goals -------------------------------------------------------- */

const goalIcons: Record<GoalId, LucideIcon> = {
  internship: GraduationCap,
  "full-time": Briefcase,
  resume: PenLine,
  interviews: Mic,
  explore: Compass,
};

export function GoalsStep({ answers, dispatch }: StepProps) {
  return (
    <fieldset>
      <legend className="sr-only">Career goals. Choose any that apply.</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {goalOptions.map((goal) => {
          const Icon = goalIcons[goal.id];
          return (
            <ChoiceCard
              key={goal.id}
              type="checkbox"
              name="goals"
              checked={answers.goals.includes(goal.id)}
              onChange={() => dispatch({ type: "toggleGoal", goal: goal.id })}
              icon={<Icon className="h-[18px] w-[18px]" />}
            >
              {goal.label}
            </ChoiceCard>
          );
        })}
      </div>
    </fieldset>
  );
}

/* Step 3 — Preferences -------------------------------------------------- */

const fieldLabel = "block text-sm font-semibold text-ink";
const textInput = cx(
  "mt-2 block h-12 w-full rounded-xl border border-line bg-surface px-4 text-[15px] text-ink placeholder:text-slate-400",
  "transition-[border-color,box-shadow] focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15",
);

export function PreferencesStep({ answers, dispatch }: StepProps) {
  const roleId = useId();
  const locationId = useId();

  return (
    <div className="space-y-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={roleId} className={fieldLabel}>
            Role or career field
          </label>
          <input
            id={roleId}
            type="text"
            autoComplete="off"
            maxLength={MAX_TEXT_LENGTH}
            value={answers.role}
            onChange={(event) => dispatch({ type: "setText", field: "role", value: event.target.value })}
            placeholder="e.g. Software engineering"
            className={textInput}
          />
        </div>
        <div>
          <label htmlFor={locationId} className={fieldLabel}>
            Preferred location
          </label>
          <input
            id={locationId}
            type="text"
            autoComplete="off"
            maxLength={MAX_TEXT_LENGTH}
            value={answers.location}
            onChange={(event) => dispatch({ type: "setText", field: "location", value: event.target.value })}
            placeholder="e.g. Phoenix, AZ or anywhere"
            className={textInput}
          />
        </div>
      </div>

      <fieldset>
        <legend className={fieldLabel}>
          Work arrangement <span className="font-normal text-muted">(choose any)</span>
        </legend>
        <div className="mt-3 grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-3">
          {workArrangementOptions.map((option) => (
            <ChoiceCard
              key={option.id}
              type="checkbox"
              name="arrangement"
              size="sm"
              checked={answers.arrangements.includes(option.id)}
              onChange={() => dispatch({ type: "toggleArrangement", arrangement: option.id })}
            >
              {option.label}
            </ChoiceCard>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={fieldLabel}>When would you like to start?</legend>
        <p className="mt-1 text-sm text-muted">Pick the closest fit. No exact dates needed.</p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {timingOptions.map((option) => (
            <ChoiceCard
              key={option.id}
              type="radio"
              name="timing"
              size="sm"
              checked={answers.timing === option.id}
              onChange={() => dispatch({ type: "setTiming", timing: option.id })}
            >
              {option.label}
            </ChoiceCard>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/* Step 4 — Personalization ---------------------------------------------- */

function ToggleRow({
  title,
  badge,
  checked,
  onChange,
  children,
}: {
  title: string;
  badge?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div
      className={cx(
        "rounded-2xl border p-5 transition-colors",
        checked ? "border-brand/40 bg-brand-soft/40" : "border-line bg-surface",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor={id} className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
            {title}
            {badge && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-inset ring-amber-200">
                {badge}
              </span>
            )}
          </label>
          <div id={`${id}-desc`} className="mt-1.5 text-sm leading-6 text-muted">
            {children}
          </div>
        </div>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={`${id}-desc`}
          className={cx(
            "relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 transition-colors",
            "before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow before:transition-transform",
            "checked:bg-brand checked:before:translate-x-5",
            buttonStyles.focusRing,
          )}
        />
      </div>
    </div>
  );
}

export function PersonalizeStep({ answers, dispatch }: StepProps) {
  return (
    <div className="space-y-4">
      <ToggleRow
        title="International student guidance"
        checked={answers.internationalGuidance}
        onChange={(value) => dispatch({ type: "setSupport", field: "internationalGuidance", value })}
      >
        Highlight what job listings say about work authorization, such as CPT, OPT, STEM OPT, sponsorship, or citizenship
        requirements, with general explanations. ScaleMe never decides your eligibility or asks for immigration documents.
        For advice about your situation, talk to your school&apos;s DSO or an immigration attorney.
      </ToggleRow>
      <ToggleRow
        title="Job update notifications"
        badge="Not available yet"
        checked={answers.jobUpdates}
        onChange={(value) => dispatch({ type: "setSupport", field: "jobUpdates", value })}
      >
        Notifications haven&apos;t been built yet, so nothing will be sent. Turning this on only records your interest for
        this visit.
      </ToggleRow>
    </div>
  );
}
