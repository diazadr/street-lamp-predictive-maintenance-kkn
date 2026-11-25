"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Lightbulb, Sun, BatteryMedium, BatteryCharging, ShieldAlert, CheckCircle2, ArrowRight, Map, Wrench, FileText, Users,
  Settings, Activity, RefreshCw, Gauge,
} from "lucide-react";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { MetricCard } from "@/src/components/ui/dashboard/MetricCard";
import { SectionCard } from "@/src/components/ui/dashboard/SectionCard";
import { CardSkeleton } from "@/src/components/ui/dashboard/LoadingSkeleton";
import { StatusBadge } from "@/src/components/ui/dashboard/StatusBadge";
import { Button } from "@/src/components/ui/button";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { Link } from "@/src/i18n/navigation";
import { formatDecimal, timeAgo } from "@/src/lib/utils";
import { settle, useFetch } from "@/src/hooks/useFetch";
import { dashboardService } from "../services/dashboardService";
import { FleetHero } from "../components/FleetHero";
import { EnergyPanel } from "../components/EnergyPanel";
import { MlInsightCard } from "../components/MlInsightCard";
import { LampWatchlist } from "../components/LampWatchlist";

const REFRESH_MS = 60_000;

export function DashboardHomeView() {
  const t = useTranslations("DashboardHome");
  const locale = useLocale();
  const { user, isAdmin } = useAuth();

  const { data, isLoading, reload } = useFetch(
    () => settle([dashboardService.kpi(), dashboardService.overview(), dashboardService.activeAlerts()] as const),
    []
  );
  const [kpi, overview, alerts] = data || [];

  // Keep the page current while it is open; skip refreshes in background tabs.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [reload]);

  const lamps = overview?.lamps ?? [];
  const energy = overview?.energy;
  const fleet = lamps.length > 1;
  const withSoc = lamps.filter((l) => l.battery_soc != null);
  const avgSoc = withSoc.length ? withSoc.reduce((s, l) => s + (l.battery_soc as number), 0) / withSoc.length : null;
  const lowestSoc = withSoc.reduce<(typeof lamps)[number] | undefined>((min, l) => (!min || (l.battery_soc as number) < (min.battery_soc as number) ? l : min), undefined);
  const withReserve = lamps.filter((l) => l.autonomy_nights != null);
  const weakest = withReserve.reduce<(typeof lamps)[number] | undefined>((min, l) => (!min || (l.autonomy_nights as number) < (min.autonomy_nights as number) ? l : min), undefined);

  const socTrend = !lowestSoc
    ? undefined
    : fleet
      ? t("kpi.soc_lowest", { code: lowestSoc.lamp_code, value: formatDecimal(lowestSoc.battery_soc, 0) })
      : lowestSoc.hours_since_full != null
        ? t("kpi.since_full", { value: formatDecimal(lowestSoc.hours_since_full, 0) })
        : undefined;
  const reserveTrend = !weakest
    ? undefined
    : fleet
      ? t("kpi.weakest", { code: weakest.lamp_code })
      : weakest.nightly_consumption_ah != null
        ? t("kpi.nightly", { value: formatDecimal(weakest.nightly_consumption_ah, 2) })
        : undefined;

  const quickLinks = [
    { label: t("quick.lamps"), icon: Lightbulb, href: "/workspace/lamps" },
    { label: t("quick.map"), icon: Map, href: "/workspace/map" },
    { label: t("quick.monitoring"), icon: Gauge, href: "/workspace/monitoring" },
    { label: t("quick.tickets"), icon: Wrench, href: "/workspace/tickets" },
    { label: t("quick.reports"), icon: FileText, href: "/workspace/reports" },
    ...(isAdmin
      ? [
          { label: t("quick.users"), icon: Users, href: "/admin/users" },
          { label: t("quick.settings"), icon: Settings, href: "/admin/settings" },
        ]
      : []),
  ];

  const firstLoad = isLoading && !data;

  return (
    <DashboardPageShell
      title={t("title", { name: user?.name?.split(" ")[0] || "" })}
      subtitle={t("subtitle")}
      actions={
        <Button variant="outline" size="icon" onClick={reload} aria-label={t("refresh")}>
          <RefreshCw className={isLoading ? "animate-spin" : ""} />
        </Button>
      }
    >
      {firstLoad ? (
        <>
          <div className="h-56 rounded-2xl bg-muted animate-pulse lg:h-48" />
          <CardSkeleton count={4} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="h-80 rounded-xl border border-border bg-card lg:col-span-2 animate-pulse" />
            <div className="h-80 rounded-xl border border-border bg-card animate-pulse" />
          </div>
        </>
      ) : (
        <>
          <FleetHero lamps={lamps} hourly={overview?.hourly ?? []} lastDataAt={overview?.last_data_at ?? null} unresolvedAlerts={kpi?.unresolved_alerts ?? alerts?.length ?? 0} />

          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title={t("kpi.solar")}
              value={energy ? `${formatDecimal(energy.solar_wh, 1)} Wh` : "—"}
              icon={Sun}
              iconColor="text-accent-ink"
              iconBg="bg-accent/10"
              trend={energy?.peak_solar_w != null ? t("kpi.peak", { value: formatDecimal(energy.peak_solar_w, 1) }) : undefined}
            />
            <MetricCard
              title={t("kpi.load")}
              value={energy ? `${formatDecimal(energy.load_wh, 1)} Wh` : "—"}
              icon={Lightbulb}
              trend={energy?.peak_load_w != null ? t("kpi.peak", { value: formatDecimal(energy.peak_load_w, 2) }) : undefined}
            />
            <MetricCard
              title={t("kpi.soc")}
              value={avgSoc != null ? `${formatDecimal(avgSoc, 0)}%` : "—"}
              icon={BatteryMedium}
              iconColor="text-success"
              iconBg="bg-success/10"
              trend={socTrend}
            />
            <MetricCard
              title={t("kpi.reserve")}
              value={weakest ? t("kpi.nights", { value: formatDecimal(weakest.autonomy_nights, 1) }) : "—"}
              icon={BatteryCharging}
              trend={reserveTrend}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <EnergyPanel className="lg:col-span-2" hourly={overview?.hourly ?? []} windowEnd={overview?.last_data_at ?? undefined} />
            <MlInsightCard lamps={lamps} conditions={overview?.conditions ?? {}} model={overview?.model ?? null} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <LampWatchlist className="lg:col-span-2" lamps={lamps} />

            <SectionCard title={t("alerts.title")} icon={ShieldAlert} noPadding>
              {alerts && alerts.length > 0 ? (
                <ul className="divide-y divide-border/60">
                  {alerts.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 px-6 py-3.5">
                      <StatusBadge value={a.severity} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground line-clamp-2">{a.message}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {timeAgo(a.created_at, locale)}
                          {a.lamp_id && (
                            <>
                              {" · "}
                              <Link href={`/workspace/lamps/${a.lamp_id}`} className="font-medium text-primary hover:underline">
                                {t("alerts.view_lamp")}
                              </Link>
                            </>
                          )}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-12 text-center">
                  <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
                  <p className="px-6 text-sm text-muted-foreground">{t("alerts.empty")}</p>
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard title={t("quick.title")} icon={Activity}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 truncate">{item.label}</span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </DashboardPageShell>
  );
}
