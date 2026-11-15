import { Lock, Quote, ScanText, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import { container, eyebrow } from "./styles";

/**
 * Principles are product commitments enforced by the repository's integrity
 * rules (AGENTS.md), not marketing claims. Keep them true if the product changes.
 */
const principles: Array<{ title: string; body: string; icon: LucideIcon }> = [
  {
    title: "Evidence, not keywords",
    body: "Feedback points back to what your resume or your answers actually show.",
    icon: ScanText,
  },
  {
    title: "Your words, never invented",
    body: "ScaleMe won't add accomplishments, metrics, or skills you haven't confirmed.",
    icon: Quote,
  },
  {
    title: "Private by default",
    body: "In this early version there are no accounts, and nothing you enter is saved.",
    icon: Lock,
  },
];

export function About() {
  return (
    <section id="about" aria-labelledby="about-title" className="scroll-mt-6 border-y border-line bg-surface py-24 sm:py-32">
      <div className={cx(container, "grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20")}>
        <div className="sm-reveal">
          <p className={eyebrow}>About ScaleMe</p>
          <h2 id="about-title" className="mt-4 text-3xl font-semibold tracking-[-0.025em] text-ink sm:text-[2.75rem] sm:leading-[1.1]">
            Built to help you move forward.
          </h2>
        </div>

        <div className="sm-reveal space-y-6 text-lg leading-8 text-slate-600">
          <p>
            Finding the right opportunity can be hard, especially when you&apos;re unsure how to present your experience or
            prepare for interviews.
          </p>
          <p>ScaleMe brings career discovery, resume improvement, and interview preparation into one personalized workspace.</p>
          <p>
            Your experience is more than a list of keywords. ScaleMe helps you uncover what you&apos;ve actually accomplished,
            communicate your strengths, and walk into your next opportunity with confidence.
          </p>
        </div>
      </div>

      <ul className={cx(container, "mt-16 grid gap-8 sm:mt-20 md:grid-cols-3 md:gap-10")}>
        {principles.map(({ title, body, icon: Icon }) => (
          <li key={title} className="sm-reveal border-t border-line pt-6">
            <Icon aria-hidden="true" className="h-5 w-5 text-brand" strokeWidth={1.8} />
            <h3 className="mt-4 text-base font-semibold tracking-tight text-ink">{title}</h3>
            <p className="mt-1.5 text-[15px] leading-7 text-muted">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
