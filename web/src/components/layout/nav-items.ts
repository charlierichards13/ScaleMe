import {
  Bookmark,
  Compass,
  FileText,
  LayoutDashboard,
  MessagesSquare,
  Mic,
  Scale,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { routes } from "@/lib/routes";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * What that destination is today.
   * Sample: fictional fixtures. Practice: a fixed script you can answer.
   * Preview: local drafts plus an explicitly chosen fictional sample. Live analysis is off.
   * Planned: a page that only describes future work.
   */
  status?: "Sample" | "Practice" | "Preview" | "Planned";
};

export const primaryNav: NavItem[] = [
  { label: "Dashboard", href: routes.dashboard, icon: LayoutDashboard },
  { label: "Discover Opportunities", href: routes.discover, icon: Compass, status: "Planned" },
  { label: "Resume Lab", href: routes.impactLab, icon: FileText, status: "Sample" },
  { label: "Fit Analysis", href: routes.fitInsights, icon: Scale, status: "Preview" },
  { label: "Mock Interviews", href: routes.interview, icon: Mic, status: "Practice" },
  { label: "Career Coach", href: routes.coach, icon: MessagesSquare, status: "Practice" },
  { label: "Saved Jobs", href: routes.saved, icon: Bookmark, status: "Planned" },
];

export const secondaryNav: NavItem[] = [
  { label: "Profile & Settings", href: routes.settings, icon: Settings, status: "Planned" },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
