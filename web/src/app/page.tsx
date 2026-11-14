"use client";

import { useMemo, useState } from "react";

type Stage = "resume" | "job" | "fit" | "interview" | "report";
type Turn = { role: "coach" | "candidate"; content: string };
type Requirement = { label: string; terms: string[] };

const stages: { id: Stage; title: string; detail: string }[] = [
  { id: "resume", title: "Your resume", detail: "Your experience" },
  { id: "job", title: "Target role", detail: "What you're aiming for" },
  { id: "fit", title: "Fit insights", detail: "Evidence, not guesses" },
  { id: "interview", title: "Mock interview", detail: "Practice the details" },
  { id: "report", title: "Impact report", detail: "Your next steps" },
];

const exampleResume =
  "Jordan Lee — Software Engineering Student\n" +
  "Projects: Built an internal employee portal using React and TypeScript. " +
  "Connected the frontend to REST APIs and worked with a teammate on bug fixes. " +
  "Used Git for version control.\n" +
  "Skills: React, TypeScript, JavaScript, Git, REST APIs.";
const exampleJob =
  "Software Engineering Intern — Example Company\n" +
  "We're looking for experience with React, TypeScript, REST APIs, automated testing, " +
  "and communicating technical decisions. This is a fictional sample role for a demo.";
const requirements: Requirement[] = [
  { label: "React", terms: ["react"] },
  { label: "TypeScript", terms: ["typescript"] },
  { label: "REST APIs", terms: ["rest api", "restful api"] },
  { label: "Automated testing", terms: ["automated test", "unit test", "integration test"] },
  { label: "Technical communication", terms: ["communicat", "present", "explain"] },
];
const coachQuestions = [
  "Tell me about a project from your resume. What problem were you trying to solve?",
  "What part did you personally build, and which technical decision mattered most?",
  "What was difficult, and what trade-off did you make to move forward?",
  "How did you validate that your solution worked? What would you improve?",
  "What impact did the project have? It's fine to say a metric isn't known.",
];

function assess(resume: string, job: string) {
  const normalizedResume = resume.toLowerCase();
  const normalizedJob = job.toLowerCase();
  const relevant = requirements.filter((requirement) =>
    requirement.terms.some((term) => normalizedJob.includes(term))
  );
  return relevant.map((requirement) => {
    const evidence = requirement.terms.find((term) => normalizedResume.includes(term));
    return {
      label: requirement.label,
      status: evidence ? "supported" : "not_evidenced",
      explanation: evidence
        ? "This term appears in your supplied resume text. Confirm depth of experience in the interview."
        : "This requirement appears in the job description but isn't evidenced in your supplied resume.",
    };
  });
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("resume");
  const [resume, setResume] = useState("");
  const [job, setJob] = useState("");
  const [filename, setFilename] = useState("");
  const [sampleUsed, setSampleUsed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [history, setHistory] = useState<Turn[]>([]);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  const currentIndex = stages.findIndex((item) => item.id === stage);
  const assessment = useMemo(() => assess(resume, job), [resume, job]);
  const supported = assessment.filter((item) => item.status === "supported");
  const missing = assessment.filter((item) => item.status === "not_evidenced");
  const answerCount = history.filter((turn) => turn.role === "candidate").length;
  const notes = history.filter((turn) => turn.role === "candidate").map((turn) => turn.content);

  function useSample() {
    setResume(exampleResume);
    setJob(exampleJob);
    setFilename("synthetic-demo-resume.pdf");
    setSampleUsed(true);
    setMessage("Synthetic example loaded. All analysis is local demo guidance, not live AI.");
    setHistory([]);
  }

  function next(target: Stage) {
    setMessage("");
    setStage(target);
  }

  function submitAnswer() {
    if (!answer.trim()) return;
    const updated: Turn[] = [
      ...history,
      ...(history.length === 0 ? [{ role: "coach" as const, content: coachQuestions[0] }] : []),
      { role: "candidate", content: answer.trim() },
    ];
    const nextNumber = updated.filter((turn) => turn.role === "candidate").length;
    if (nextNumber < coachQuestions.length) {
      updated.push({ role: "coach", content: coachQuestions[nextNumber] });
    }
    setHistory(updated);
    setAnswer("");
  }

  const report = [
    "Original evidence: " + (resume.split("\n").find((line) => /built|created|developed/i.test(line)) || "Review your project description."),
    "Stronger bullet framework: Built [specific feature] using [verified technologies] to solve [actual problem]; explain your contribution and observed outcome.",
    "Add only metrics you can verify. If the result isn't measured, describe a truthful qualitative outcome instead.",
  ];

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(
        ["ScaleMe — Demo Impact Report", ...report, "", "Interview notes:", ...notes].join("\n")
      );
      setCopied(true);
      setMessage("Report copied.");
    } catch {
      setMessage("Clipboard permission unavailable. Select and copy the text manually.");
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-extrabold text-white">S</div>
            <div>
              <div className="text-xl font-extrabold tracking-tight">ScaleMe<span className="text-indigo-600">.</span></div>
              <div className="text-xs text-slate-500">Career growth, grounded in your work</div>
            </div>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
            SYNTHETIC DEMO
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-7 px-5 py-8 md:px-8 lg:grid-cols-[245px_1fr] lg:py-12">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="px-3 pb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Your journey</p>
          <nav aria-label="Workflow steps" className="space-y-1">
            {stages.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (index <= currentIndex || (resume.trim() && job.trim())) next(item.id);
                }}
                disabled={index > currentIndex && (!resume.trim() || !job.trim())}
                aria-current={stage === item.id ? "step" : undefined}
                className={"flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 " +
                  (stage === item.id ? "bg-indigo-50 text-indigo-800" : "hover:bg-slate-50")}
              >
                <span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold " +
                  (stage === item.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500")}>{index + 1}</span>
                <span>
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="block text-xs text-slate-500">{item.detail}</span>
                </span>
              </button>
            ))}
          </nav>
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
            <strong className="block pb-1 text-slate-800">Demo limitations</strong>
            This prototype uses local, deterministic sample insights. PDF extraction, AWS analysis, and live job discovery require separate backend integrations.
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-7">
            <p className="mb-2 text-sm font-semibold text-indigo-600">YOUR NEXT OPPORTUNITY STARTS HERE</p>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
              Turn experience into <span className="text-indigo-600">impact.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Discover what your resume proves, practice telling your story, and improve without inventing accomplishments.
            </p>
          </div>

          {message && <p role="status" className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-800">{message}</p>}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Step {currentIndex + 1} of 5</p>
                <h2 className="mt-1 text-2xl font-bold">{stages[currentIndex].title}</h2>
              </div>
              <div className="text-xs font-medium text-slate-500">{Math.round((currentIndex + 1) / 5 * 100)}% through demo</div>
            </div>

            {stage === "resume" && (
              <div className="space-y-5">
                <p className="text-sm text-slate-600">Paste resume text to explore this prototype, or start with a completely fictional sample.</p>
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
                  <label className="block text-sm font-semibold" htmlFor="resume-upload">Choose a PDF resume</label>
                  <input id="resume-upload" type="file" accept=".pdf,application/pdf" className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-100 file:px-4 file:py-2 file:font-semibold file:text-indigo-700" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
                      setMessage("Please choose a PDF file.");
                      return;
                    }
                    setFilename(file.name);
                    setMessage("PDF selected, but parsing is not wired up yet. Please paste resume text below or load the synthetic demo.");
                  }} />
                  {filename && <p className="mt-2 text-xs text-slate-500">Selected: {filename}</p>}
                </div>
                <label className="block text-sm font-semibold" htmlFor="resume-text">Resume text</label>
                <textarea id="resume-text" value={resume} onChange={(event) => { setResume(event.target.value); setSampleUsed(false); }} rows={8} placeholder="Paste your experience, projects, education, and skills here..." className="w-full rounded-xl border border-slate-300 p-4 text-sm leading-6 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={useSample} className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-100">Load synthetic sample</button>
                  <button type="button" disabled={!resume.trim()} onClick={() => next("job")} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">Continue to target role →</button>
                </div>
              </div>
            )}

            {stage === "job" && (
              <div className="space-y-5">
                <p className="text-sm text-slate-600">Paste the position description. Job URL fetching is not available in this UI yet.</p>
                <label className="block text-sm font-semibold" htmlFor="job-text">Job description</label>
                <textarea id="job-text" value={job} onChange={(event) => { setJob(event.target.value); setSampleUsed(false); }} rows={11} placeholder="Paste the role title, requirements, responsibilities, and preferred skills..." className="w-full rounded-xl border border-slate-300 p-4 text-sm leading-6 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => next("resume")} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold hover:bg-slate-50">← Back</button>
                  <button type="button" disabled={!job.trim()} onClick={() => next("fit")} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40">View fit insights →</button>
                </div>
              </div>
            )}

            {stage === "fit" && (
              <div className="space-y-6">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Demo-only matching:</strong> These are literal term matches, not validated skills or an AI-generated hiring score. A missing mention does not mean you lack the skill.</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric name="Mentioned in resume" value={String(supported.length)} color="text-emerald-700" />
                  <Metric name="Not evidenced" value={String(missing.length)} color="text-amber-700" />
                  <Metric name="Match confidence" value="Unverified" color="text-slate-700" />
                </div>
                <div className="space-y-3">
                  {assessment.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No tracked example requirements were found in this job description. The live analysis backend will support additional requirements.</p>}
                  {assessment.map((item) => (
                    <div key={item.label} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-bold">{item.label}</h3>
                        <span className={"rounded-full px-3 py-1 text-xs font-bold " + (item.status === "supported" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>{item.status === "supported" ? "Term found" : "Not evidenced"}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{item.explanation}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => next("job")} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold hover:bg-slate-50">← Back</button>
                  <button onClick={() => { if (!history.length) setHistory([{ role: "coach", content: coachQuestions[0] }]); next("interview"); }} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700">Start mock interview →</button>
                </div>
              </div>
            )}

            {stage === "interview" && (
              <div className="space-y-5">
                <p className="text-sm text-slate-600">Practice five questions about your experience. The coach questions are scripted in this demo, not generated by a model.</p>
                <div className="max-h-[460px] space-y-4 overflow-y-auto rounded-xl bg-slate-50 p-4" aria-live="polite">
                  {history.map((turn, index) => (
                    <div key={index} className={"flex " + (turn.role === "candidate" ? "justify-end" : "justify-start")}>
                      <div className={"max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[78%] " + (turn.role === "candidate" ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-800")}>
                        <p className={"mb-1 text-xs font-bold " + (turn.role === "candidate" ? "text-indigo-100" : "text-indigo-600")}>{turn.role === "candidate" ? "You" : "Demo coach"}</p>
                        {turn.content}
                      </div>
                    </div>
                  ))}
                </div>
                {answerCount < coachQuestions.length ? (
                  <div>
                    <label htmlFor="interview-answer" className="mb-2 block text-sm font-semibold">Your answer ({answerCount}/5 answered)</label>
                    <textarea id="interview-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} rows={3} placeholder="Describe what you actually did..." className="w-full rounded-xl border border-slate-300 p-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                    <button onClick={submitAnswer} disabled={!answer.trim()} className="mt-3 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40">Submit answer →</button>
                  </div>
                ) : <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Interview complete. Review your notes and next steps.</p>}
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => next("fit")} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold hover:bg-slate-50">← Back</button>
                  <button onClick={() => next("report")} disabled={answerCount === 0} className="rounded-xl border border-indigo-200 px-5 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-40">Finish & view report →</button>
                </div>
              </div>
            )}

            {stage === "report" && (
              <div className="space-y-6">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This is a demo report framework, not an AI rewrite. No achievements or metrics were invented.</div>
                <div>
                  <h3 className="mb-3 text-lg font-bold">From responsibilities to impact</h3>
                  <div className="space-y-3">{report.map((item, index) => <p key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6">{item}</p>)}</div>
                </div>
                <div>
                  <h3 className="mb-3 text-lg font-bold">Interview evidence you supplied</h3>
                  <ul className="space-y-2">{notes.map((note, index) => <li key={index} className="rounded-xl border border-slate-200 p-3 text-sm">{index + 1}. {note}</li>)}</ul>
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-bold">Recommended next steps</h3>
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                    <li>Verify the specific outcome of your project before claiming impact.</li>
                    <li>Add concrete examples for requirements that aren't evidenced in your resume.</li>
                    <li>Practice explaining a decision and its trade-offs in two minutes.</li>
                    <li>Review your final bullets yourself before using them in applications.</li>
                  </ul>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => next("interview")} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold hover:bg-slate-50">← Back</button>
                  <button onClick={copyReport} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700">{copied ? "Copy again" : "Copy report"}</button>
                  <button onClick={() => { setHistory([]); setAnswer(""); setCopied(false); next("resume"); }} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold hover:bg-slate-50">Start over</button>
                </div>
              </div>
            )}
          </section>

          <p className="mt-5 text-center text-xs text-slate-500">
            ScaleMe is a coaching tool, not a predictor of hiring outcomes. Never enter private applicant information in a shared demo.
            {sampleUsed ? " Synthetic sample active." : ""}
          </p>
        </main>
      </div>
    </div>
  );
}

function Metric({ name, value, color }: { name: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">{name}</p>
      <p className={"mt-2 text-2xl font-bold " + color}>{value}</p>
    </div>
  );
}
