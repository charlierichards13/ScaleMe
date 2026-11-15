"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, CircleAlert, FileText, Fingerprint, LockKeyhole, Mail, MessageSquare, Sparkles, TrendingUp } from "lucide-react";
import "./auth-preview.css";

export type PreviewMode = "sign-in" | "sign-up";

export default function AuthPreview({ mode }: { mode: PreviewMode }) {
  const [showErrors, setShowErrors] = useState(false);
  const creating = mode === "sign-up";

  return (
    <div className={"scaleme-auth-shell"}>
      <a className={"scaleme-auth-skip"} href="#account-preview">Skip to account preview</a>
      <header className={"scaleme-auth-header"}>
        <Link prefetch={false} href="/" className={"scaleme-auth-brand"} aria-label="ScaleMe home">
          <span className={"scaleme-auth-logo"}><TrendingUp size={23} aria-hidden="true" /></span>
          Scale<span>Me</span>
        </Link>
        <span className={"scaleme-auth-headerNote"}>YOUR EXPERIENCE. YOUR NEXT CHAPTER.</span>
        <Link prefetch={false} className={"scaleme-auth-headerLink"} href="/fit-insights">Explore Demo <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </header>

      <main className={"scaleme-auth-main"}>
        <section className={"scaleme-auth-story"} aria-labelledby="story-title">
          <div className={"scaleme-auth-eyebrow"}><span /> BUILT AROUND YOUR REAL EXPERIENCE</div>
          <h1 id="story-title">Your next chapter.<br /><span>Backed by you.</span></h1>
          <p className={"scaleme-auth-intro"}>Connect the dots between what you’ve done and where you want to go. Let your experience tell a stronger story.</p>

          <div className={"scaleme-auth-evidenceCard"}>
            <div className={"scaleme-auth-cardTop"}><span><Sparkles size={16} aria-hidden="true" /> THE EVIDENCE-FIRST APPROACH</span><span className={"scaleme-auth-demoBadge"}>FICTIONAL DEMO</span></div>
            <div className={"scaleme-auth-sampleRole"}><span className={"scaleme-auth-documentIcon"}><FileText size={22} aria-hidden="true" /></span><div><strong>More than a line on a resume</strong><p>Discover the experience behind it.</p></div></div>
            <blockquote>“Built an internal employee portal.”</blockquote>
            <div className={"scaleme-auth-connection"}><span /><MessageSquare size={15} aria-hidden="true" /> A focused question reveals more<span /></div>
            <div className={"scaleme-auth-insight"}><span className={"scaleme-auth-check"}><Check size={16} aria-hidden="true" /></span><p>Testing, collaboration, and mobile usability.<br /><strong>Real details. A clearer story.</strong></p></div>
            <div className={"scaleme-auth-cardBottom"}>Grounded in candidate-reported experience <Fingerprint size={18} aria-hidden="true" /></div>
          </div>

          <ol className={"scaleme-auth-steps"}>
            <li><span>01</span><div><strong>Understand your fit</strong><p>See what a role asks for.</p></div></li>
            <li><span>02</span><div><strong>Uncover your evidence</strong><p>Reflect with focused questions.</p></div></li>
            <li><span>03</span><div><strong>Tell a truthful story</strong><p>Build on facts, never fiction.</p></div></li>
          </ol>
          <p className={"scaleme-auth-storyFoot"}>A thoughtful next step starts with what you already bring.</p>
        </section>

        <section id="account-preview" className={"scaleme-auth-account"} aria-labelledby="account-title" tabIndex={-1}>
          <div className={"scaleme-auth-accountHeading"}><span className={"scaleme-auth-previewBadge"}>ACCOUNT UI PREVIEW</span><span className={"scaleme-auth-stepLabel"}>{creating ? "A NEW CHAPTER" : "WELCOME BACK"}</span></div>
          <h2 id="account-title">{creating ? "Create your account" : "Sign in to ScaleMe"}</h2>
          <p className={"scaleme-auth-subtitle"}>{creating ? "Make room for your next career move." : "Your experience is only the beginning."}</p>

          <div className={"scaleme-auth-notice"} id="preview-notice">
            <CircleAlert size={19} aria-hidden="true" />
            <div><strong>Accounts/sign-in are not enabled in this prototype. Do not enter real passwords.</strong><p>This is a UI-only preview. Fields are disabled and cannot accept or submit your details.</p></div>
          </div>

          <div className={"scaleme-auth-fields"} role="group" aria-label={creating ? "Create account form preview" : "Sign in form preview"} aria-describedby="preview-notice">
            {creating && <div className={"scaleme-auth-field"}><label htmlFor="preview-name">Full name <span>Preview only</span></label><input id="preview-name" type="text" placeholder="Your name" disabled autoComplete="off" aria-describedby="name-help" /><small id="name-help">Use your preferred name in a future account.</small></div>}
            <div className={"scaleme-auth-field"}>
              <label htmlFor="preview-email">Email address <span>Preview only</span></label>
              <div className={"scaleme-auth-inputWrap"}><Mail size={18} aria-hidden="true" /><input id="preview-email" type="email" placeholder="you@example.com" disabled autoComplete="off" aria-invalid={showErrors ? true : undefined} aria-describedby="email-help" /></div>
              <small id="email-help" className={showErrors ? "scaleme-auth-error" : undefined}>{showErrors ? "Example error: Enter an email address in the format name@example.com." : "Email entry is unavailable in this preview."}</small>
            </div>
            <div className={"scaleme-auth-field"}>
              <label htmlFor="preview-password">Password <span>Preview only</span></label>
              <div className={"scaleme-auth-inputWrap"}><LockKeyhole size={18} aria-hidden="true" /><input id="preview-password" type="password" placeholder="Do not enter a real password" disabled autoComplete="off" aria-invalid={showErrors ? true : undefined} aria-describedby="password-help" /></div>
              <small id="password-help" className={showErrors ? "scaleme-auth-error" : undefined}>{showErrors ? "Example error: Password entry is unavailable. No credentials were checked." : "Password entry is disabled. Nothing can be submitted."}</small>
            </div>
            {!creating && <div className={"scaleme-auth-reset"}><button type="button" disabled>Forgot password?</button><span>Not available</span></div>}
            <button className={"scaleme-auth-submit"} type="button" disabled>{creating ? "Create account" : "Sign in"} <LockKeyhole size={16} aria-hidden="true" /><span>Not available</span></button>
          </div>

          <div className={"scaleme-auth-validation"}>
            <button type="button" aria-pressed={showErrors} aria-controls="validation-status email-help password-help" onClick={() => setShowErrors(!showErrors)}>{showErrors ? "Hide example errors" : "Preview validation states"}</button>
            <p id="validation-status" role="status">{showErrors ? "Showing illustrative errors only. No sign-in attempt or account creation occurred." : "Inspect example errors without entering any details."}</p>
          </div>

          <div className={"scaleme-auth-divider"}><span />FUTURE SIGN-IN OPTIONS<span /></div>
          <button className={"scaleme-auth-provider"} type="button" disabled><Fingerprint size={19} aria-hidden="true" /> Identity provider sign-in <span>Not available</span></button>
          <p className={"scaleme-auth-switch"}>{creating ? "Already have an account?" : "New to ScaleMe?"} <Link prefetch={false} href={creating ? "/sign-in" : "/sign-up"}>{creating ? "Sign in preview" : "Create account preview"} <ArrowRight size={14} aria-hidden="true" /></Link></p>

          <div className={"scaleme-auth-demoCallout"}><div><strong>Curious? Start with the story.</strong><p>No account needed. Fictional data only.</p></div><Link prefetch={false} href="/fit-insights">Explore Demo <ArrowRight size={17} aria-hidden="true" /></Link></div>
        </section>
      </main>

      <footer className={"scaleme-auth-footer"}><span>© ScaleMe · Career growth, grounded in experience.</span><span>UI-only prototype · No user accounts, login, or privacy guarantees exist yet.</span></footer>
    </div>
  );
}
