import type { Metadata } from "next";
import { About } from "@/components/welcome/About";
import { Features } from "@/components/welcome/Features";
import { FinalCta } from "@/components/welcome/FinalCta";
import { Hero } from "@/components/welcome/Hero";
import { SiteFooter } from "@/components/welcome/SiteFooter";
import { SiteHeader } from "@/components/welcome/SiteHeader";

export const metadata: Metadata = {
  title: "ScaleMe | Career workspace preview",
  description:
    "Practice a scripted interview and review labeled sample stories in one workspace.",
};

/**
 * Public welcome page (Issue #43). A server component with no client
 * JavaScript of its own: anchors, the sign-in popover and all motion are
 * native HTML/CSS. Navigation → Hero → Features → About → Final CTA → Footer.
 */
export default function WelcomePage() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface px-4 py-2 text-sm font-semibold text-brand shadow-card focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Features />
        <About />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
