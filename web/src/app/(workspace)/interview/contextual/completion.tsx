"use client";

import { useState } from "react";
import ImpactLab, { type Workspace } from "@/app/impact-lab/impact-lab";
import { Card, buttonStyles } from "@/components/ui/primitives";
import { interviewImpact, resumeExperiences, type AnswerLink } from "@/lib/contextual-interview/impact";
import type { EvidenceHandoff } from "@/lib/contextual-interview/session";

export function InterviewCompletion({ handoff }: { handoff: EvidenceHandoff }) {
  const [links, setLinks] = useState<Record<string, AnswerLink>>({});
  const [report, setReport] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  let experiences: ReturnType<typeof resumeExperiences> = [];
  try { experiences = resumeExperiences(handoff); } catch { /* Fail closed below, preserving the transcript. */ }
  function build() {
    try { setReport(interviewImpact(handoff, links)); setError(""); }
    catch { setError("The original analysis or answer references could not be validated. No coverage change was accepted. Your original context and answers remain here; start a new session to obtain a fresh analysis."); }
  }
  if (report) return <section aria-label="Interview impact report">
    <button type="button" className={buttonStyles.secondary} onClick={() => setReport(null)}>Review answer associations</button>
    <p className="mt-3 text-sm text-muted">Changing associations rebuilds the report from the original baseline and resets candidate confirmations.</p>
    <ImpactLab embedded initialWorkspace={report} initialFit={{ request: handoff.context, analysis: handoff.initialAnalysis }} />
  </section>;
  return <Card aria-labelledby="completion-title">
    <h2 id="completion-title" className="text-xl font-semibold">Connect your answers to your experience</h2>
    <p className="mt-2 text-sm leading-6 text-muted">Choose the original resume excerpt each answer refers to. We never guess the association. Leave unrelated or uncertain answers unlinked; they remain in your transcript and cannot increase coverage. General answers also need an explicit requirement selection.</p>
    <p className="mt-2 text-sm leading-6 text-muted">Reassessment uses conservative local English text rules, with no additional AI call. Exact quotations and relevance are checked again. Its baseline may be stricter than the AI analysis. All statements remain candidate-reported, not independently verified.</p>
    <div className="mt-5 space-y-5">{handoff.answers.map(answer => {
      const link = links[answer.id] ?? { subjectId: "", requirementId: answer.targetRequirementId ?? "" };
      return <article key={answer.id} className="min-w-0 rounded-xl border border-line p-4">
        <p className="text-xs text-muted">{answer.id} · {answer.sourceRef} · candidate-reported</p>
        <p className="mt-2 text-sm text-muted">Coach: {answer.question}</p>
        <blockquote className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">{answer.quote}</blockquote>
        <label className="mt-3 block text-sm font-semibold">Original experience for {answer.id}
          <select className="mt-2 block w-full min-w-0 rounded-xl border border-line bg-surface p-3 text-sm" value={link.subjectId} onChange={e => setLinks({ ...links, [answer.id]: { ...link, subjectId: e.target.value } })}>
            <option value="">Unlinked — choose an experience or leave uncertain</option>
            {experiences.map(experience => <option key={experience.subjectId} value={experience.subjectId}>{experience.quote} (resume offsets {experience.start}–{experience.end})</option>)}
          </select>
        </label>
        <label className="mt-3 block text-sm font-semibold">Requirement for {answer.id}
          <select className="mt-2 block w-full min-w-0 rounded-xl border border-line bg-surface p-3 text-sm" disabled={!!answer.targetRequirementId} value={link.requirementId} onChange={e => setLinks({ ...links, [answer.id]: { ...link, requirementId: e.target.value } })}>
            <option value="">Unlinked — choose a requirement</option>
            {handoff.context.job.requirements?.map(r => <option key={r.id} value={r.id}>{r.description}</option>)}
          </select>
        </label>
      </article>;
    })}</div>
    {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
    <button type="button" className={`${buttonStyles.primary} mt-5`} onClick={build}>Build evidence impact report</button>
    <details className="mt-5 text-sm"><summary className="cursor-pointer">Inspect unchanged original context and AI analysis</summary>
      <pre className="mt-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{JSON.stringify({ context: handoff.context, initialAnalysis: handoff.initialAnalysis, history: handoff.history }, null, 2)}</pre>
    </details>
  </Card>;
}
