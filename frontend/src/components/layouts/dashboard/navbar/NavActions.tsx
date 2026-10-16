"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, User as UserIcon, Settings, LogOut, MoreVertical, Search } from "lucide-react";
import { Link, useRouter } from "@/src/i18n/navigation";
import { ThemeToggle } from "../ThemeToggle";
import { NotificationDropdown } from "./NotificationDropdown";
import { SearchModal } from "./SearchModal";
import { LocaleToggle } from "./LocaleToggle";
import { useAuth } from "@/src/components/providers/AuthProvider";
import type { User } from "@/src/types/auth";

export const NavActions = ({ user }: { user: User | null }) => {
  const t = useTranslations("DashboardNavbar");
  const { logout, isAdmin } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = user?.name || "";
  const firstLetter = displayName ? displayName.charAt(0).toUpperCase() : "";
  const displayRole = user?.role ? t.has(`roles.${user.role}`) ? t(`roles.${user.role}`) : user.role : "";

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    router.replace("/login?logout=success");
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Pintasan global Ctrl/⌘ + K untuk pencarian
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setSearchOpen(true)}
        className="hidden md:flex h-9 w-64 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-muted/50 px-3.5 text-sm text-muted-foreground transition-colors hover:bg-muted cursor-pointer"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 truncate text-left">{t("search_placeholder")}</span>
        <kbd className="rounded-md border border-border bg-background px-1.5 text-[10px] font-medium">Ctrl K</kbd>
      </button>
      <button onClick={() => setSearchOpen(true)} className="icon-btn md:hidden" aria-label={t("search_placeholder")}>
        <Search className="h-[18px] w-[18px]" />
      </button>

      <LocaleToggle />
      <ThemeToggle />
      <NotificationDropdown />

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="hidden lg:flex items-center gap-2.5 ml-1 p-1.5 pr-3 rounded-full hover:bg-muted transition-colors duration-200 cursor-pointer focus:outline-none"
        >
          <span className="h-9 w-9 shrink-0 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
            {firstLetter || <UserIcon className="h-4 w-4" />}
          </span>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground leading-none">{displayName || t("loading")}</p>
            {displayRole && <p className="text-xs font-medium text-muted-foreground mt-0.5 capitalize">{displayRole}</p>}
          </div>
          <ChevronDown className={`h-4 w-4 text-foreground/40 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </button>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden flex items-center gap-1 p-1.5 rounded-xl hover:bg-muted transition-colors duration-200 cursor-pointer focus:outline-none"
        >
          <span className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
            {firstLetter || <UserIcon className="h-3.5 w-3.5" />}
          </span>
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        {isOpen && (
          <div className="dropdown-panel">
            <div className="px-3 py-2.5">
              <p className="text-sm font-semibold text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <div className="dropdown-divider" />
            <Link href="/profile" onClick={() => setIsOpen(false)} className="dropdown-item">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              {t("profile")}
            </Link>
            {isAdmin && (
              <Link href="/admin/settings" onClick={() => setIsOpen(false)} className="dropdown-item">
                <Settings className="h-4 w-4 text-muted-foreground" />
                {t("settings")}
              </Link>
            )}
            <div className="dropdown-divider" />
            <button onClick={handleLogout} className="dropdown-item-danger">
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </button>
          </div>
        )}
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};
