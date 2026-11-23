"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Lightbulb, MapPin, Cpu, Battery, Signal, SlidersHorizontal, AlertTriangle, Wrench, FileText,
  Activity, BarChart2, Loader2, CalendarClock, Clock,
} from "lucide-react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { SectionCard } from "@/src/components/ui/dashboard/SectionCard";
import { MetricCard } from "@/src/components/ui/dashboard/MetricCard";
import { StatusBadge } from "@/src/components/ui/dashboard/StatusBadge";
import { EmptyState } from "@/src/components/ui/dashboard/EmptyState";
import { CardSkeleton } from "@/src/components/ui/dashboard/LoadingSkeleton";
import { CHART_AXIS, CHART_GRID, ChartTooltip } from "@/src/components/ui/dashboard/ChartParts";
import { Button } from "@/src/components/ui/button";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { setBreadcrumbLabel } from "@/src/components/layouts/dashboard/navbar/NavBreadcrumbs";
import { Link } from "@/src/i18n/navigation";
import { getErrorMessage } from "@/src/lib/http/axios";
import { formatDateTime, formatDecimal, formatTime, timeAgo } from "@/src/lib/utils";
import { settle, useFetch } from "@/src/hooks/useFetch";
import { lampService } from "../services/lampService";
import { PredictionPanel } from "../components/PredictionPanel";
import { placeService } from "@/src/features/places/services/placeService";

export function LampDetailView({ id }: { id: string }) {
  const t = useTranslations("LampDetail");
  const locale = useLocale();
  const { isAdmin, user } = useAuth();
  const canControl = user?.role === "admin" || user?.role === "operator";

  const { data, isLoading } = useFetch(
    () =>
      settle([
        lampService.get(id),
        lampService.alerts(id),
        lampService.tickets(id),
        lampService.predictions(id),
        lampService.deviceLogs(id),
        lampService.telemetry(id),
      ] as const),
    [id]
  );
  const [lamp, alerts = [], tickets = [], predictions = [], logs = [], telemetry = []] = data || [];
  const prediction = predictions[0];

  const { data: place } = useFetch(async () => (lamp?.place_id ? placeService.get(lamp.place_id) : null), [lamp?.place_id]);

  const [brightness, setBrightness] = useState(80);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (lamp?.last_brightness != null) setBrightness(Math.round(lamp.last_brightness));
    if (lamp?.lamp_code) setBreadcrumbLabel(id, lamp.lamp_code);
  }, [lamp, id]);

  const applyBrightness = async () => {
    setApplying(true);
    try {
      await lampService.setBrightness(id, brightness);
      toast.success(t("brightness.success", { value: brightness }));
    } catch (err) {
      toast.error(getErrorMessage(err, t("brightness.failed")));
    } finally {
      setApplying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CardSkeleton count={4} />
        <CardSkeleton count={2} className="lg:grid-cols-2" />
      </div>
    );
  }

  if (!lamp) {
    return <EmptyState icon={Lightbulb} title={t("not_found")} />;
  }

  const healthTone = (lamp.health_score ?? 0) > 70 ? "text-success" : (lamp.health_score ?? 0) > 40 ? "text-warning" : "text-destructive";
  // The firmware sends no battery level; fall back to the battery model's hourly estimate.
  const measuredLevels = telemetry.filter((p) => p.battery_level != null);
  const estimatedLevels = [...predictions]
    .reverse()
    .filter((p) => p.predicted_at && p.details?.battery?.soc_pct != null)
    .map((p) => ({ time: p.predicted_at as string, battery_level: p.details?.battery?.soc_pct ?? null }));
  const usingEstimate = measuredLevels.length < 2 && estimatedLevels.length > 1;
  const chartData = (usingEstimate ? estimatedLevels : measuredLevels).map((p) => ({ ...p, label: formatTime(p.time) }));

  return (
    <DashboardPageShell
      title={lamp.lamp_code}
      backHref="/workspace/lamps"
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge value={lamp.status} dot />
          {lamp.risk_level && <StatusBadge value={lamp.risk_level} />}
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {place?.name || t("unknown_place")}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {t("last_update", { time: timeAgo(lamp.last_seen, locale) })}
          </span>
        </span>
      }
      actions={
        isAdmin && (
          <Button asChild variant="outline">
            <Link href={`/workspace/lamps/${id}/schedule`}>
              <CalendarClock /> {t("schedule_button")}
            </Link>
          </Button>
        )
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title={t("metrics.battery")} value={lamp.last_battery_level != null ? `${formatDecimal(lamp.last_battery_level, 0)}%` : "—"} icon={Battery} iconColor="text-success" iconBg="bg-success/10" />
        <MetricCard title={t("metrics.brightness")} value={lamp.last_brightness != null ? `${formatDecimal(lamp.last_brightness, 0)}%` : "—"} icon={SlidersHorizontal} />
        <MetricCard title={t("metrics.signal")} value={lamp.last_signal_strength != null ? `${formatDecimal(lamp.last_signal_strength, 0)}%` : "—"} icon={Signal} />
        <MetricCard title={t("metrics.health")} value={lamp.health_score != null ? `${formatDecimal(lamp.health_score, 0)}%` : "—"} icon={BarChart2} iconColor={healthTone} iconBg="bg-muted" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title={t("info.title")} icon={Cpu}>
          <dl className="space-y-2.5 text-sm">
            {[
              [t("info.model"), lamp.model],
              [t("info.power"), lamp.power_rating ? `${lamp.power_rating} W` : null],
              [t("info.panel"), lamp.panel_watt_peak ? `${lamp.panel_watt_peak} Wp` : null],
              [t("info.battery"), lamp.battery_capacity_wh ? `${lamp.battery_capacity_wh} Wh` : null],
              [t("info.firmware"), lamp.firmware_version],
              [t("info.installed"), lamp.installed_at ? formatDateTime(lamp.installed_at, locale) : null],
              [t("info.coords"), lamp.latitude && lamp.longitude ? `${Number(lamp.latitude).toFixed(5)}, ${Number(lamp.longitude).toFixed(5)}` : null],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-border/50 pb-2.5 last:border-0 last:pb-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium text-foreground text-right">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>

        <SectionCard className="lg:col-span-2" title={t("chart.title")} description={t(usingEstimate ? "chart.desc_estimate" : "chart.desc")} icon={Activity}>
          {chartData.length > 1 ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="label" {...CHART_AXIS} minTickGap={32} />
                  <YAxis {...CHART_AXIS} domain={[0, 100]} unit="%" width={48} />
                  <Tooltip content={<ChartTooltip unit="%" digits={0} />} cursor={{ stroke: "var(--border)" }} />
                  <Line type="monotone" dataKey="battery_level" name={t("chart.battery")} stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={Activity} title={t("chart.empty")} className="py-12" />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PredictionPanel className="lg:col-span-2" lamp={lamp} prediction={prediction} />

        <SectionCard title={t("brightness.title")} icon={SlidersHorizontal} description={t("brightness.desc")}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <input
              type="range"
              min={0}
              max={100}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              disabled={!canControl}
              className="flex-1 accent-primary"
              aria-label={t("brightness.title")}
            />
            <span className="w-14 text-right text-lg font-semibold tabular-nums text-primary">{brightness}%</span>
            <Button onClick={applyBrightness} disabled={applying || !canControl}>
              {applying && <Loader2 className="animate-spin" />} {t("brightness.apply")}
            </Button>
          </div>
          {!canControl && <p className="mt-3 text-xs text-muted-foreground">{t("brightness.viewer")}</p>}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title={t("alerts.title")} icon={AlertTriangle} noPadding>
          {alerts.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("alerts.empty")}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-6 py-3">
                  <StatusBadge value={a.severity} />
                  <span className="flex-1 truncate text-sm text-foreground">{a.message}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(a.created_at, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t("tickets.title")}
          icon={Wrench}
          noPadding
          headerAction={
            <Link href={`/workspace/tickets?lamp=${id}`} className="text-xs font-medium text-primary hover:underline">
              {t("tickets.all")}
            </Link>
          }
        >
          {tickets.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("tickets.empty")}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {tickets.map((tk) => (
                <li key={tk.id} className="flex items-center gap-3 px-6 py-3">
                  <StatusBadge value={tk.status} />
                  <Link href={`/workspace/tickets/${tk.id}`} className="flex-1 truncate text-sm text-foreground hover:text-primary">
                    {tk.title}
                  </Link>
                  <StatusBadge value={tk.priority} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title={t("logs.title")} icon={FileText}>
        {logs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("logs.empty")}</p>
        ) : (
          <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-1 font-mono text-xs">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-3 border-b border-border/40 py-1.5 last:border-0">
                <span className="shrink-0 text-muted-foreground">{formatDateTime(log.time, locale)}</span>
                <span
                  className={`shrink-0 font-semibold ${log.log_level === "error" ? "text-destructive" : log.log_level === "warn" ? "text-warning" : "text-success"}`}
                >
                  [{log.log_level?.toUpperCase()}]
                </span>
                <span className="text-foreground/80">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </DashboardPageShell>
  );
}
