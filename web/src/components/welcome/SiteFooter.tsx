import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { buttonStyles, cx } from "@/components/ui/primitives";
import { getStartedHref } from "@/lib/auth-status";
import { routes } from "@/lib/routes";
import { container } from "./styles";

const footerLink = cx("rounded text-sm text-muted transition-colors hover:text-ink", buttonStyles.focusRing);

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className={cx(container, "flex flex-col gap-10 py-12 md:flex-row md:items-start md:justify-between")}>
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-6 text-muted">
            Interview practice and labeled sample stories, in one workspace.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            <li>
              <a href="#features" className={footerLink}>
                Features
              </a>
            </li>
            <li>
              <a href="#about" className={footerLink}>
                About
              </a>
            </li>
            <li>
              <Link href={getStartedHref()} className={footerLink}>
                Get started
              </Link>
            </li>
            <li>
              <Link href={routes.dashboard} className={footerLink}>
                Guest dashboard
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className={cx(container, "border-t border-line py-6 text-xs leading-5 text-muted")}>
        <p>© 2026 ScaleMe · A SunHacks 2026 project. Sample content in the demo is fictional.</p>
      </div>
    </footer>
  );
}
