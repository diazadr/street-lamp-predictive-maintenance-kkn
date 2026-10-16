"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Activity, AlertTriangle, BrainCircuit, Download, Loader2, RefreshCw, Wifi, WifiOff, Zap, Gauge } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { MetricCard } from "@/src/components/ui/dashboard/MetricCard";
import { SectionCard } from "@/src/components/ui/dashboard/SectionCard";
import { CardSkeleton } from "@/src/components/ui/dashboard/LoadingSkeleton";
import { EmptyState } from "@/src/components/ui/dashboard/EmptyState";
import { TabSwitch } from "@/src/components/ui/dashboard/TabSwitch";
import { CHART_AXIS, CHART_GRID, ChartLegend, ChartTooltip } from "@/src/components/ui/dashboard/ChartParts";
import { Button } from "@/src/components/ui/button";
import { downloadFile } from "@/src/lib/http/axios";
import { aggregateByHour, formatNumber, isoDate } from "@/src/lib/utils";
import { settle, useFetch } from "@/src/hooks/useFetch";
import { dashboardService, type TrendPoint } from "@/src/features/dashboard/services/dashboardService";

const RANGE_LIMIT = { "24h": 100, "7d": 300, "30d": 500 } as const;
type Range = keyof typeof RANGE_LIMIT;

function MiniLine({ data, dataKey, name, unit, color }: { data: ReturnType<typeof aggregateByHour<TrendPoint>>; dataKey: keyof TrendPoint; name: string; unit: string; color: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {name} <span className="opacity-60">({unit.trim()})</span>
      </p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} syncId="monitoring">
            <CartesianGrid {...CHART_GRID} />
            <XAxis dataKey="label" {...CHART_AXIS} minTickGap={40} />
            <YAxis {...CHART_AXIS} width={48} />
            <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: "var(--border)" }} />
            <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MonitoringView() {
  const t = useTranslations("Monitoring");
  const [range, setRange] = useState<Range>("24h");
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, reload } = useFetch(
    () => settle([dashboardService.kpi(), dashboardService.trend(RANGE_LIMIT[range]), dashboardService.riskSummary()] as const),
    [range]
  );
  const [kpi, trend = [], risk] = data || [];
  const chartData = aggregateByHour(trend, ["power", "solar_power", "voltage", "battery_level", "current"]);

  const riskRows = [
    { key: "high", value: risk?.high ?? 0, color: "bg-destructive", text: "text-destructive" },
    { key: "medium", value: risk?.medium ?? 0, color: "bg-warning", text: "text-warning" },
    { key: "low", value: risk?.low ?? 0, color: "bg-success", text: "text-success" },
    { key: "unknown", value: risk?.unknown ?? 0, color: "bg-muted-foreground/40", text: "text-muted-foreground" },
  ];
  const riskTotal = riskRows.reduce((s, r) => s + r.value, 0) || 1;

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile("/monitoring/telemetry/export", `telemetry_${isoDate()}.csv`);
    } catch {
      toast.error(t("export_failed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardPageShell
      title={t("title")}
      subtitle={t("subtitle")}
      icon={Gauge}
      actions={
        <>
          <Button variant="outline" size="icon" onClick={reload} aria-label="Refresh">
            <RefreshCw className={isLoading ? "animate-spin" : ""} />
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />} {t("export")}
          </Button>
        </>
      }
    >
      {isLoading && !kpi ? (
        <CardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title={t("kpi.online")} value={formatNumber(kpi?.online)} icon={Wifi} iconColor="text-success" iconBg="bg-success/10" />
          <MetricCard title={t("kpi.fault")} value={formatNumber(kpi?.fault)} icon={WifiOff} iconColor="text-destructive" iconBg="bg-destructive/10" />
          <MetricCard title={t("kpi.warning")} value={formatNumber(kpi?.warning)} icon={AlertTriangle} iconColor="text-warning" iconBg="bg-warning/10" />
          <MetricCard
            title={t("kpi.uptime")}
            value={kpi?.total_lamps ? `${((kpi.online / kpi.total_lamps) * 100).toFixed(1)}%` : "—"}
            icon={Activity}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard
          className="lg:col-span-2"
          title={t("trend.title")}
          icon={Activity}
          headerAction={
            <TabSwitch
              activeTab={range}
              onTabChange={(v) => setRange(v as Range)}
              tabs={(Object.keys(RANGE_LIMIT) as Range[]).map((r) => ({ value: r, label: t(`range.${r}`) }))}
            />
          }
        >
          {chartData.length > 1 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MiniLine data={chartData} dataKey="voltage" name={t("trend.voltage")} unit=" V" color="var(--chart-1)" />
              <MiniLine data={chartData} dataKey="power" name={t("trend.power")} unit=" W" color="var(--chart-1)" />
            </div>
          ) : (
            <EmptyState icon={Activity} title={t("trend.empty")} className="py-12" />
          )}
        </SectionCard>

        <SectionCard title={t("risk.title")} icon={BrainCircuit}>
          <div className="space-y-4">
            {riskRows.map((r) => {
              const pct = Math.round((r.value / riskTotal) * 100);
              return (
                <div key={r.key}>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-muted-foreground">{t(`risk.${r.key}`)}</span>
                    <span className={`font-semibold tabular-nums ${r.text}`}>
                      {r.value} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${r.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title={t("flow.title")}
        icon={Zap}
        headerAction={<ChartLegend items={[{ label: t("flow.solar"), color: "var(--chart-1)" }, { label: t("flow.consumed"), color: "var(--chart-2)" }]} />}
      >
        {chartData.length > 1 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="monSolar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="monLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="label" {...CHART_AXIS} minTickGap={40} />
                <YAxis {...CHART_AXIS} unit=" W" width={56} domain={[0, "auto"]} />
                <Tooltip content={<ChartTooltip unit=" W" />} cursor={{ stroke: "var(--border)" }} />
                <Area type="monotone" dataKey="solar_power" name={t("flow.solar")} stroke="var(--chart-1)" strokeWidth={2} fill="url(#monSolar)" connectNulls />
                <Area type="monotone" dataKey="power" name={t("flow.consumed")} stroke="var(--chart-2)" strokeWidth={2} fill="url(#monLoad)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon={Zap} title={t("flow.empty")} className="py-12" />
        )}
      </SectionCard>
    </DashboardPageShell>
  );
}
