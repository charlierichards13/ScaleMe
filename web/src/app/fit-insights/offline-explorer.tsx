"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  answers,
  assessment,
  coverage,
  requirements,
  selectRequirement,
  sources,
  statusLabels,
  type Answer,
  type Phase,
  type Status,
} from "./demo";
import "./fit-insights.css";

const css = (name: string) => `fit-explorer-${name}`;

const symbols: Record<Status, string> = {
  supported: "✓",
  unclear: "?",
  not_evidenced: "−",
};
function Badge({ status }: { status: Status }) {
  return (
    <span className={`${css("badge")} ${css(status)}`}>
      <span aria-hidden="true">{symbols[status]}</span> {statusLabels[status]}
    </span>
  );
}
export default function OfflineExplorer() {
  const [phase, setPhase] = useState<Phase>("before");
  const [answer, setAnswer] = useState<Answer>("relevant");
  const [shownAnswer, setShownAnswer] = useState<Answer>();
  const [selectedId, setSelectedId] = useState("testing");
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState(
    "Before interview: 2 of 4 required requirements supported.",
  );
  const inspector = useRef<HTMLElement>(null);
  const selected = selectRequirement(selectedId);
  const result = assessment(selectedId, phase, shownAnswer);
  const count = coverage(phase, shownAnswer);
  const after = shownAnswer ? coverage("after", shownAnswer) : undefined;
  const visible = requirements.filter(
    (r) =>
      filter === "all" ||
      assessment(r.id, phase, shownAnswer).status === filter,
  );
  const changed = phase === "after" && shownAnswer === "relevant";

  function inspect(id: string) {
    setSelectedId(id);
    inspector.current?.focus({ preventScroll: true });
    inspector.current?.scrollIntoView({
      block: "nearest",
      behavior: "instant",
    });
  }
  function changePhase(next: Phase) {
    setPhase(next);
    setNotice(
      `${next === "before" ? "Before interview" : "After shown candidate answer"}: ${coverage(next, shownAnswer).supported} of 4 required requirements supported.`,
    );
  }
  function reset() {
    setPhase("before");
    setAnswer("relevant");
    setShownAnswer(undefined);
    setSelectedId("testing");
    setFilter("all");
    setNotice(
      "Demo reset. Before interview: 2 of 4 required requirements supported.",
    );
  }

  return (
    <div className={css("root")}>
      <a className={css("skip")} href="#fit-walkthrough-main">
        Skip to evidence explorer
      </a>
      <section aria-label="Offline fictional interview walkthrough" id="fit-walkthrough-main" tabIndex={-1} className={css("main")}>
        <div className={css("intro")}>
          <div>
            <p className={css("eyebrow")}>SEE THE EVIDENCE. FIND THE GAPS.</p>
            <h2>
              Offline interview walkthrough<span>.</span>
            </h2>
            <p className={css("lead")}>
              Your experience has a story.
              <br className={css("mobileBreak")} /> See what’s documented — and
              what to ask next.
            </p>
          </div>
          <button className={css("secondary")} onClick={reset}>
            Reset demo <span aria-hidden="true">↺</span>
          </button>
        </div>
        <div className={css("disclosure")}>
          <span aria-hidden="true">◇</span>
          <p>
            <strong>
              Every person, job, resume, and answer here is fictional.
            </strong>{" "}
            Hand-written samples, no uploads or saved data. Candidate-reported
            evidence is not independently verified.
          </p>
        </div>
        <section className={css("overview")} aria-labelledby="role-title">
          <div className={css("role")}>
            <p className={css("eyebrow")}>FICTIONAL TARGET ROLE</p>
            <div className={css("roleHeading")}>
              <span className={css("companyIcon")} aria-hidden="true">
                N
              </span>
              <div>
                <h2 id="role-title">Frontend Engineer Intern</h2>
                <p>Northstar Studio · Fictional company</p>
              </div>
            </div>
            <div className={css("roleMeta")}>
              <span>4 required</span>
              <span>1 preferred</span>
              <span>Resume + interview evidence</span>
            </div>
            <p className={css("roleNote")}>
              A requirement describes the role. Only candidate-source evidence
              can support a qualification.
            </p>
          </div>
          <div className={css("coverage")}>
            <p className={css("eyebrow")}>DOCUMENTED EVIDENCE COVERAGE</p>
            <p className={css("count")}>
              <strong>{count.supported}</strong>
              <span>of {count.total}</span>
            </p>
            <h2>required requirements supported</h2>
            <div className={css("segments")} aria-hidden="true">
              {requirements
                .filter((r) => r.importance === "required")
                .map((r) => (
                  <span
                    key={r.id}
                    className={css(assessment(r.id, phase, shownAnswer).status)}
                  />
                ))}
            </div>
            <div className={css("comparison")}>
              <span>
                Before <strong>2 / 4</strong>
              </span>
              <span aria-hidden="true">→</span>
              <span>
                After{" "}
                <strong>
                  {after ? `${after.supported} / 4` : "Awaiting answer"}
                </strong>
              </span>
            </div>
            <p className={css("small")}>
              Same four required IDs in both views. Preferred skills excluded.
              Evidence coverage is not hiring probability.
            </p>
          </div>
        </section>
        <div className={css("explorerHeading")}>
          <div>
            <p className={css("eyebrow")}>01 / EXPLORE THE FIT</p>
            <h2>A clear view of every requirement</h2>
          </div>
          <div
            className={css("phaseGroup")}
            role="group"
            aria-label="Evidence snapshot"
          >
            <button
              aria-pressed={phase === "before"}
              onClick={() => changePhase("before")}
            >
              Before interview
            </button>
            <button
              disabled={!shownAnswer}
              aria-pressed={phase === "after"}
              onClick={() => changePhase("after")}
            >
              After interview
            </button>
          </div>
        </div>
        {!shownAnswer && (
          <p className={css("phaseHelp")}>
            After interview unlocks when you reveal a sample answer below.
          </p>
        )}
        <div className={css("explorer")}>
          <section
            aria-label="Requirement inventory"
            className={css("inventory")}
          >
            <div className={css("filterRow")}>
              <label htmlFor="status-filter">Show requirements</label>
              <select
                id="status-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="supported">Supported</option>
                <option value="unclear">Unclear</option>
                <option value="not_evidenced">Not evidenced</option>
              </select>
            </div>
            <div className={css("cards")}>
              {visible.map((r) => {
                const state = assessment(r.id, phase, shownAnswer).status;
                return (
                  <button
                    key={r.id}
                    className={`${css("card")} ${selectedId === r.id ? css("selected") : ""}`}
                    onClick={() => inspect(r.id)}
                    aria-pressed={selectedId === r.id}
                    aria-controls="fit-inspector"
                  >
                    <span className={css("cardTop")}>
                      <span className={css("importance")}>
                        {r.importance}
                        {r.id === "testing" && changed && (
                          <span className={css("newEvidence")}>
                            {" "}
                            · New evidence
                          </span>
                        )}
                      </span>
                      <Badge status={state} />
                    </span>
                    <span className={css("cardTitle")}>
                      {r.title}
                      <span aria-hidden="true">→</span>
                    </span>
                    <span className={css("cardNote")}>
                      {state === "supported"
                        ? assessment(r.id, phase, shownAnswer).citation
                            ?.sourceId === "turn-testing"
                          ? "Interview answer 01 · Candidate-reported"
                          : "Resume excerpt · Candidate-reported"
                        : state === "unclear"
                          ? "Related context exists; a detail is missing"
                          : "No supporting candidate quote yet"}
                    </span>
                  </button>
                );
              })}
            </div>
            {visible.length === 0 && (
              <div className={css("empty")}>
                <h3>No requirements in this view</h3>
                <p>Try another status to explore the remaining evidence.</p>
                <button
                  className={css("secondary")}
                  onClick={() => setFilter("all")}
                >
                  Show all requirements
                </button>
              </div>
            )}
            <p className={css("small")}>
              “Not evidenced” means not documented here. It does not mean the
              candidate lacks the skill.
            </p>
          </section>
          <aside
            ref={inspector}
            tabIndex={-1}
            id="fit-inspector"
            aria-labelledby="inspector-title"
            className={css("inspector")}
          >
            <div className={css("inspectorHeader")}>
              <p className={css("eyebrow")}>EVIDENCE INSPECTOR</p>
              <span aria-hidden="true">⌕</span>
            </div>
            {selected ? (
              <>
                <h2 id="inspector-title">{selected.title}</h2>
                <div className={css("inspectorStatus")}>
                  <Badge status={result.status} />
                  <span>
                    {selected.importance} · {selected.id}
                  </span>
                </div>
                <div className={css("jobQuote")}>
                  <p className={css("quoteLabel")}>
                    TARGET JOB · REQUIREMENT ONLY
                  </p>
                  <blockquote>“{selected.jobQuote}”</blockquote>
                  <p>Job text is not candidate evidence.</p>
                </div>
                <h3>What the candidate actually said</h3>
                {result.citation ? (
                  <div className={css("sourceQuote")}>
                    <p className={css("quoteLabel")}>
                      {
                        sources[
                          result.citation.sourceId as keyof typeof sources
                        ].label
                      }
                    </p>
                    <blockquote>“{result.citation.quote}”</blockquote>
                    <span className={css("reported")}>
                      Candidate-reported · Not independently verified
                    </span>
                  </div>
                ) : (
                  <div className={css("noQuote")}>
                    <span aria-hidden="true">−</span>
                    <p>
                      No supporting candidate quote.
                      <br />
                      <span>
                        The source does not document this requirement.
                      </span>
                    </p>
                  </div>
                )}
                <p className={css("reason")}>
                  {selected.id === "testing" && changed
                    ? "The shown answer describes testing login, navigation, and mobile layout with coworkers before rollout. It supports this requirement; no automated testing or numerical outcome is implied."
                    : selected.why}
                </p>
                {selected.id === "testing" && changed && (
                  <div className={css("transition")}>
                    <span>Not evidenced</span>
                    <span aria-hidden="true">→</span>
                    <strong>Supported</strong>
                    <p>New documentation, not a change in actual ability.</p>
                  </div>
                )}
                <div className={css("next")}>
                  <p className={css("quoteLabel")}>
                    {result.status === "supported"
                      ? "PREPARE YOUR EXAMPLE"
                      : "CLARIFY NEXT"}
                  </p>
                  <h3>{selected.question}</h3>
                  <p>
                    {selected.id === "testing" && changed
                      ? "Keep this specific account. Ask about outcomes separately; none are documented here."
                      : selected.next}
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2 id="inspector-title">Requirement unavailable</h2>
                <p>
                  This requirement ID is not in the fictional inventory. Select
                  a listed requirement; no evidence has been counted for this
                  ID.
                </p>
              </>
            )}
          </aside>
        </div>
        <section className={css("interview")} aria-labelledby="interview-title">
          <div className={css("interviewIntro")}>
            <p className={css("eyebrow")}>02 / DISCOVER WHAT’S MISSING</p>
            <h2 id="interview-title">
              One question.
              <br />
              More documented evidence.
            </h2>
            <p>
              Try a specific, vague, or unrelated fictional answer. Only the
              manually linked testing example can support the testing
              requirement.
            </p>
            <div className={css("coach")}>
              <span className={css("quoteLabel")}>COACH · TARGET: TESTING</span>
              <p>
                How did you test the portal before colleagues started using it?
              </p>
            </div>
          </div>
          <div className={css("answerPanel")}>
            <label htmlFor="sample-answer">Choose a fictional answer</label>
            <select
              id="sample-answer"
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value as Answer);
                setShownAnswer(undefined);
                setPhase("before");
                setNotice(
                  "Sample changed. Reveal the new answer before comparing evidence.",
                );
              }}
            >
              {Object.entries(answers).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
            {!shownAnswer ? (
              <div className={css("answerPlaceholder")}>
                <span aria-hidden="true">“ ”</span>
                <h3>The answer comes first.</h3>
                <p>
                  Reveal the fictional candidate’s words before they can affect
                  coverage.
                </p>
                <button
                  className={css("primary")}
                  onClick={() => {
                    setShownAnswer(answer);
                    setNotice(
                      "Fictional answer revealed. Coverage remains in the before view until you compare.",
                    );
                  }}
                >
                  Reveal fictional answer <span aria-hidden="true">↓</span>
                </button>
              </div>
            ) : (
              <div className={css("revealed")}>
                <p className={css("quoteLabel")}>
                  FICTIONAL CANDIDATE · {answers[shownAnswer].sourceId}
                </p>
                <blockquote>
                  “{sources[answers[shownAnswer].sourceId].text}”
                </blockquote>
                <p className={css("reported")}>
                  Candidate-reported · Not independently verified
                </p>
                <p>
                  {shownAnswer === "relevant"
                    ? "This specific answer adds evidence for testing. Read it, then compare."
                    : shownAnswer === "vague"
                      ? "What worked well? Ask which checks were performed. This answer does not establish testing evidence."
                      : "Choosing colors does not describe testing. Ask about login, navigation, or mobile checks."}
                </p>
                <button
                  className={css("primary")}
                  onClick={() => {
                    changePhase("after");
                    setSelectedId("testing");
                    setFilter("all");
                  }}
                >
                  Compare after this answer <span aria-hidden="true">↑</span>
                </button>
                {phase === "after" && (
                  <p className={css("answerResult")}>
                    {shownAnswer === "relevant"
                      ? "2 → 3 of 4 required requirements supported. Only testing changed."
                      : "2 → 2 of 4 required requirements supported. No new relevant evidence."}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
        <details className={css("resume")}>
          <summary>
            Inspect the full fictional resume source <span>2 excerpts</span>
          </summary>
          {Object.entries(sources)
            .filter(([, source]) => source.kind === "resume")
            .map(([id, source]) => (
              <div key={id}>
                <p className={css("quoteLabel")}>
                  {source.label} · {id}
                </p>
                <blockquote>“{source.text}”</blockquote>
              </div>
            ))}
        </details>
        <section className={css("handoff")}>
          <div>
            <p className={css("eyebrow")}>
              03 / KEEP THE FACTS, IMPROVE THE WORDS
            </p>
            <h2>Take evidence into your next draft.</h2>
            <p>
              Explore grounded writing in Resume Lab with your own synthetic
              input or an explicitly selected fictional sample. This demo’s
              evidence and selections do not transfer.
            </p>
          </div>
          <Link className={css("secondary")} href="/resume-lab">
            Explore Resume Lab <span aria-hidden="true">→</span>
          </Link>
        </section>
        <footer className={css("footer")}>
          <strong>Evidence, not assumptions.</strong>
          <span>
            Local demo only · No API calls · No persistence · No hiring
            predictions
          </span>
        </footer>
        <p className={css("srOnly")} role="status" aria-live="polite">
          {notice}
        </p>
      </section>
    </div>
  );
}
