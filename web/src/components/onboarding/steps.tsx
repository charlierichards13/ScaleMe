"use client";

import { useId, useState, type ChangeEvent, type Dispatch, type ReactNode } from "react";
import {
  Briefcase,
  Compass,
  FileText,
  GraduationCap,
  Info,
  Mic,
  PenLine,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { buttonStyles, cx } from "@/components/ui/primitives";
import {
  checkResumeMetadata,
  formatFileSize,
  hasPdfSignature,
  resumeCheckMessages,
} from "@/lib/onboarding/resume-file";
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

/**
 * Optional PDF picker. The file is checked locally (extension, MIME, size and
 * the first five bytes) and then only its name and size are kept in memory.
 * It is never uploaded, parsed, or stored: secure parsing is Issue #4, and
 * these checks must be repeated on the server once it exists.
 */
export function ResumeStep({ answers, dispatch }: StepProps) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    const check = checkResumeMetadata(file);
    if (!check.ok) {
      setError(resumeCheckMessages[check.reason]);
      return;
    }
    setChecking(true);
    try {
      const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
      if (!hasPdfSignature(head)) {
        setError(resumeCheckMessages["not-pdf"]);
        return;
      }
      setError(null);
      dispatch({ type: "selectResume", selection: { name: file.name, sizeBytes: file.size } });
    } catch {
      setError("That file couldn't be read. Try choosing it again.");
    } finally {
      setChecking(false);
    }
  }

  const resume = answers.resume;

  return (
    <div className="space-y-5">
      {resume ? (
        <div className="flex items-center gap-4 rounded-2xl border border-brand/30 bg-brand-soft/50 p-4">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-brand shadow-card">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{resume.name}</p>
            <p className="text-xs text-muted">{formatFileSize(resume.sizeBytes)} · PDF chosen, still on your device</p>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "clearResume" })}
            className={cx(buttonStyles.icon, "h-9 w-9")}
            aria-label={`Remove ${resume.name}`}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={cx(
            "flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-canvas px-6 py-10 text-center transition-colors",
            "hover:border-brand/50 hover:bg-brand-soft/40",
            "has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-brand has-[input:focus-visible]:ring-offset-2",
          )}
        >
          <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-brand shadow-card">
            <Upload className="h-5 w-5" />
          </span>
          <span className="mt-4 text-[15px] font-semibold text-ink">{checking ? "Checking file…" : "Choose a PDF resume"}</span>
          <span className="mt-1 text-sm text-muted">PDF only, up to 5 MB</span>
          <input
            id={inputId}
            type="file"
            accept="application/pdf,.pdf"
            onChange={onFile}
            disabled={checking}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className="sr-only"
          />
        </label>
      )}

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <Notice>
        <strong className="font-semibold text-ink">Resume reading isn&apos;t connected yet.</strong> In this preview your PDF
        stays on your device. It isn&apos;t uploaded or saved, and only its first few bytes are checked to confirm
        it&apos;s a PDF. You can continue without one.
      </Notice>
    </div>
  );
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
