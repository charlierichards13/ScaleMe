import type { EvidenceReviewer } from "./types";

// Conservative English lexical policy, not a truth verifier or general semantic
// model. Unknown vocabulary and compound requirements can remain unresolved.
const stop = new Set(("a an and are as at be before by can candidate demonstrated experience experienced familiarity for from have in is it knowledge of on or our preferred proficiency required requirements role skills strong that the their this to using with you your web years year " +
  "i my we us me coworkers well very really successfully must has bonus plus nice").split(/\s+/));
const aliases: Record<string, string> = {
  testing: "test", tested: "test", tests: "test",
  built: "build", building: "build", developed: "build", development: "build",
  developing: "build", develop: "build", wrote: "build", writing: "build",
  implemented: "build", implementing: "build", implement: "build",
  applications: "application", apps: "application", app: "application", portal: "application",
  login: "application", navigation: "application", layout: "application",
  apis: "api", collaborated: "collaborate", collaboration: "collaborate",
  colleagues: "team", teams: "team", teammates: "team",
  validated: "validate", validation: "validate", validating: "validate",
  imported: "import", importing: "import", imports: "import",
  tools: "tool", errors: "error", messages: "message", fields: "field", rows: "row",
  automated: "automate", automation: "automate", automating: "automate",
  worked: "work", working: "work", explained: "explain",
  configured: "configure", configuring: "configure", services: "service",
};
export function terms(text: string): string[] {
  return [...new Set((text.toLowerCase().match(/[a-z][a-z0-9+#.-]*/g) ?? [])
    .map((word) => word.replace(/[.-]+$/, ""))
    .filter((word) => !stop.has(word))
    .map((word) => Object.hasOwn(aliases, word) ? aliases[word] : word))];
}
const instructions = /\b(ignore|instructions?|system\s*(?:prompt|message)|developer\s*message|assistant|pretend|invent|fabricat\w*|make\s+up|reveal|override|mark\s+\w+\s+supported|add\s+\d)\b|<\/?(?:script|system|assistant)\b/i;
const negative = /\b(no|not|never|without|unable|cannot|can't|didn't|don't|haven't|hasn't|wasn't|weren't|couldn't|hadn't)\b/i;
const hypothetical = /\b(would|could|might|wish|hope|plan|planning|want|learning|learn|if|maybe|someday)\b/i;
const action = /\b(built|developed|wrote|implemented|tested|validated|added|designed|fixed|configured|managed|led|collaborated|worked|analyzed|analysed|deployed|created|maintained|automated|measured|reduced|improved|delivered)\b/i;

export const conservativeReviewer: EvidenceReviewer = (requirement, source, evidence) => {
  const fullText = source.text;
  const quote = evidence.quote;
  if (instructions.test(fullText)) return "unresolved";
  const anchors = terms(requirement.description);
  const available = terms(quote);
  if (!anchors.length || !anchors.every((word) => available.includes(word))) return "unresolved";
  // A negative, relevant answer conflicts with a positive support assertion.
  if (negative.test(quote)) return "contradicts";
  if (hypothetical.test(quote) || !action.test(quote)) return "unresolved";
  // Naming a skill or repeating the job is insufficient. Require concrete
  // candidate activity beyond the requirement vocabulary.
  if (quote.trim().split(/\s+/).length < 5 ||
      available.filter((word) => !anchors.includes(word)).length < 2) return "unresolved";
  return "supports";
};
