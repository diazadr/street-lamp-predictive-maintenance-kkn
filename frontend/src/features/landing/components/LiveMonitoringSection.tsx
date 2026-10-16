"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Lightbulb, Wifi, BatteryCharging, BellRing, Leaf, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePublicDashboard } from "../hooks/usePublicDashboard";
import { CHART_AXIS, CHART_GRID, ChartLegend, ChartTooltip } from "@/src/components/ui/dashboard/ChartParts";

export const LiveMonitoringSection = () => {
  const t = useTranslations("LiveMonitoringSection");
  const { isLive, kpi, energy, energyFlow } = usePublicDashboard();

  const onlineRate = kpi.total_lamps ? Math.round(((kpi.online_lamps || 0) / kpi.total_lamps) * 100) : 0;
  const tiles = [
    { Icon: Lightbulb, label: t("kpi.total"), value: kpi.total_lamps ?? "—" },
    { Icon: Wifi, label: t("kpi.online"), value: `${onlineRate}%` },
    { Icon: BatteryCharging, label: t("kpi.battery"), value: `${(kpi.avg_battery_level ?? 0).toFixed(0)}%` },
    { Icon: BellRing, label: t("kpi.alerts"), value: kpi.unresolved_alerts ?? 0 },
  ];

  return (
    <section id="live" className="py-24 lg:py-32 bg-background relative overflow-hidden">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="max-w-2xl">
            <h2 className="text-4xl lg:text-5xl font-heading font-bold text-foreground leading-tight tracking-tight mb-4">
              {t("title_part1")} <span className="text-accent-ink">{t("title_highlight")}</span>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">{t("description")}</p>
          </motion.div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${isLive ? "bg-success animate-pulse" : "bg-muted-foreground/60"}`} />
            {isLive ? t("live") : t("demo")}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {tiles.map(({ Icon, label, value }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="text-3xl font-semibold text-foreground tabular-nums">{value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-base font-semibold text-foreground">{t("chart_title")}</p>
              <ChartLegend items={[{ label: t("solar"), color: "var(--chart-1)" }, { label: t("consumed"), color: "var(--chart-2)" }]} />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={energyFlow} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lmSolar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="lmLoad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="hour" {...CHART_AXIS} tickFormatter={(h) => `${h}:00`} />
                  <YAxis {...CHART_AXIS} unit=" W" width={56} />
                  <Tooltip content={<ChartTooltip unit=" W" digits={0} />} cursor={{ stroke: "var(--border)" }} />
                  <Area type="monotone" dataKey="generated" name={t("solar")} stroke="var(--chart-1)" strokeWidth={2} fill="url(#lmSolar)" activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="consumed" name={t("consumed")} stroke="var(--chart-2)" strokeWidth={2} fill="url(#lmLoad)" activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-primary/20 bg-primary text-primary-foreground p-6 shadow-sm flex flex-col justify-between gap-6"
          >
            <div>
              <Leaf className="h-6 w-6 mb-4 opacity-80" />
              <p className="text-sm opacity-80">{t("impact_title")}</p>
              <p className="text-4xl font-bold mt-1 tabular-nums">
                {(energy.co2Saved ?? 0).toFixed(1)} <span className="text-lg font-semibold">kg CO₂</span>
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-t border-white/15 pt-3">
                <span className="opacity-80 flex items-center gap-2"><Zap className="h-4 w-4" /> {t("generated")}</span>
                <span className="font-semibold tabular-nums">{((energy.dailyGenerated ?? 0) / 1000).toFixed(2)} kWh</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/15 pt-3">
                <span className="opacity-80">{t("efficiency")}</span>
                <span className="font-semibold tabular-nums">{(energy.efficiency ?? 0).toFixed(0)}%</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
