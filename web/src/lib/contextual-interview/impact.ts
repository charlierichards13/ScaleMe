import { FitAnalysisSchema } from "@/lib/ai/schemas";
import { fromCandidateTurn, fromFitAnalysis } from "@/lib/evidence-ledger/adapters";
import { LedgerValidationError } from "@/lib/evidence-ledger/ledger";
import { collectEvidence, type EvidenceHandoff } from "./session";

export type Experience = { subjectId: string; start: number; end: number; quote: string };
export type AnswerLink = { subjectId: string; requirementId: string };

/** Fit API permits case/whitespace-normalized quotes. Resolve a UNIQUE exact
 * source span; ambiguous/missing citations lose support, never gain an invented link.
 * The untouched AI response remains available in the completion review. */
function fitLedger(handoff: EvidenceHandoff) {
  const analysis = FitAnalysisSchema.parse(handoff.initialAnalysis);
  const text = handoff.context.resume.text;
  for (const assessment of analysis.assessments) {
    assessment.evidence = assessment.evidence.flatMap(e => {
      if (e.source !== "resume") return [e]; // Adapter excludes job and rejects interview.
      const pattern = e.quote.trim().split(/\s+/).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
      const matches = [...text.matchAll(new RegExp(pattern, "gi"))];
      return matches.length === 1 && matches[0][0].length <= 500 ? [{ ...e, quote: matches[0][0] }] : [];
    });
  }
  return fromFitAnalysis(handoff.context, analysis);
}

/** Options are exact spans, not inferred employers or semantic associations. */
export function resumeExperiences(handoff: EvidenceHandoff): Experience[] {
  const text = handoff.context.resume.text;
  const view = fitLedger(handoff).view();
  const spans = view.evidence.filter(e => view.sources.find(s => s.id === e.sourceId)?.kind === "resume")
    .map(e => ({ start: e.start, end: e.end }));
  for (const match of text.matchAll(/[^\n]+/g)) {
    const quote = match[0].trim();
    if (quote) { const start = match.index! + match[0].indexOf(quote); spans.push({ start, end: start + quote.length }); }
  }
  return [...new Map(spans.map(({ start, end }) => {
    const subjectId = `resume-span-${start}-${end}`;
    return [subjectId, { subjectId, start, end, quote: text.slice(start, end) }];
  })).values()];
}

/** Rebuild from immutable original inputs; no submitted counts or ledger state. */
export function interviewImpact(handoff: EvidenceHandoff, links: Record<string, AnswerLink>) {
  const canonical = collectEvidence(handoff.context, handoff.initialAnalysis, handoff.history);
  if (JSON.stringify(canonical.answers) !== JSON.stringify(handoff.answers)) throw new LedgerValidationError();
  let ledger = fitLedger(handoff);
  const experiences = resumeExperiences(handoff);
  const proposalLinks: Array<{ originalId: string; answerId: string }> = [];
  for (const answer of handoff.answers) {
    const link = links[answer.id];
    if (!link?.subjectId || !link.requirementId) continue;
    const experience = experiences.find(e => e.subjectId === link.subjectId);
    if (!experience || (answer.targetRequirementId && answer.targetRequirementId !== link.requirementId) ||
        !handoff.context.job.requirements?.some(r => r.id === link.requirementId)) throw new LedgerValidationError();
    // Resolve back to the exact candidate turn. Never use a coach quote as evidence.
    const turnIndex = Number(answer.sourceRef.replace(/^turn-/, ""));
    const turn = handoff.history[turnIndex];
    if (!turn || turn.role !== "candidate" || turn.content !== answer.quote || answer.id !== `interview-answer-${turnIndex}`)
      throw new LedgerValidationError();
    ledger = ledger.withResumeSubject(experience.start, experience.end).reassess(fromCandidateTurn({
      id: answer.id, role: "candidate", content: turn.content,
      targetRequirementId: link.requirementId, subjectId: experience.subjectId,
    }));
    for (const original of ledger.view().evidence.filter(e => e.sourceId === experience.subjectId)) {
      try {
        ledger.proposeImpact(original.id, `answer:${answer.id}`);
        proposalLinks.push({ originalId: original.id, answerId: `answer:${answer.id}` }); break;
      } catch { /* Unresolved/contradictory evidence never creates a proposal. */ }
    }
  }
  return { ledger, links: proposalLinks };
}
