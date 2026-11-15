// OPT-IN, BILLABLE: never set SCALEME_LIVE_E2E_APPROVED without explicit human approval.
// Uses the existing browser adapter and deployed APIs, with no fixtures/mocks/fallback.
import { expect, it } from "vitest";
import { analyzeContext, nextQuestion, privateRequest } from "./client";
import { answerHistory, coachHistory, collectEvidence, prepareContext } from "./session";

it.skipIf(process.env.SCALEME_LIVE_E2E_APPROVED !== "true")(
  "actual Bedrock: fictional resume/job → analysis → question → fictional candidate response → follow-up",
  async () => {
    const rawOrigin = process.env.SCALEME_LIVE_E2E_ORIGIN ?? "";
    const origin = new URL(rawOrigin);
    expect(origin.origin === rawOrigin && (origin.protocol === "https:" ||
      (origin.protocol === "http:" && origin.hostname === "127.0.0.1"))).toBe(true);
    const token = process.env.SCALEME_PRIVATE_AI_TOKEN ?? "";
    expect(/^[A-Za-z0-9_-]{32,256}$/.test(token)).toBe(true);
    const context = prepareContext({
      resume: "FICTIONAL TEST CANDIDATE. Built a JavaScript booking form for an imaginary campus library. No testing process or performance results were recorded in this fictional resume.",
      title: "FICTIONAL JavaScript intern",
      job: "FICTIONAL JOB, not a real opening. Build JavaScript forms and test invalid submissions. No hiring outcome is implied.",
      requirements: "Build JavaScript forms\nTest invalid form submissions",
    });
    const paidPaths: string[] = [];
    const transport: typeof fetch = async (input, init) => {
      const path = String(input);
      expect(["/api/practice/access", "/api/fit/analyze", "/api/interview/next"].includes(path)).toBe(true);
      if (path !== "/api/practice/access") {
        paidPaths.push(path);
        expect(paidPaths.length <= 3).toBe(true); // No automatic retries or extra paid requests.
      }
      return fetch(new URL(path, origin), { ...init,
        headers: { ...init?.headers, Origin: origin.origin }, redirect: "error" });
    };
    const signal = () => new AbortController().signal;
    expect(await privateRequest("/api/practice/access", token, undefined, signal(), transport)).toEqual({ available: true });
    const analysis = await analyzeContext(context, token, signal(), transport);
    const question = await nextQuestion(context, analysis, [], token, signal(), transport);
    expect(question.coachMessage.split("?").length).toBe(2);
    const response = "FICTIONAL candidate response: I built the booking form and manually tried blank fields and invalid dates. I did not measure an improvement or production performance.";
    const history = answerHistory([coachHistory(question)], response);
    const followUp = await nextQuestion(context, analysis, history, token, signal(), transport);
    expect(followUp.coachMessage.split("?").length).toBe(2);
    const evidence = collectEvidence(context, analysis, [...history, coachHistory(followUp)]);
    expect(evidence.answers[0]).toMatchObject({ quote: response, review: "candidate_reported" });
    expect(paidPaths).toEqual(["/api/fit/analyze", "/api/interview/next", "/api/interview/next"]);
    // Human review still checks relevance, unknown metrics and unsupported claims.
    // Do not print headers, credentials, full responses or request bodies here.
  }, 180_000,
);
