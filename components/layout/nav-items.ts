import { Activity, BarChart3, Flag, Globe2, LayoutGrid, Network, Settings2, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: "WORKSPACE" | "EXPLORE";
}

export const NAV: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutGrid, group: "WORKSPACE" },
  { href: "/localization", label: "Localization", icon: Globe2, group: "WORKSPACE" },
  { href: "/health", label: "Content health", icon: Activity, group: "WORKSPACE" },
  { href: "/graph", label: "Reference graph", icon: Network, group: "WORKSPACE" },
  { href: "/insights", label: "Insights", icon: BarChart3, group: "WORKSPACE" },
  { href: "/roadmap", label: "Product roadmap", icon: Flag, group: "EXPLORE" },
  { href: "/settings", label: "Integration", icon: Settings2, group: "EXPLORE" },
];
