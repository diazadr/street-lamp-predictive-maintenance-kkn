"use client";

import { useState, useEffect, useMemo, createContext, useContext } from "react";
import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Map, Lightbulb, MapPin, Activity, Zap, Wrench, FileText,
  Users, ScrollText, Settings, UserCircle, Gauge, ShieldCheck,
} from "lucide-react";
import { usePathname } from "@/src/i18n/navigation";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarItem } from "./SidebarItem";
import { SidebarDropdown } from "./SidebarDropdown";
import { SidebarLogout } from "./SidebarLogout";

export const SidebarContext = createContext<{
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}>({ collapsed: false, setCollapsed: () => {} });

export const useSidebar = () => useContext(SidebarContext);

type Role = "admin" | "operator" | "viewer";
const ALL: Role[] = ["admin", "operator", "viewer"];

type SubItem = { nameKey: string; href: string; icon: LucideIcon; roles?: Role[]; exact?: boolean; excludePaths?: string[] };

type MenuItem = {
  type: "item" | "dropdown" | "label";
  nameKey: string;
  href?: string;
  icon?: LucideIcon;
  roles?: Role[];
  subItems?: SubItem[];
  exact?: boolean;
  excludePaths?: string[];
};

const MENU_STRUCTURE: MenuItem[] = [
  { type: "label", nameKey: "section_overview", roles: ALL },
  { type: "item", nameKey: "dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ALL, exact: true },
  { type: "item", nameKey: "lamp_map", href: "/workspace/map", icon: Map, roles: ALL },

  { type: "label", nameKey: "section_assets", roles: ALL },
  {
    type: "dropdown",
    nameKey: "asset_management",
    href: "/workspace/lamps",
    icon: Lightbulb,
    roles: ALL,
    subItems: [
      { nameKey: "lamps", href: "/workspace/lamps", icon: Lightbulb },
      { nameKey: "places", href: "/workspace/places", icon: MapPin },
    ],
  },

  { type: "label", nameKey: "section_pdm", roles: ALL },
  {
    type: "dropdown",
    nameKey: "pdm_console",
    href: "/workspace/monitoring",
    icon: Gauge,
    roles: ALL,
    subItems: [
      { nameKey: "monitoring", href: "/workspace/monitoring", icon: Activity },
      { nameKey: "energy", href: "/workspace/energy", icon: Zap },
      { nameKey: "tickets", href: "/workspace/tickets", icon: Wrench },
      { nameKey: "reports", href: "/workspace/reports", icon: FileText },
    ],
  },

  { type: "label", nameKey: "section_administration", roles: ["admin"] },
  {
    type: "dropdown",
    nameKey: "management_console",
    href: "/admin/users",
    icon: ShieldCheck,
    roles: ["admin"],
    subItems: [
      { nameKey: "user_control", href: "/admin/users", icon: Users },
      { nameKey: "audit_log", href: "/admin/audit-log", icon: ScrollText },
      { nameKey: "system_settings", href: "/admin/settings", icon: Settings },
    ],
  },

  { type: "label", nameKey: "section_account", roles: ALL },
  { type: "item", nameKey: "my_identity", href: "/profile", icon: UserCircle, roles: ALL },
];

interface DashboardSidebarProps {
  role?: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

const isSubActive = (pathname: string, sub: SubItem) =>
  pathname === sub.href ||
  (!sub.exact && pathname.startsWith(sub.href + "/") && !sub.excludePaths?.some((p) => pathname.startsWith(p)));

export default function DashboardSidebar({ role = "viewer", collapsed, onToggleCollapse, className = "" }: DashboardSidebarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const t = useTranslations("DashboardSidebar");
  const [openDropdowns, setOpenDropdowns] = useState<string[]>([]);

  const filteredMenu = useMemo(() => {
    const result: MenuItem[] = [];
    MENU_STRUCTURE.forEach((item, index) => {
      if (item.roles && !item.roles.includes(role as Role)) return;
      if (item.type === "label") {
        const next = MENU_STRUCTURE.slice(index + 1);
        const nextLabel = next.findIndex((n) => n.type === "label");
        const group = nextLabel === -1 ? next : next.slice(0, nextLabel);
        if (group.some((g) => !g.roles || g.roles.includes(role as Role))) result.push(item);
      } else if (item.type === "dropdown") {
        const subItems = item.subItems?.filter((s) => !s.roles || s.roles.includes(role as Role)) || [];
        if (subItems.length > 0) result.push({ ...item, subItems });
      } else {
        result.push(item);
      }
    });
    return result;
  }, [role]);

  const activeDropdownKeys = useMemo(
    () =>
      filteredMenu
        .filter((item) => item.type === "dropdown" && item.subItems?.some((sub) => isSubActive(pathname, sub)))
        .map((item) => item.nameKey),
    [pathname, filteredMenu]
  );

  // buka dropdown milik halaman aktif setiap kali route berubah
  const [prevActiveKeys, setPrevActiveKeys] = useState<string[] | null>(null);
  if (prevActiveKeys !== activeDropdownKeys) {
    setPrevActiveKeys(activeDropdownKeys);
    setOpenDropdowns(activeDropdownKeys);
  }

  useEffect(() => {
    if (!collapsed) return;
    const frame = window.requestAnimationFrame(() => setOpenDropdowns([]));
    return () => window.cancelAnimationFrame(frame);
  }, [collapsed]);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed: () => onToggleCollapse() }}>
      <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : "sidebar-expanded"} ${className}`}>
        <SidebarHeader collapsed={collapsed} user={user} />

        <nav className="sidebar-nav scrollbar-none py-4 px-3 flex-1">
          {filteredMenu.map((item, index) => {
            if (item.type === "label") {
              return !collapsed ? (
                <div key={`label-${index}`} className="px-3 pt-6 pb-2 first:pt-0">
                  <p className="text-[13px] font-medium text-muted-foreground/60">{t(`menu.${item.nameKey}`)}</p>
                </div>
              ) : (
                <div key={`label-divider-${index}`} className="mx-4 my-4 h-px bg-border/40 last:hidden" />
              );
            }

            if (item.type === "dropdown") {
              return (
                <SidebarDropdown
                  key={item.nameKey}
                  item={item}
                  pathname={pathname}
                  isOpen={openDropdowns.includes(item.nameKey)}
                  onToggle={() =>
                    setOpenDropdowns((prev) =>
                      prev.includes(item.nameKey)
                        ? prev.filter((k) => k !== item.nameKey)
                        : Array.from(new Set([...activeDropdownKeys, item.nameKey]))
                    )
                  }
                  collapsed={collapsed}
                />
              );
            }

            return (
              <SidebarItem
                key={item.href || `item-${index}`}
                nameKey={item.nameKey}
                href={item.href!}
                icon={item.icon!}
                isActive={item.exact ? pathname === item.href : pathname.startsWith(item.href!)}
                collapsed={collapsed}
              />
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <SidebarLogout collapsed={collapsed} />
        </div>
      </aside>
    </SidebarContext.Provider>
  );
}
