import Link from "next/link";
import { buttonStyles } from "@/components/ui/primitives";
import { Logo } from "@/components/layout/Logo";
import { routes } from "@/lib/routes";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-6 text-xl font-bold tracking-tight text-ink">This page isn&apos;t available yet</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          It may be part of a feature that hasn&apos;t shipped in this build, or the link may be wrong.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href={routes.dashboard} className={buttonStyles.primary}>
            Back to dashboard
          </Link>
          <Link href={routes.home} className={buttonStyles.secondary}>
            Welcome page
          </Link>
        </div>
      </div>
    </main>
  );
}
