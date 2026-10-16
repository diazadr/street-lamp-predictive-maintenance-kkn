"use client";

import { useLocale, useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  Lightbulb, Wifi, WifiOff, AlertTriangle, Bell, HeartPulse, Battery, Sun, Zap, BrainCircuit,
  ShieldAlert, CheckCircle2, ArrowRight, Map, Wrench, FileText, Users, Settings, Activity,
} from "lucide-react";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { MetricCard } from "@/src/components/ui/dashboard/MetricCard";
import { SectionCard } from "@/src/components/ui/dashboard/SectionCard";
import { CardSkeleton } from "@/src/components/ui/dashboard/LoadingSkeleton";
import { StatusBadge } from "@/src/components/ui/dashboard/StatusBadge";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { Link } from "@/src/i18n/navigation";
import { formatDecimal, formatNumber, timeAgo } from "@/src/lib/utils";
import { settle, useFetch } from "@/src/hooks/useFetch";
import { dashboardService } from "../services/dashboardService";

export function DashboardHomeView() {
  const t = useTranslations("DashboardHome");
  const locale = useLocale();
  const { user, isAdmin } = useAuth();

  const { data, isLoading } = useFetch(
    () => settle([dashboardService.kpi(), dashboardService.riskSummary(), dashboardService.activeAlerts(), dashboardService.energySummary()] as const),
    []
  );
  const [kpi, risk, alerts, energy] = data || [];

  const riskRows = [
    { key: "high", value: risk?.high ?? 0, color: "bg-destructive", text: "text-destructive" },
    { key: "medium", value: risk?.medium ?? 0, color: "bg-warning", text: "text-warning" },
    { key: "low", value: risk?.low ?? 0, color: "bg-success", text: "text-success" },
  ] as const;
  const riskTotal = riskRows.reduce((s, r) => s + r.value, 0) || 1;

  const quickLinks = [
    { label: t("quick.lamps"), icon: Lightbulb, href: "/workspace/lamps" },
    { label: t("quick.map"), icon: Map, href: "/workspace/map" },
    { label: t("quick.tickets"), icon: Wrench, href: "/workspace/tickets" },
    { label: t("quick.reports"), icon: FileText, href: "/workspace/reports" },
    ...(isAdmin
      ? [
          { label: t("quick.users"), icon: Users, href: "/admin/users" },
          { label: t("quick.settings"), icon: Settings, href: "/admin/settings" },
        ]
      : []),
  ];

  const n = (v?: number | null) => formatNumber(v ?? null, locale);

  return (
    <DashboardPageShell title={t("title", { name: user?.name?.split(" ")[0] || "" })} subtitle={t("subtitle")}>
      {isLoading ? (
        <>
          <CardSkeleton count={4} />
          <CardSkeleton count={4} />
        </>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title={t("kpi.total")} value={n(kpi?.total_lamps)} icon={Lightbulb} />
          <MetricCard title={t("kpi.online")} value={n(kpi?.online)} icon={Wifi} iconColor="text-success" iconBg="bg-success/10" />
          <MetricCard title={t("kpi.offline")} value={n(kpi?.offline)} icon={WifiOff} iconColor="text-muted-foreground" iconBg="bg-muted" />
          <MetricCard title={t("kpi.fault")} value={n(kpi?.fault)} icon={AlertTriangle} iconColor="text-destructive" iconBg="bg-destructive/10" />
          <MetricCard title={t("kpi.alerts_today")} value={n(kpi?.alerts_today)} icon={Bell} iconColor="text-warning" iconBg="bg-warning/10" />
          <MetricCard title={t("kpi.health")} value={kpi?.avg_health_score != null ? `${formatDecimal(kpi.avg_health_score, 0)}%` : "—"} icon={HeartPulse} />
          <MetricCard title={t("kpi.battery")} value={kpi ? `${formatDecimal(kpi.avg_battery, 0)}%` : "—"} icon={Battery} iconColor="text-success" iconBg="bg-success/10" />
          <MetricCard
            title={t("kpi.solar")}
            value={kpi?.solar_status ? t.has(`solar_status.${kpi.solar_status}`) ? t(`solar_status.${kpi.solar_status}`) : kpi.solar_status : "—"}
            icon={Sun}
            iconColor="text-warning"
            iconBg="bg-warning/10"
            accent={kpi?.solar_status === "Charging"}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard
          className="lg:col-span-2"
          title={t("energy.title")}
          icon={Zap}
          headerAction={
            <Link href="/workspace/energy" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {t("see_detail")} <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="grid grid-cols-3 divide-x divide-border">
            {[
              { label: t("energy.generated"), value: formatDecimal(energy?.solar_generated_today, 1), unit: "kWh", tone: "text-success" },
              { label: t("energy.consumed"), value: formatDecimal(energy?.consumed_today, 1), unit: "kWh", tone: "text-foreground" },
              { label: t("energy.efficiency"), value: formatDecimal(energy?.efficiency_pct, 0), unit: "%", tone: "text-primary" },
            ].map((e) => (
              <div key={e.label} className="text-center px-2">
                <p className={`text-2xl sm:text-3xl font-semibold tabular-nums ${e.tone}`}>
                  {e.value}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">{e.unit}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{e.label}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={t("risk.title")}
          icon={BrainCircuit}
          headerAction={
            <Link href="/workspace/monitoring" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {t("see_detail")} <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="space-y-3.5">
            {riskRows.map((r) => (
              <div key={r.key}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">{t(`risk.${r.key}`)}</span>
                  <span className={`font-semibold tabular-nums ${r.text}`}>{r.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(r.value / riskTotal) * 100}%` }}
                    transition={{ duration: 0.8 }}
                    className={`h-full rounded-full ${r.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title={t("alerts.title")} icon={ShieldAlert} noPadding>
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : alerts && alerts.length > 0 ? (
            <ul className="divide-y divide-border/60">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-6 py-3.5">
                  <StatusBadge value={a.severity === "critical" ? "critical" : a.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">{a.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(a.created_at, locale)}</p>
                  </div>
                  {a.lamp_id && (
                    <Link href={`/workspace/lamps/${a.lamp_id}`} className="text-xs font-medium text-primary hover:underline shrink-0">
                      {t("alerts.view_lamp")}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
              <p className="text-sm text-muted-foreground">{t("alerts.empty")}</p>
            </div>
          )}
        </SectionCard>

        <SectionCard title={t("quick.title")} icon={Activity}>
          <div className="grid grid-cols-2 gap-3">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 rounded-xl border border-border p-3.5 text-sm font-medium text-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-colors"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-4 w-4" />
                </span>
                {item.label}
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </DashboardPageShell>
  );
}
