import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { buttonStyles, cx } from "@/components/ui/primitives";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Set up your workspace | ScaleMe",
  description: "A short, optional guest setup. Nothing is saved.",
};

/**
 * First-time setup, reached from the welcome page's Get Started buttons.
 * It's a guest preview: no account is created and nothing is persisted.
 * Future flow: Sign up (Issue #42) → this page → /dashboard, with returning
 * users skipping it. See docs/WELCOME_ONBOARDING.md.
 */
export default function OnboardingPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex h-20 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
        <Link href={routes.home} aria-label="ScaleMe home" className={cx("rounded-lg", buttonStyles.focusRing)}>
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-muted sm:inline-flex">
            Guest setup · nothing is saved
          </span>
          <Link href={routes.dashboard} className={buttonStyles.ghost}>
            Skip to dashboard
          </Link>
        </div>
      </header>
      <main className="px-4 pb-20 pt-6 sm:px-8 sm:pt-10">
        <OnboardingFlow />
      </main>
    </div>
  );
}
