"use client";

import Link from "next/link";
import { useState } from "react";

type Message = { id: number; role: "assistant" | "user"; content: string };
type Mode = "chat" | "resume" | "job";
type Conversation = {
  id: number;
  title: string;
  messages: Message[];
  resume: string;
  job: string;
  interviewIndex: number;
  interviewAnswers: string[];
};

const welcome = "Hi! I'm ScaleMe, your career preparation workspace. Add your resume and a target job, then I can walk you through fit insights, a mock interview, and an impact report. This is a local demo; the AWS Bedrock assistant is not connected yet.";
const sampleResume = "Built an internal employee portal with React and TypeScript, integrated REST APIs, and collaborated using Git.";
const sampleJob = "Software engineering internship: React, TypeScript, REST APIs, automated testing, and communication.";
const interviewQuestions = [
  "Tell me about a project you worked on. What problem did it solve?",
  "Which part did you personally build, and why did you make that technical choice?",
  "What was the hardest challenge or trade-off?",
  "How did you test or validate the solution?",
  "What was the outcome? It's okay if you don't have a numerical metric.",
];
const tracked = [
  ["React", "react"],
  ["TypeScript", "typescript"],
  ["REST APIs", "rest api"],
  ["Automated testing", "automated test"],
  ["Communication", "communicat"],
];

function makeConversation(id: number): Conversation {
  return {
    id,
    title: "New conversation",
    messages: [{ id: 0, role: "assistant", content: welcome }],
    resume: "",
    job: "",
    interviewIndex: -1,
    interviewAnswers: [],
  };
}

function fitSummary(resume: string, job: string) {
  const r = resume.toLowerCase();
  const j = job.toLowerCase();
  const relevant = tracked.filter(([, keyword]) => j.includes(keyword));
  const found = relevant.filter(([, keyword]) => r.includes(keyword)).map(([label]) => label);
  const missing = relevant.filter(([, keyword]) => !r.includes(keyword)).map(([label]) => label);
  return [
    "DEMO FIT INSIGHTS — keyword presence only, not a Bedrock analysis or hiring prediction.",
    "Terms mentioned in both texts: " + (found.join(", ") || "none from the demo vocabulary") + ".",
    "Terms in the job description without a resume mention: " + (missing.join(", ") || "none from the demo vocabulary") + ".",
    "Missing evidence does not prove a missing skill. Ask the applicant about specific projects, testing, outcomes, and trade-offs.",
    "For a complete evidence-backed assessment, the live Bedrock/Rust analysis endpoints still need integration.",
  ].join("\n\n");
}

function impactSummary(conversation: Conversation) {
  const answers = conversation.interviewAnswers;
  return [
    "DEMO IMPACT WORKSHEET — suggestions are templates, not AI-generated facts.",
    "Original resume content: " + conversation.resume.slice(0, 280) + (conversation.resume.length > 280 ? "…" : ""),
    "Bullet template: Built [specific feature] using [verified tools] to solve [actual problem], resulting in [outcome you can confirm].",
    "Questions to clarify: Who used it? What did you personally own? How did you validate it? What changed as a result?",
    "Interview responses recorded: " + answers.length + ".",
    ...answers.map((answer, i) => "Answer " + (i + 1) + ": " + answer),
    "Never invent metrics, credentials, or accomplishments. The Bedrock impact-coach endpoint is not connected yet.",
  ].join("\n\n");
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>(() => [makeConversation(1)]);
  const [activeId, setActiveId] = useState(1);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const active = conversations.find((conversation) => conversation.id === activeId) ?? conversations[0];

  function changeActive(id: number) {
    setActiveId(id);
    setSidebarOpen(false);
    setDraft("");
    setMode("chat");
    setNotice("");
  }

  function newConversation() {
    const id = Math.max(0, ...conversations.map((conversation) => conversation.id)) + 1;
    setConversations((prev) => [makeConversation(id), ...prev]);
    changeActive(id);
  }

  function updateActive(updater: (conversation: Conversation) => Conversation) {
    setConversations((prev) => prev.map((conversation) => conversation.id === activeId ? updater(conversation) : conversation));
  }

  function addAssistant(content: string) {
    updateActive((conversation) => ({
      ...conversation,
      messages: [...conversation.messages, { id: Date.now() + Math.random(), role: "assistant", content }],
    }));
  }

  function submit() {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    setNotice("");
    const reply = mode === "resume"
      ? "Resume text saved in this browser session. Next, add a target job description using the Job description button. PDF text extraction is not connected yet."
      : mode === "job"
        ? "Job description saved. Choose Analyze fit for a transparent demo comparison, or Mock interview to practice. Live job retrieval and AI analysis are not connected yet."
        : active.interviewIndex >= 0 && active.interviewIndex < interviewQuestions.length
          ? (active.interviewIndex + 1 < interviewQuestions.length
              ? interviewQuestions[active.interviewIndex + 1]
              : "Nice work. This scripted demo interview is complete. Select Impact report to review a factual writing framework.")
          : "Thanks for sharing. This demo doesn't use an AI model to answer free-form questions yet. You can add your resume and job, analyze their overlapping terms, or start a scripted interview. The Bedrock chat endpoint will replace this placeholder.";
    updateActive((conversation) => {
      const isInterviewAnswer = mode === "chat" && conversation.interviewIndex >= 0 && conversation.interviewIndex < interviewQuestions.length;
      return {
        ...conversation,
        title: conversation.title === "New conversation" ? content.slice(0, 34) : conversation.title,
        resume: mode === "resume" ? content : conversation.resume,
        job: mode === "job" ? content : conversation.job,
        interviewIndex: isInterviewAnswer ? conversation.interviewIndex + 1 : conversation.interviewIndex,
        interviewAnswers: isInterviewAnswer ? [...conversation.interviewAnswers, content] : conversation.interviewAnswers,
        messages: [...conversation.messages, { id: Date.now(), role: "user", content }, { id: Date.now() + 1, role: "assistant", content: reply }],
      };
    });
    setMode("chat");
  }

  function loadDemo() {
    updateActive((conversation) => ({
      ...conversation,
      title: "Demo: software internship",
      resume: sampleResume,
      job: sampleJob,
      interviewAnswers: [],
      interviewIndex: -1,
      messages: [...conversation.messages, {
        id: Date.now(), role: "assistant",
        content: "FICTIONAL DEMO DATA LOADED. Sample resume: " + sampleResume + "\n\nSample role: " + sampleJob + "\n\nChoose Analyze fit or Mock interview to continue.",
      }],
    }));
    setNotice("Fictional resume and job loaded. No live company or model data is being used.");
  }

  function analyze() {
    if (!active.resume.trim() || !active.job.trim()) {
      setNotice("Add both resume and job description text first, or choose Load demo.");
      return;
    }
    addAssistant(fitSummary(active.resume, active.job));
    setNotice("");
  }

  function interview() {
    if (!active.resume.trim() || !active.job.trim()) {
      setNotice("Add a resume and job description first, or load demo data.");
      return;
    }
    updateActive((conversation) => ({
      ...conversation,
      interviewIndex: 0,
      interviewAnswers: [],
      messages: [...conversation.messages, { id: Date.now(), role: "assistant", content: "SCRIPTED MOCK INTERVIEW (not live Bedrock)\n\n" + interviewQuestions[0] }],
    }));
    setMode("chat");
    setNotice("");
  }

  function report() {
    if (!active.resume.trim()) {
      setNotice("Add your resume text first to create an impact worksheet.");
      return;
    }
    addAssistant(impactSummary(active));
    setNotice("");
  }

  function removeConversation(id: number) {
    const remaining = conversations.filter((conversation) => conversation.id !== id);
    if (remaining.length === 0) {
      setConversations([makeConversation(1)]);
      setActiveId(1);
    } else {
      setConversations(remaining);
      if (activeId === id) setActiveId(remaining[0].id);
    }
  }

  return (
    <div className="flex h-dvh min-h-[480px] bg-white text-slate-900">
      {sidebarOpen && (
        <button type="button" aria-label="Close conversation sidebar" onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/30 md:hidden" />
      )}

      <aside className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-slate-200 bg-[#f8f9fc] transition-transform md:static md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white">S</div>
            <span className="text-xl font-extrabold tracking-tight">ScaleMe</span>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-200 md:hidden" aria-label="Close sidebar">✕</button>
        </div>
        <div className="space-y-2 px-3">
          <Link href="/"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            <span aria-hidden="true">←</span> Back to dashboard
          </Link>
          <button type="button" onClick={newConversation}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold shadow-sm hover:bg-slate-100">
            <span aria-hidden="true" className="text-lg">＋</span> New conversation
          </button>
        </div>
        <p className="px-5 pb-2 pt-7 text-xs font-semibold uppercase tracking-widest text-slate-400">Recent conversations</p>
        <nav aria-label="Conversation history" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
          {conversations.map((conversation) => (
            <div key={conversation.id} className={`group flex items-center rounded-xl ${conversation.id === activeId ? "bg-indigo-50" : "hover:bg-slate-100"}`}>
              <button type="button" onClick={() => changeActive(conversation.id)}
                aria-current={conversation.id === activeId ? "page" : undefined}
                className={`min-w-0 flex-1 truncate px-3 py-3 text-left text-sm ${conversation.id === activeId ? "font-semibold text-indigo-700" : "text-slate-700"}`}>
                {conversation.title}
              </button>
              <button type="button" onClick={() => removeConversation(conversation.id)}
                aria-label={`Delete ${conversation.title}`} title="Delete conversation from this session"
                className="rounded-lg px-2 py-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700">×</button>
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4 text-xs leading-5 text-slate-500">
          <strong className="block text-slate-700">Local demo · Bedrock pending</strong>
          Chats exist only in this tab session and disappear on refresh. Do not paste private resumes into a shared demo.
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open conversation sidebar"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden">☰</button>
            <span className="truncate text-sm font-semibold text-slate-700">{active.title}</span>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800">DEMO · NOT LIVE AI</span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6" role="log" aria-label="Conversation messages" aria-live="polite">
          <div className="mx-auto w-full max-w-3xl space-y-6">
            {active.messages.length === 1 && (
              <div className="pb-4 pt-6 text-center md:pt-12">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-black text-white">S</div>
                <h1 className="text-2xl font-bold tracking-tight md:text-4xl">How can ScaleMe help?</h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
                  One conversation for resume feedback, job fit, interview practice, and career growth.
                </p>
              </div>
            )}
            {active.messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[93%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-7 md:max-w-[85%] ${message.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-800"}`}>
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 px-3 pb-4 pt-2 md:px-8 md:pb-6">
          <div className="mx-auto max-w-3xl">
            {notice && <p role="alert" className="mb-3 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">{notice}</p>}
            <div className="mb-3 flex flex-wrap gap-2">
              <Action label="Load demo" onClick={loadDemo} />
              <Action label="Add resume text" onClick={() => setMode("resume")} />
              <Action label="Add job description" onClick={() => setMode("job")} />
              <Action label="Analyze fit" onClick={analyze} />
              <Action label="Mock interview" onClick={interview} />
              <Action label="Impact report" onClick={report} />
            </div>
            <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_3px_18px_rgba(15,23,42,0.08)] focus-within:border-indigo-300">
              {mode !== "chat" && (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-800">
                  <span>{mode === "resume" ? "Saving your next message as resume text" : "Saving your next message as a job description"}</span>
                  <button type="button" onClick={() => setMode("chat")} className="underline">Cancel</button>
                </div>
              )}
              <label htmlFor="chat-input" className="sr-only">Message ScaleMe</label>
              <textarea id="chat-input" value={draft} rows={2} onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }}
                placeholder={mode === "resume" ? "Paste your resume text…" : mode === "job" ? "Paste the full job description…" : "Message ScaleMe…"}
                className="max-h-40 min-h-14 w-full resize-y px-2 py-2 text-sm leading-6 outline-none placeholder:text-slate-400" />
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-slate-400">Enter to send · Shift + Enter for new line</span>
                <button type="submit" disabled={!draft.trim()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">Send ↑</button>
              </div>
            </form>
            <p className="pt-3 text-center text-[11px] leading-5 text-slate-400">
              Demo responses are scripted; fit uses simple keyword matches. Bedrock-powered chat and real resume parsing will be integrated separately.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Action({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
      {label}
    </button>
  );
}
