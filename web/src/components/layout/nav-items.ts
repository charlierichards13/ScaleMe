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
  /** Short status shown beside the label when the workspace isn't live yet. */
  status?: "Demo" | "Soon";
};

export const primaryNav: NavItem[] = [
  { label: "Dashboard", href: routes.dashboard, icon: LayoutDashboard },
  { label: "Discover Opportunities", href: routes.discover, icon: Compass, status: "Demo" },
  { label: "Resume Lab", href: routes.resumeLab, icon: FileText, status: "Soon" },
  { label: "Fit Analysis", href: routes.fit, icon: Scale, status: "Soon" },
  { label: "Mock Interviews", href: routes.interview, icon: Mic, status: "Soon" },
  { label: "AI Career Coach", href: routes.coach, icon: MessagesSquare, status: "Demo" },
  { label: "Saved Jobs", href: routes.saved, icon: Bookmark, status: "Soon" },
];

export const secondaryNav: NavItem[] = [
  { label: "Profile & Settings", href: routes.settings, icon: Settings, status: "Soon" },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
