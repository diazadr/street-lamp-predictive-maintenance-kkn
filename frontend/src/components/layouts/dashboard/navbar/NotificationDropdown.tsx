"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, AlertCircle, UserCheck, Lightbulb, Wrench, Battery, Info, type LucideIcon } from "lucide-react";
import { api, toList } from "@/src/lib/http/axios";
import { cn, timeAgo } from "@/src/lib/utils";

interface Notification {
  id: string;
  type?: string;
  title: string;
  message?: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, LucideIcon> = {
  alert: AlertCircle,
  approval_request: UserCheck,
  account_approved: UserCheck,
  lamp_fault: Lightbulb,
  maintenance_due: Wrench,
  battery_low: Battery,
};

const TYPE_COLOR: Record<string, string> = {
  alert: "text-destructive bg-destructive/10",
  lamp_fault: "text-destructive bg-destructive/10",
  approval_request: "text-warning bg-warning/10",
  maintenance_due: "text-warning bg-warning/10",
  battery_low: "text-warning bg-warning/10",
  account_approved: "text-success bg-success/10",
};

export function NotificationDropdown() {
  const t = useTranslations("Notifications");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications", { params: { limit: 10 } });
      setItems(toList<Notification>(data));
    } catch {
      // backend offline — biarkan kosong
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {}
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="icon-btn" aria-label={t("title")}>
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive px-1 text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="dropdown-panel w-80 p-0 overflow-hidden -right-12 sm:right-0"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">{t("title")}</p>
              {unread > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer">
                  <CheckCheck className="h-3.5 w-3.5" /> {t("mark_all")}
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-border/60">
              {items.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <Bell className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  {t("empty")}
                </div>
              ) : (
                items.map((n) => {
                  const Icon = (n.type && TYPE_ICON[n.type]) || Info;
                  const color = (n.type && TYPE_COLOR[n.type]) || "text-primary bg-primary/10";
                  return (
                    <button
                      key={n.id}
                      onClick={() => !n.is_read && markRead(n.id)}
                      className={cn(
                        "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted cursor-pointer",
                        !n.is_read && "bg-primary/[0.03]"
                      )}
                    >
                      <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", color)}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm", n.is_read ? "text-muted-foreground" : "font-medium text-foreground")}>
                          {n.title}
                        </span>
                        {n.message && <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{n.message}</span>}
                        <span className="mt-1 block text-[10px] text-muted-foreground">{timeAgo(n.created_at, locale)}</span>
                      </span>
                      {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
