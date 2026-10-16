"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import DashboardSidebar from "@/src/components/layouts/dashboard/sidebar";
import DashboardNavbar from "@/src/components/layouts/dashboard/navbar";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { StatusAlert } from "@/src/components/ui/dashboard/StatusAlert";
import { BrandMark } from "@/src/components/common/BrandMark";
import { usePathname, useRouter } from "@/src/i18n/navigation";

// Aturan akses berbasis peran (RBAC) — dicek setelah sesi dipulihkan
const ACCESS_RULES: { prefix: string; roles: string[] }[] = [
  { prefix: "/admin", roles: ["admin"] },
];

export function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  const t = useTranslations("DashboardLayoutWrapper");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading, isAuthenticated } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dismissedLogin, setDismissedLogin] = useState(false);
  const showLoginSuccess = searchParams.get("login") === "success" && !dismissedLogin;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    const rule = ACCESS_RULES.find((r) => pathname.startsWith(r.prefix));
    if (rule && !rule.roles.includes(user?.role || "")) {
      router.replace("/forbidden");
    }
  }, [isLoading, isAuthenticated, user, pathname, router]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved !== null) setSidebarCollapsed(saved === "true");
    } catch {}
  }, []);

  const handleToggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try {
      localStorage.setItem("sidebar-collapsed", String(next));
    } catch {}
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-background">
        <BrandMark className="h-14 w-14 animate-pulse" />
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30 text-foreground">
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="sidebar-overlay"
          />
        )}
      </AnimatePresence>

      <DashboardSidebar
        role={user?.role}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        className={mobileMenuOpen ? "sidebar-mobile-open" : ""}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardNavbar
          user={user}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => {
            if (window.innerWidth < 1024) setMobileMenuOpen((o) => !o);
            else handleToggleSidebar();
          }}
        />
        <main className="flex-1 relative overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">
            {showLoginSuccess && (
              <div className="mb-6">
                <StatusAlert
                  status={{ type: "success", message: t("login_success") }}
                  onDismiss={() => {
                    setDismissedLogin(true);
                    window.history.replaceState({}, "", window.location.pathname);
                  }}
                  autoDismissMs={3000}
                />
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
