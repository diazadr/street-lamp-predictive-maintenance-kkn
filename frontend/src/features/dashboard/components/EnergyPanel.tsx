"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Activity } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SectionCard } from "@/src/components/ui/dashboard/SectionCard";
import { EmptyState } from "@/src/components/ui/dashboard/EmptyState";
import { TabSwitch } from "@/src/components/ui/dashboard/TabSwitch";
import { CHART_AXIS, CHART_GRID, ChartLegend, ChartTooltip } from "@/src/components/ui/dashboard/ChartParts";
import { cn } from "@/src/lib/utils";
import type { OverviewHour } from "../services/dashboardService";

type Tab = "power" | "battery" | "environment";
/** Below this light level (lux, hourly mean) the hour counts as night and is shaded. */
const NIGHT_LUX = 50;
const MARGIN = { top: 8, right: 8, left: -12, bottom: 0 };

type Row = OverviewHour & { label: string };

/** Runs of consecutive night hours, for the shaded bands behind the lines. */
function nightBands(rows: Row[]) {
  const bands: { x1: string; x2: string }[] = [];
  let start: string | null = null;
  rows.forEach((row, i) => {
    const night = row.lux != null && row.lux < NIGHT_LUX;
    if (night && start == null) start = row.label;
    const last = i === rows.length - 1 || !(rows[i + 1].lux != null && (rows[i + 1].lux as number) < NIGHT_LUX);
    if (night && last && start != null) {
      bands.push({ x1: start, x2: row.label });
      start = null;
    }
  });
  return bands;
}

/** Shaded night bands; returned as plain chart children so Recharts picks them up. */
function renderBands(bands: { x1: string; x2: string }[]) {
  return bands.map((b) => (
    <ReferenceArea key={b.x1} x1={b.x1} x2={b.x2} fill="var(--chart-5)" fillOpacity={0.14} stroke="none" ifOverflow="hidden" />
  ));
}

const tick = (v: string) => v.slice(-5);

/** Axis domain and ticks on whole multiples of `step` around the data. */
function niceAxis(values: (number | null)[], pickStep: (range: number) => number) {
  const data = values.filter((v): v is number => v != null);
  if (!data.length) return {};
  const min = Math.min(...data);
  const max = Math.max(...data);
  const step = pickStep(max - min);
  const lo = Math.floor(min / step) * step;
  const hi = Math.max(Math.ceil(max / step) * step, lo + step);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(2)));
  return { domain: [lo, hi] as [number, number], ticks };
}

const voltageStep = (range: number) => (range > 3 ? 1 : range > 1 ? 0.5 : range > 0.4 ? 0.2 : 0.1);
const temperatureStep = (range: number) => (range > 15 ? 5 : range > 6 ? 2 : 1);
const luxTick = (v: number) => (v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : String(v));

export function EnergyPanel({ hourly, windowEnd, className }: { hourly: OverviewHour[]; windowEnd?: string; className?: string }) {
  const t = useTranslations("DashboardHome.energy");
  const [tab, setTab] = useState<Tab>("power");

  const rows: Row[] = hourly.map((h) => ({ ...h, label: format(new Date(h.time), "dd/MM HH:mm") }));
  const hasData = rows.some((r) => r.solar_w != null || r.load_w != null || r.bus_v != null);
  const bands = nightBands(rows);
  const axis = { ...CHART_AXIS, dataKey: "label", tickFormatter: tick, minTickGap: 28 } as const;
  const voltageAxis = niceAxis(rows.map((r) => r.bus_v), voltageStep);
  const temperatureAxis = niceAxis(rows.map((r) => r.temp_c), temperatureStep);

  return (
    <SectionCard
      // grows with the card next to it in the row; the charts take the extra height
      className={cn("flex flex-col", className)}
      contentClassName="flex flex-1 flex-col"
      title={t("title")}
      description={windowEnd ? t("window", { end: format(new Date(windowEnd), "dd/MM HH:mm") }) : undefined}
      icon={Activity}
      headerAction={
        <TabSwitch
          className="hidden sm:flex"
          activeTab={tab}
          onTabChange={(v) => setTab(v as Tab)}
          tabs={(["power", "battery", "environment"] as Tab[]).map((v) => ({ value: v, label: t(`tabs.${v}`) }))}
        />
      }
    >
      <TabSwitch
        className="mb-4 sm:hidden"
        activeTab={tab}
        onTabChange={(v) => setTab(v as Tab)}
        tabs={(["power", "battery", "environment"] as Tab[]).map((v) => ({ value: v, label: t(`tabs.${v}`) }))}
      />
      {!hasData ? (
        <EmptyState icon={Activity} title={t("empty")} className="py-12" />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <ChartLegend
              items={
                tab === "power"
                  ? [
                      { label: t("solar"), color: "var(--chart-1)" },
                      { label: t("load"), color: "var(--chart-2)" },
                    ]
                  : tab === "battery"
                    ? [{ label: t("bus_v"), color: "var(--chart-3)" }]
                    : [
                        { label: t("lux"), color: "var(--chart-1)" },
                        { label: t("temp"), color: "var(--chart-4)" },
                      ]
              }
            />
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-3 rounded-sm bg-chart-5/30" /> {t("night")}
            </span>
          </div>

          {tab === "power" && (
            <div className="min-h-64 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rows} margin={MARGIN}>
                  <defs>
                    <linearGradient id="dhSolar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dhLoad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...CHART_GRID} />
                  {renderBands(bands)}
                  <XAxis {...axis} />
                  <YAxis {...CHART_AXIS} unit=" W" width={56} domain={[0, "auto"]} />
                  <Tooltip content={<ChartTooltip unit=" W" digits={2} />} cursor={{ stroke: "var(--border)" }} />
                  <Area type="monotone" dataKey="solar_w" name={t("solar")} stroke="var(--chart-1)" strokeWidth={2} fill="url(#dhSolar)" activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="load_w" name={t("load")} stroke="var(--chart-2)" strokeWidth={2} fill="url(#dhLoad)" activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {tab === "power" && <p className="mt-3 text-xs text-muted-foreground">{t("solar_note")}</p>}

          {tab === "battery" && (
            <>
              <div className="min-h-64 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows} margin={MARGIN}>
                    <CartesianGrid {...CHART_GRID} />
                    {renderBands(bands)}
                    <XAxis {...axis} />
                    <YAxis {...CHART_AXIS} {...voltageAxis} unit=" V" width={56} tickFormatter={(v: number) => v.toFixed(1)} />
                    <Tooltip content={<ChartTooltip unit=" V" digits={2} />} cursor={{ stroke: "var(--border)" }} />
                    <Line type="monotone" dataKey="bus_v" name={t("bus_v")} stroke="var(--chart-3)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t("bus_v_note")}</p>
            </>
          )}

          {tab === "environment" && (
            <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-2">
              <div className="h-60 md:h-full md:min-h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={rows} margin={MARGIN} syncId="dhEnv">
                    <defs>
                      <linearGradient id="dhLux" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...CHART_GRID} />
                    {renderBands(bands)}
                    <XAxis {...axis} />
                    <YAxis {...CHART_AXIS} width={56} domain={[0, "auto"]} tickFormatter={luxTick} />
                    <Tooltip content={<ChartTooltip unit=" lx" digits={0} />} cursor={{ stroke: "var(--border)" }} />
                    <Area type="monotone" dataKey="lux" name={t("lux")} stroke="var(--chart-1)" strokeWidth={2} fill="url(#dhLux)" activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="h-60 md:h-full md:min-h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows} margin={MARGIN} syncId="dhEnv">
                    <CartesianGrid {...CHART_GRID} />
                    {renderBands(bands)}
                    <XAxis {...axis} />
                    <YAxis {...CHART_AXIS} {...temperatureAxis} unit="°C" width={56} tickFormatter={(v: number) => v.toFixed(0)} />
                    <Tooltip content={<ChartTooltip unit=" °C" digits={1} />} cursor={{ stroke: "var(--border)" }} />
                    <Line type="monotone" dataKey="temp_c" name={t("temp")} stroke="var(--chart-4)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
