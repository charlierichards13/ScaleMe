import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { FitRequest } from "@/lib/ai/schemas";
import type { InterviewTurn } from "@/lib/ai/interview-schemas";
import { resetSharedFitLimiter } from "@/lib/ai/rate-limit";
import { proxy } from "@/proxy";
import { POST as fitPost } from "@/app/api/fit/analyze/route";
import { POST as interviewPost } from "@/app/api/interview/next/route";
import { POST as accessPost } from "@/app/api/practice/access/route";
import { analyzeContext, nextQuestion, privateRequest } from "./client";
import { answerHistory, coachHistory, collectEvidence, prepareContext } from "./session";
import { interviewImpact, resumeExperiences } from "./impact";
import { impactProfiles, profiles } from "./fixtures.test-data";

const send = vi.fn();
vi.mock("@aws-sdk/client-bedrock-runtime", () => ({
  BedrockRuntimeClient: class { send = send; },
  ConverseCommand: class { constructor(public input: unknown) {} },
}));
const TOKEN = "fictional_private_code_for_tests_only_12345";
const signal = () => new AbortController().signal;
const reply = (output: unknown) => ({ output: { message: { content: [{ text: JSON.stringify(output) }] } } });
const seen: Array<{ path: string; body: unknown }> = [];
const dispatcher: typeof fetch = async (input, init) => {
  const url = `http://localhost${input}`;
  const guarded = proxy(new NextRequest(url, { ...init, signal: init?.signal ?? undefined }));
  if (guarded.headers.get("x-middleware-next") !== "1") return guarded;
  const path = new URL(url).pathname;
  seen.push({ path, body: init?.body ? JSON.parse(init.body as string) : null });
  return (path === "/api/fit/analyze" ? fitPost : path === "/api/interview/next" ? interviewPost : accessPost)(new Request(url, init));
};
let logs: string[];
beforeEach(() => {
  send.mockReset(); resetSharedFitLimiter(); seen.length = 0; logs = [];
  for (const level of ["error", "warn", "info", "log"] as const) vi.spyOn(console, level).mockImplementation((...args) => { logs.push(args.join(" ")); });
  vi.stubEnv("FIT_LIVE_AI_ENABLED", "true"); vi.stubEnv("SCALEME_PRIVATE_AI_TOKEN", TOKEN);
  vi.stubEnv("AWS_REGION", "synthetic-region"); vi.stubEnv("BEDROCK_MODEL_ID", "synthetic-model");
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function modelAnalysis(context: FitRequest) {
  return { summary: "Fictional profile analysis for a mocked AWS test.",
    assessments: context.job.requirements!.map((r, i) => ({ requirementId: r.id,
      status: i === 0 ? "supported" : i === 1 ? "not_evidenced" : "unclear",
      explanation: "Review the supplied text and clarify missing details.",
      evidence: i === 0 ? [{ source: "resume", quote: context.resume.text }] : [] })),
    strengths: [], clarificationQuestions: [], growthSuggestions: [], disclaimer: "unused" };
}

describe("browser adapter → private gate → actual routes → mocked AWS SDK", () => {
  it.each(profiles)("completes five answer-aware turns for $name and collects exact unverified evidence", async profile => {
    const context = prepareContext(profile.draft);
    expect(await privateRequest("/api/practice/access", TOKEN, undefined, signal(), dispatcher)).toEqual({ available: true });
    expect(send).not.toHaveBeenCalled();
    send.mockResolvedValueOnce(reply(modelAnalysis(context)));
    const analysis = await analyzeContext(context, TOKEN, signal(), dispatcher);
    let history: InterviewTurn[] = [];
    for (let step = 0; step <= profile.answers.length; step++) {
      const question = step === 0 ? `Your resume describes ${context.resume.text} What did you personally do related to this requirement?`
        : step === profile.answers.length ? `You said: ${profile.answers[step - 1]} The interview is complete. Use only details that are true for you.`
        : `You said: ${profile.answers[step - 1]} What specific detail would you add about your contribution?`;
      send.mockResolvedValueOnce(reply({ coachMessage: question, targetRequirementId: "malicious-model-target", canFinish: true }));
      const turn = await nextQuestion(context, analysis, history, TOKEN, signal(), dispatcher);
      expect(turn.coachMessage).toBe(question);
      expect(turn.targetRequirementId).toBe(["req-2", "req-2", "req-3", "req-3", undefined, undefined][step]);
      expect(turn.canFinish).toBe(step >= 4);
      const prompt = send.mock.calls.at(-1)![0].input.messages[0].content[0].text as string;
      expect(prompt).toContain(context.resume.text); expect(prompt).toContain(context.job.text);
      if (step) expect(prompt).toContain(profile.answers[step - 1]);
      for (const other of profiles.filter(p => p.name !== profile.name)) expect(prompt).not.toContain(other.draft.resume);
      history = [...history, coachHistory(turn)];
      if (step < profile.answers.length) history = answerHistory(history, profile.answers[step]);
    }
    expect(send).toHaveBeenCalledTimes(7);
    const handoff = collectEvidence(context, analysis, history);
    expect(handoff.answers.map(a => a.quote)).toEqual(profile.answers);
    expect(handoff.answers.every(a => a.review === "candidate_reported")).toBe(true);
    expect(handoff.reassessment).toBe("pending");
    expect(handoff.initialAnalysis.assessments[1].status).toBe("not_evidenced");
    expect(handoff.answers[0].targetRequirementId).toBe("req-2");
    expect(handoff.answers[4].targetRequirementId).toBeUndefined();
    const lastBody = seen.at(-1)!.body as { history: InterviewTurn[]; fit: unknown };
    expect(lastBody.history).toHaveLength(10);
    expect(lastBody.fit).toEqual({ assessments: analysis.assessments.map(({ requirementId, status }) => ({ requirementId, status })) });
    expect(lastBody.history.filter(t => t.role === "candidate").every(t => t.targetRequirementId === undefined)).toBe(true);
    expect(logs.join(" ")).not.toContain(context.resume.text);
    expect(logs.join(" ")).not.toContain(TOKEN);
    for (const a of profile.answers) expect(logs.join(" ")).not.toContain(a);
  });

  it.each(impactProfiles)("reassesses $name from routes with mocked Bedrock and exact sources", async profile => {
    const context = prepareContext(profile.draft);
    send.mockResolvedValueOnce(reply(modelAnalysis(context)));
    const analysis = await analyzeContext(context, TOKEN, signal(), dispatcher);
    const answers = ["I helped and it went well.", profile.answer, "I organized a picnic for friends.",
      "I do not know whether reports improved; no metrics were measured.",
      `I did not ${context.job.requirements![1].description.toLowerCase()} before rollout.`];
    let history: InterviewTurn[] = [];
    let gained: ReturnType<typeof interviewImpact> | undefined;
    for (let step = 0; step < answers.length; step++) {
      send.mockResolvedValueOnce(reply({ coachMessage: step ? `You said: ${answers[step - 1]} What specific contribution can you document?` : "What did you personally test or validate?" }));
      const turn = await nextQuestion(context, analysis, history, TOKEN, signal(), dispatcher);
      history = answerHistory([...history, coachHistory(turn)], answers[step]);
      const handoff = collectEvidence(context, analysis, history);
      const subjectId = resumeExperiences(handoff)[0].subjectId;
      const links = Object.fromEntries(handoff.answers.map(a => [a.id, { subjectId, requirementId: a.targetRequirementId ?? "req-2" }]));
      const result = interviewImpact(handoff, links);
      expect(result.ledger.view().coverage.before.supported).toBe(1);
      expect(result.ledger.view().coverage.before.total).toBe(3);
      expect(result.ledger.view().coverage.after.supported).toBe(step === 0 || step === 4 ? 1 : 2);
      expect(result.ledger.view().requirements).toEqual(context.job.requirements);
      if (step === 1) gained = result;
      if (step === 4) expect(result.ledger.view().after[1].status).toBe("unclear");
    }
    expect(gained!.links).toHaveLength(1);
    const link = gained!.links[0];
    let ledger = gained!.ledger;
    expect(ledger.copyableImpact(link.originalId, link.answerId)).toBeNull();
    const evidence = ledger.view().evidence.find(e => e.id === link.answerId)!;
    expect(evidence.sourceId).toBe("interview-answer-3");
    expect(evidence.quote).toBe(profile.answer);
    expect(evidence.start).toBe(0); expect(evidence.end).toBe(profile.answer.length);
    expect(ledger.isGroundedWording(link.originalId, link.answerId, "Improved performance by 40%.")).toBe(false);
    ledger = ledger.reviewEvidence(link.originalId, true).reviewEvidence(link.answerId, true);
    expect(ledger.copyableImpact(link.originalId, link.answerId)).toBe(`${context.resume.text} ${profile.answer}`);
    expect(analysis.assessments[1].status).toBe("not_evidenced");
    expect(logs.join(" ")).not.toContain(profile.answer);
  });

  it("retains the same submitted history on manual retry after AWS failure", async () => {
    const context = prepareContext(profiles[0].draft);
    send.mockResolvedValueOnce(reply(modelAnalysis(context)));
    const analysis = await analyzeContext(context, TOKEN, signal(), dispatcher);
    send.mockResolvedValueOnce(reply({ coachMessage: "What did you test?" }));
    const turn = await nextQuestion(context, analysis, [], TOKEN, signal(), dispatcher);
    const history = answerHistory([coachHistory(turn)], "I tested an invalid identifier. Results were not measured.");
    send.mockRejectedValueOnce(Object.assign(new Error("RAW_SECRET_AND_ANSWER"), { name: "ThrottlingException" }));
    await expect(nextQuestion(context, analysis, history, TOKEN, signal(), dispatcher)).rejects.toMatchObject({ code: "AI_UNAVAILABLE", retryable: true });
    const failed = seen.at(-1)!.body;
    send.mockResolvedValueOnce(reply({ coachMessage: "You tested an invalid identifier. What did you observe without estimating results?" }));
    await nextQuestion(context, analysis, history, TOKEN, signal(), dispatcher);
    expect(seen.at(-1)!.body).toEqual(failed);
    expect(history).toHaveLength(2);
    expect(logs.join(" ")).not.toContain("RAW_SECRET_AND_ANSWER");
  });

  it("refuses anonymous paid requests even with the live switch enabled", async () => {
    for (const path of ["/api/fit/analyze", "/api/interview/next"]) {
      const response = await dispatcher(path, { method: "POST", body: JSON.stringify(prepareContext(profiles[0].draft)) });
      expect(response.status).toBe(401);
    }
    expect(send).not.toHaveBeenCalled();
  });
  it("keeps both fictional backend demos free and labeled while live is off", async () => {
    vi.stubEnv("FIT_LIVE_AI_ENABLED", "false"); vi.stubEnv("SCALEME_PRIVATE_AI_TOKEN", "");
    for (const path of ["/api/fit/analyze?demo=true", "/api/interview/next?demo=true&step=0"]) {
      const response = await dispatcher(path, { method: "POST" });
      expect(response.status).toBe(200); expect(response.headers.get("X-ScaleMe-Mode")).toBe("demo");
    }
    expect(send).not.toHaveBeenCalled();
  });
});
