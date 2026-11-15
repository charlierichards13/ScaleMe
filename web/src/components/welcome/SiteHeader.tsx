import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { buttonStyles, cx } from "@/components/ui/primitives";
import { authPages, showSignInLink } from "@/lib/auth-status";
import { routes } from "@/lib/routes";
import { container, navLink } from "./styles";

const SIGN_IN_NOTE_ID = "sign-in-note";

/**
 * Minimal public navigation: logo left; Features, About and Sign in right.
 * Stays readable as a single row down to ~320px, so no mobile menu is needed.
 */
export function SiteHeader() {
  return (
    <header className={cx(container, "flex h-20 items-center justify-between gap-3")}>
      <Link href={routes.home} aria-label="ScaleMe home" className={cx("rounded-lg", buttonStyles.focusRing)}>
        <Logo compactMobile />
      </Link>

      <nav aria-label="Primary" className="flex items-center gap-0.5 sm:gap-2">
        <a href="#features" className={navLink}>
          Features
        </a>
        <a href="#about" className={navLink}>
          About
        </a>
        <SignInEntry />
      </nav>
    </header>
  );
}

const signInClass = cx(
  "ml-1 inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-sm font-semibold text-ink transition-colors hover:border-slate-300",
  buttonStyles.focusRing,
);

/**
 * The sign-in screen is Issue #42 (UI only). Until real accounts work
 * (`accountsEnabled`), the button opens a native popover that explains guest
 * mode honestly, even if the screen exists, instead of sending visitors to a
 * form that can't sign them in. No JavaScript is needed: the browser handles
 * opening, Escape and click-outside.
 */
function SignInEntry() {
  if (showSignInLink()) {
    return (
      <Link href={authPages.signIn} className={signInClass}>
        Sign in
      </Link>
    );
  }

  return (
    <>
      <button type="button" popoverTarget={SIGN_IN_NOTE_ID} className={signInClass}>
        Sign in
      </button>
      <div
        id={SIGN_IN_NOTE_ID}
        popover="auto"
        role="dialog"
        aria-labelledby="sign-in-note-title"
        className="fixed inset-auto right-4 top-20 m-0 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-left text-ink shadow-[0_18px_48px_-16px_rgb(32_38_56/0.25)] sm:right-[max(2rem,calc((100vw-72rem)/2+2rem))]"
      >
        <div className="flex items-start justify-between gap-3">
          <p id="sign-in-note-title" className="text-sm font-semibold">
            Accounts are coming soon
          </p>
          <button
            type="button"
            popoverTarget={SIGN_IN_NOTE_ID}
            popoverTargetAction="hide"
            aria-label="Close"
            className={cx("-m-1.5 rounded-lg p-1.5 text-muted hover:text-ink", buttonStyles.focusRing)}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-sm leading-6 text-muted">
          Sign-in isn&apos;t available in this version. You can explore ScaleMe as a guest. Nothing you enter is saved.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={routes.onboarding} className={buttonStyles.primary}>
            Start as a guest
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          <Link href={routes.dashboard} className={buttonStyles.secondary}>
            Open dashboard
          </Link>
        </div>
      </div>
    </>
  );
}
