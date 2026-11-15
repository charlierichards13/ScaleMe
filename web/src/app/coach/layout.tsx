import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AI Career Coach (demo) | ScaleMe",
};

export default function CoachLayout({ children }: { children: ReactNode }) {
  return children;
}
