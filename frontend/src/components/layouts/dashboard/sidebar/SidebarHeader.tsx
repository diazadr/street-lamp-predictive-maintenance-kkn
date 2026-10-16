"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { BrandMark } from "@/src/components/common/BrandMark";
import type { User } from "@/src/types/auth";

interface SidebarHeaderProps {
  collapsed: boolean;
  user: User | null;
}

export const SidebarHeader = ({ collapsed, user }: SidebarHeaderProps) => {
  const t = useTranslations("DashboardSidebar");

  return (
    <div className="sidebar-header">
      <Link href="/dashboard" className={`flex items-center ${collapsed ? "justify-center w-full" : "gap-3"}`}>
        <BrandMark className="w-9 h-9" />
        {!collapsed && (
          <div className="flex flex-col min-w-0 overflow-hidden">
            <span className="font-bold tracking-tight text-foreground text-xs whitespace-nowrap">{t("brand")}</span>
            <span className="text-[10px] text-muted-foreground truncate font-medium">
              {user?.name || t("brand_sub")}
            </span>
          </div>
        )}
      </Link>
    </div>
  );
};
