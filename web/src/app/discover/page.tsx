"use client";

import { useReducer, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { DEMO_OPENINGS, type DemoOpening } from "@/lib/jobs/demo-openings";
import { createSwipeState, swipeReducer, type Decision } from "@/lib/jobs/swipe-state";
import styles from "./discover.module.css";

const openingIds = DEMO_OPENINGS.map((job) => job.id);
const byId = new Map(DEMO_OPENINGS.map((job) => [job.id, job]));
const SWIPE_THRESHOLD = 88;

function OpeningCard({
  job,
  detailsOpen,
  onToggleDetails,
}: {
  job: DemoOpening;
  detailsOpen: boolean;
  onToggleDetails: () => void;
}) {
  return (
    <>
      <div className={styles.cardTopline}>
        <span className={styles.focusPill}>{job.focus}</span>
        <span className={styles.cardMark}>DEMO</span>
      </div>
      <div className={styles.cardIdentity}>
        <div className={styles.companyIcon} aria-hidden="true">{job.company.slice(-1)}</div>
        <p className={styles.companyName}>{job.company}</p>
        <h2 className={styles.role}>{job.title}</h2>
        <p className={styles.location}>{job.location} · {job.arrangement} · {job.type}</p>
      </div>
      <div className={styles.skillGroup} aria-label="Role requirements illustrated">
        {job.skills.map((skill) => <span className={styles.skill} key={skill}>{skill}</span>)}
      </div>
      <div className={styles.reason}>
        <span className={styles.reasonTitle}>Why this card?</span>
        <p>{job.whyShown}</p>
      </div>
      <button data-no-drag type="button" className={styles.detailsButton} aria-expanded={detailsOpen} onClick={onToggleDetails}>
        {detailsOpen ? "Hide details" : "View role details"}
        <span aria-hidden="true">{detailsOpen ? "−" : "+"}</span>
      </button>
      {detailsOpen && (
        <div className={styles.details}>
          <p>{job.description}</p>
          <p><strong>Source:</strong> Fictional, locally generated UI fixture. There is no live listing or application link.</p>
          <p><strong>Fit:</strong> Not calculated. No resume evidence was provided or sent to AWS.</p>
        </div>
      )}
    </>
  );
}

export default function DiscoverPage() {
  const [deck, dispatch] = useReducer(swipeReducer, openingIds, createSwipeState);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [showSaved, setShowSaved] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const activeId = deck.remaining[0];
  const activeJob = byId.get(activeId);
  const nextJob = byId.get(deck.remaining[1]);

  function choose(decision: Decision) {
    if (!activeJob) return;
    dispatch({ type: "choose", id: activeJob.id, decision });
    setDragX(0);
    setDetailsOpen(false);
    setAnnouncement(`${activeJob.title} ${decision === "saved" ? "saved" : "passed"}. ${Math.max(0, deck.remaining.length - 1)} cards remain.`);
  }

  function undo() {
    if (!deck.history.length) return;
    dispatch({ type: "undo" });
    setDragX(0);
    setDetailsOpen(false);
    setAnnouncement("Previous choice undone.");
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as Element).closest("button, a, input, textarea, select, [data-no-drag]")) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!pointerStart.current) return;
    const deltaX = event.clientX - pointerStart.current.x;
    const deltaY = event.clientY - pointerStart.current.y;
    if (Math.abs(deltaX) > Math.abs(deltaY)) setDragX(Math.max(-180, Math.min(180, deltaX)));
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (!pointerStart.current) return;
    const deltaX = event.clientX - pointerStart.current.x;
    const deltaY = event.clientY - pointerStart.current.y;
    pointerStart.current = null;
    setDragX(0);
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      choose(deltaX > 0 ? "saved" : "passed");
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="ScaleMe dashboard">
          <span className={styles.brandIcon} aria-hidden="true">S</span>
          <span>ScaleMe</span>
        </Link>
        <nav aria-label="Discover navigation" className={styles.headerNav}>
          <Link href="/" className={styles.navLink}>Dashboard</Link>
          <span className={styles.activeNav} aria-current="page">Discover</span>
        </nav>
        <span className={styles.demoBadge}>FICTIONAL DEMO · NO LIVE JOBS</span>
      </header>

      <div className={styles.layout}>
        <section className={styles.intro}>
          <span className={styles.eyebrow}>DISCOVER OPPORTUNITIES</span>
          <h1>Find your next <span>opportunity.</span></h1>
          <p className={styles.introText}>
            Explore roles one card at a time. Swipe right to save, left to pass, and open details to understand the role.
          </p>
          <div className={styles.introActions}>
            <button type="button" className={!showSaved ? styles.tabActive : styles.tab} onClick={() => setShowSaved(false)}>
              Explore <span>{deck.remaining.length}</span>
            </button>
            <button type="button" className={showSaved ? styles.tabActive : styles.tab} onClick={() => setShowSaved(true)}>
              Saved <span>{deck.saved.length}</span>
            </button>
          </div>
          <div className={styles.hintBox}>
            <strong>What makes ScaleMe different?</strong>
            <p>Saving a role is the first step. The next step is discovering the evidence behind your fit and practicing the missing stories—never a fabricated hiring probability.</p>
          </div>
          <p className={styles.privacyNote}>These six roles are entirely fictional. Choices live only in this browser tab and reset on refresh. No external job API, resume data, or paid AI call is used.</p>
        </section>

        <section className={styles.deckSection} aria-label={showSaved ? "Saved opportunities" : "Swipeable opportunity cards"}>
          <div className={styles.deckHeader}>
            <span>{showSaved ? "YOUR SHORTLIST" : "CURATED DEMO DECK"}</span>
            <span>{showSaved ? `${deck.saved.length} saved` : `${deck.remaining.length} remaining`}</span>
          </div>
          {showSaved ? (
            <div className={styles.savedPanel}>
              <h2>Saved opportunities</h2>
              {deck.saved.length === 0 ? (
                <p>No cards saved yet. Return to Explore and swipe right or tap Save.</p>
              ) : (
                <ul className={styles.savedList}>
                  {deck.saved.map((id) => {
                    const job = byId.get(id);
                    return job ? (
                      <li key={id}>
                        <span className={styles.savedTitle}>{job.title}</span>
                        <span>{job.company} · {job.location}</span>
                        <span className={styles.savedDemo}>FICTIONAL DEMO · No application link</span>
                        <details className={styles.savedDetails}>
                          <summary>Review role details</summary>
                          <p>{job.description}</p>
                          <p>{job.whyShown}</p>
                        </details>
                        <button type="button" className={styles.removeSaved} onClick={() => {
                          dispatch({ type: "removeSaved", id: job.id });
                          setAnnouncement(`${job.title} removed from saved opportunities.`);
                        }}>Remove from saved</button>
                      </li>
                    ) : null;
                  })}
                </ul>
              )}
              <button className={styles.primaryButton} type="button" onClick={() => setShowSaved(false)}>Back to cards</button>
            </div>
          ) : activeJob ? (
            <>
              <div className={styles.cardStage}>
                {nextJob && <div className={styles.cardBehind} aria-hidden="true" />}
                <article
                  key={activeJob.id}
                  className={styles.card}
                  style={{ transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)` }}
                  tabIndex={0}
                  aria-label={`${activeJob.title} at ${activeJob.company}. Press the left arrow to pass or the right arrow to save.`}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "ArrowLeft") { event.preventDefault(); choose("passed"); }
                    if (event.key === "ArrowRight") { event.preventDefault(); choose("saved"); }
                  }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={() => { pointerStart.current = null; setDragX(0); }}
                >
                  {dragX < -25 && <span className={styles.passOverlay} aria-hidden="true">PASS</span>}
                  {dragX > 25 && <span className={styles.saveOverlay} aria-hidden="true">SAVE</span>}
                  <OpeningCard job={activeJob} detailsOpen={detailsOpen} onToggleDetails={() => setDetailsOpen((x) => !x)} />
                </article>
              </div>
              <div className={styles.controls}>
                <button type="button" className={styles.passButton} onClick={() => choose("passed")} aria-label={`Pass on ${activeJob.title}`}>← <span>Pass</span></button>
                <button type="button" className={styles.undoButton} onClick={undo} disabled={deck.history.length === 0}>Undo</button>
                <button type="button" className={styles.saveButton} onClick={() => choose("saved")} aria-label={`Save ${activeJob.title}`}><span>Save</span> →</button>
              </div>
              <p className={styles.keyboardHint}>Tip: focus the card and use ← / →, or swipe on a touch screen.</p>
            </>
          ) : (
            <div className={styles.emptyState}>
              <span aria-hidden="true">✓</span>
              <h2>You&apos;ve seen every demo card!</h2>
              <p>Saved {deck.saved.length} and passed {deck.passed.length}. You can review saved roles or restart the fictional demo.</p>
              <div className={styles.emptyActions}>
                <button className={styles.primaryButton} type="button" onClick={() => setShowSaved(true)}>View saved</button>
                <button className={styles.secondaryButton} type="button" onClick={() => {
                  dispatch({ type: "reset", ids: openingIds }); setDetailsOpen(false); setDragX(0); setAnnouncement("Demo deck reset.");
                }}>Restart demo</button>
              </div>
            </div>
          )}
          <p className={styles.announcement} role="status" aria-live="polite">{announcement}</p>
        </section>
      </div>
    </main>
  );
}
