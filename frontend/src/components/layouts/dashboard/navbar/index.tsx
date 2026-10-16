"use client";

import { PanelLeftClose, PanelLeftOpen, Menu } from "lucide-react";
import { NavBreadcrumbs } from "./NavBreadcrumbs";
import { NavActions } from "./NavActions";
import type { User } from "@/src/types/auth";

interface DashboardNavbarProps {
  user: User | null;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export default function DashboardNavbar({ user, sidebarCollapsed, onToggleSidebar }: DashboardNavbarProps) {
  return (
    <header className="dashboard-navbar">
      <div className="dashboard-navbar-left">
        <button onClick={onToggleSidebar} className="icon-btn-ghost lg:hidden" aria-label="Menu">
          <Menu className="h-[18px] w-[18px]" />
        </button>
        <button onClick={onToggleSidebar} className="icon-btn-ghost hidden lg:inline-flex" aria-label="Sidebar">
          {sidebarCollapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
        </button>
        <div className="hidden sm:block min-w-0">
          <NavBreadcrumbs />
        </div>
      </div>
      <div className="dashboard-navbar-right">
        <NavActions user={user} />
      </div>
    </header>
  );
}
