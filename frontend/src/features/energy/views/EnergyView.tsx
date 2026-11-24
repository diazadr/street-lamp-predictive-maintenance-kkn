"use client";

import { useTranslations } from "next-intl";
import { Leaf, RefreshCw, TrendingUp, Zap, Sun, Coins, TreePine } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { MetricCard } from "@/src/components/ui/dashboard/MetricCard";
import { SectionCard } from "@/src/components/ui/dashboard/SectionCard";
import { CardSkeleton } from "@/src/components/ui/dashboard/LoadingSkeleton";
import { EmptyState } from "@/src/components/ui/dashboard/EmptyState";
import { CHART_AXIS, CHART_GRID, ChartLegend, ChartTooltip } from "@/src/components/ui/dashboard/ChartParts";
import { Button } from "@/src/components/ui/button";
import { aggregateByHour, formatDecimal, formatEnergy, formatMass, formatRupiah } from "@/src/lib/utils";
import { settle, useFetch } from "@/src/hooks/useFetch";
import { energyService } from "../services/energyService";

const CO2_PER_KWH = 0.85;
const CO2_PER_TREE = 21.77;

/** Trees that absorb this much CO2 in a year; "< 0.01" for one lamp's few grams. */
const treeCount = (co2Kg: number) => {
  const trees = co2Kg / CO2_PER_TREE;
  return trees < 0.01 ? "< 0.01" : formatDecimal(trees, trees < 10 ? 2 : 0);
};

export function EnergyView() {
  const t = useTranslations("Energy");
  const { data, isLoading, reload } = useFetch(() => settle([energyService.summary(), energyService.flow(), energyService.costComparison()] as const), []);
  const [summary, flow = [], cost] = data || [];
  const chartData = aggregateByHour(flow, ["solar_power", "load_power"]);
  const hasFlow = chartData.some((p) => p.solar_power != null || p.load_power != null);

  const co2Today = summary?.solar_generated_today != null ? summary.solar_generated_today * CO2_PER_KWH : null;
  const co2Total = summary?.co2_avoided_kg ?? null;

  return (
    <DashboardPageShell
      title={t("title")}
      subtitle={t("subtitle")}
      icon={Zap}
      actions={
        <Button variant="outline" size="icon" onClick={reload} aria-label="Refresh">
          <RefreshCw className={isLoading ? "animate-spin" : ""} />
        </Button>
      }
    >
      {isLoading && !summary ? (
        <CardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title={t("kpi.generated")} value={formatEnergy(summary?.solar_generated_today)} icon={Sun} iconColor="text-success" iconBg="bg-success/10" trend={t("today")} />
          <MetricCard title={t("kpi.consumed")} value={formatEnergy(summary?.consumed_today)} icon={TrendingUp} trend={t("today")} />
          <MetricCard
            title={t("kpi.co2")}
            value={formatMass(co2Today)}
            icon={Leaf}
            iconColor="text-success"
            iconBg="bg-success/10"
            trend={co2Today ? t("trees", { count: treeCount(co2Today) }) : undefined}
          />
          <MetricCard title={t("kpi.efficiency")} value={`${formatDecimal(summary?.efficiency_pct, 0)}%`} icon={Zap} accent />
        </div>
      )}

      <SectionCard
        title={t("flow.title")}
        icon={Zap}
        headerAction={<ChartLegend items={[{ label: t("flow.solar"), color: "var(--chart-1)" }, { label: t("flow.load"), color: "var(--chart-2)" }]} />}
      >
        {hasFlow ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="enSolar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="enLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="label" {...CHART_AXIS} minTickGap={40} />
                <YAxis {...CHART_AXIS} unit=" W" width={64} domain={[0, "auto"]} />
                <Tooltip content={<ChartTooltip unit=" W" digits={2} />} cursor={{ stroke: "var(--border)" }} />
                <Area type="monotone" dataKey="solar_power" name={t("flow.solar")} stroke="var(--chart-1)" strokeWidth={2} fill="url(#enSolar)" connectNulls />
                <Area type="monotone" dataKey="load_power" name={t("flow.load")} stroke="var(--chart-2)" strokeWidth={2} fill="url(#enLoad)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon={Zap} title={t("flow.empty")} className="py-12" />
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title={t("cost.title")} icon={Coins}>
          {cost ? (
            <div className="space-y-4">
              {[
                { label: t("cost.traditional"), value: cost.traditional_monthly_cost ?? 0, tone: "bg-muted-foreground/40" },
                { label: t("cost.smart"), value: cost.smart_monthly_cost ?? 0, tone: "bg-primary" },
              ].map((row) => {
                const max = Math.max(cost.traditional_monthly_cost || 0, cost.smart_monthly_cost || 0, 1);
                return (
                  <div key={row.label}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-semibold tabular-nums">{formatRupiah(row.value)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${row.tone}`} style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between border-t border-border pt-3 text-sm">
                <span className="font-medium">{t("cost.saving")}</span>
                <span className="font-bold text-success tabular-nums">{formatRupiah(cost.estimated_saving)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("no_data")}</p>
          )}
        </SectionCard>

        <SectionCard title={t("impact.title")} icon={TreePine}>
          <dl className="space-y-3 text-sm">
            {[
              [t("impact.co2"), formatMass(co2Total)],
              [t("impact.trees"), co2Total != null ? treeCount(co2Total) : "—"],
              [t("impact.solar"), formatEnergy(summary?.solar_generated_kwh)],
              [t("impact.lamps"), `${summary?.lamp_count ?? "—"}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border/50 pb-2.5 last:border-0 last:pb-0">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-semibold text-primary tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>
    </DashboardPageShell>
  );
}
