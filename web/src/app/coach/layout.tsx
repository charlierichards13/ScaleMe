import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import "./coach.css";

export const metadata: Metadata = {
  title: "Career Coach | ScaleMe",
};

export default function CoachLayout({ children }: { children: ReactNode }) {
  return (
    <div className="coach-shell">
      <a href="#coach-main" className="coach-skip">Skip to Career Coach</a>
      <header className="coach-header">
        <Link href="/dashboard" aria-label="ScaleMe dashboard"><Logo compactMobile /></Link>
        <nav aria-label="Coach navigation"><Link href="/dashboard"><ArrowLeft size={16} aria-hidden="true" /> Dashboard</Link><span aria-current="page">Career Coach</span></nav>
      </header>
      <main id="coach-main" tabIndex={-1} className="coach-main">{children}</main>
    </div>
  );
}
