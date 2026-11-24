"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, BellRing, BrainCircuit, MapPin, Wifi, type LucideIcon } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { cn, formatDecimal, timeAgo } from "@/src/lib/utils";
import { useIssueLabels } from "@/src/features/lamps/hooks/useIssueLabels";
import { format } from "date-fns";
import type { OverviewHour, OverviewLamp } from "../services/dashboardService";

/** Data older than this is shown as "no new data" instead of live. */
const LIVE_WINDOW_MS = 15 * 60 * 1000;

/* Colours on the night-navy panel: same values the landing page uses on #0a1a3f. */
const GOOD = "#a3bf5b";
const MID = "#f5b700";
const BAD = "#f87171";
const tone = (v: number | null | undefined) => (v == null ? "rgba(255,255,255,0.35)" : v >= 70 ? GOOD : v >= 40 ? MID : BAD);
const RISK_TONE: Record<string, string> = { high: BAD, medium: MID, low: GOOD };

/** Current time, ticking every 30 s, so "live" turns stale without a reload. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function needsAttention(lamp: OverviewLamp) {
  return lamp.risk_level === "high" || lamp.risk_level === "medium" || ["fault", "warning", "offline"].includes(lamp.status);
}

function HealthGauge({ value, label }: { value: number | null; label: string }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
        <motion.circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={tone(value)}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-semibold tabular-nums text-white">
          {value == null ? "—" : formatDecimal(value, 0)}
          {value != null && <span className="text-base font-medium text-white/60">%</span>}
        </span>
        <span className="mt-0.5 max-w-[4.5rem] text-[11px] leading-tight text-white/60">{label}</span>
      </div>
    </div>
  );
}

function Chip({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/85">
      <Icon className="h-3.5 w-3.5 text-sun" />
      {children}
    </span>
  );
}

function Bar({ value, color }: { value: number | null; color: string }) {
  return (
    <div className="h-1 rounded-full bg-white/10">
      {value != null && (
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      )}
    </div>
  );
}

/** The lamp that most needs a look, styled like the telemetry callout on the landing page. */
function Spotlight({ lamp }: { lamp: OverviewLamp }) {
  const t = useTranslations("DashboardHome.hero");
  const tStatus = useTranslations("StatusBadge");
  const { issueTitle } = useIssueLabels();
  const online = lamp.status === "online";
  const reserve =
    lamp.days_to_failure != null
      ? t("spot_days", { value: lamp.days_to_failure })
      : lamp.autonomy_nights != null
        ? t("spot_nights", { value: formatDecimal(lamp.autonomy_nights, 1) })
        : "—";

  return (
    <div className="w-full rounded-xl border border-white/10 bg-white/[0.06] text-white backdrop-blur-md lg:w-72">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-white/45">{t(needsAttention(lamp) ? "spot_title_attention" : "spot_title")}</p>
          <p className="mt-0.5 truncate font-mono text-sm font-semibold">{lamp.lamp_code}</p>
          {lamp.place_name && (
            <p className="flex items-center gap-1 truncate text-[11px] text-white/50">
              <MapPin className="h-3 w-3 shrink-0" /> {lamp.place_name}
            </p>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px]" style={{ color: online ? GOOD : MID }}>
          <span className={cn("h-1.5 w-1.5 rounded-full", online && "animate-pulse")} style={{ background: online ? GOOD : MID }} />
          {tStatus.has(lamp.status) ? tStatus(lamp.status) : lamp.status}
        </span>
      </div>
      <div className="space-y-2.5 px-4 py-3">
        {[
          { label: t("spot_battery"), value: lamp.battery_soc, color: "var(--sun)" },
          { label: t("spot_health"), value: lamp.health_score, color: tone(lamp.health_score) },
        ].map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex justify-between text-[11px]">
              <span className="text-white/55">{row.label}</span>
              <span className="font-mono text-white/90">{row.value != null ? `${formatDecimal(row.value, 0)}%` : "—"}</span>
            </div>
            <Bar value={row.value} color={row.color} />
          </div>
        ))}
        <p className="truncate pt-0.5 text-[11px] text-white/70">
          {lamp.top_issue ? issueTitle(lamp.top_issue.code) : lamp.ml_ready ? t("spot_no_issue") : t("spot_waiting")}
        </p>
      </div>
      <div className="grid grid-cols-2 border-t border-white/10 text-[11px]">
        <div className="border-r border-white/10 px-4 py-2.5">
          <p className="text-white/50">{t("spot_risk")}</p>
          <p className="font-mono font-semibold" style={{ color: RISK_TONE[lamp.risk_level ?? ""] ?? "rgba(255,255,255,0.7)" }}>
            {lamp.risk_level && tStatus.has(lamp.risk_level) ? tStatus(lamp.risk_level) : "—"}
          </p>
        </div>
        <div className="px-4 py-2.5">
          <p className="text-white/50">{t("spot_reserve")}</p>
          <p className="font-mono font-semibold">{reserve}</p>
        </div>
      </div>
      <Link
        href={`/workspace/lamps/${lamp.id}`}
        className="flex items-center justify-center gap-1 border-t border-white/10 px-4 py-2 text-xs font-medium text-sun hover:bg-white/[0.04]"
      >
        {t("spot_open")} <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

const NIGHT_LUX = 50; // same night threshold as the energy chart
const LED = "224, 231, 255"; // cool white of the LED
const SUN = "245, 183, 0";

/** Two rows of 24 hourly cells: daylight (lux) and lamp activity (power), so the dusk-to-dawn cycle shows at a glance. */
function DayRhythm({ hourly }: { hourly: OverviewHour[] }) {
  const t = useTranslations("DashboardHome.hero");
  const maxLoad = Math.max(0, ...hourly.map((h) => h.load_w ?? 0));
  const ticks = [0, 6, 12, 18, hourly.length - 1].filter((i, k, a) => i >= 0 && i < hourly.length && a.indexOf(i) === k);

  const sunCell = (h: OverviewHour) => {
    if (h.lux == null) return undefined;
    if (h.lux < NIGHT_LUX) return "rgba(255,255,255,0.05)";
    const level = Math.sqrt(Math.min(h.lux, 30000) / 30000);
    return `rgba(${SUN}, ${(0.25 + 0.75 * level).toFixed(2)})`;
  };
  const lampCell = (h: OverviewHour) => {
    if (h.load_w == null) return undefined;
    if (h.load_w < 0.02 || maxLoad <= 0) return "rgba(255,255,255,0.05)";
    return `rgba(${LED}, ${(0.3 + 0.7 * (h.load_w / maxLoad)).toFixed(2)})`;
  };
  const rows = [
    { key: "sun", label: t("rhythm_sun"), cell: sunCell },
    { key: "lamp", label: t("rhythm_lamp"), cell: lampCell },
  ];

  return (
    <div className="mt-5 max-w-2xl">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/45">{t("rhythm_title")}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] text-white/55">{row.label}</span>
            <div className="grid flex-1 gap-[3px]" style={{ gridTemplateColumns: `repeat(${hourly.length}, minmax(0, 1fr))` }}>
              {hourly.map((h, i) => {
                const color = row.cell(h);
                const time = format(new Date(h.time), "HH:mm");
                const value =
                  row.key === "sun"
                    ? h.lux != null ? `${Math.round(h.lux)} lx` : t("rhythm_gap")
                    : h.load_w != null ? `${h.load_w.toFixed(2)} W` : t("rhythm_gap");
                return (
                  <motion.span
                    key={h.time}
                    title={`${time} · ${row.label}: ${value}`}
                    className={cn("h-3.5 rounded-[3px]", color == null && "border border-dashed border-white/15")}
                    style={{ background: color }}
                    initial={{ opacity: 0, scaleY: 0.3 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ duration: 0.35, delay: 0.3 + i * 0.015 }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        <span className="w-16 shrink-0" />
        <div className="relative h-3 flex-1 font-mono text-[10px] text-white/40">
          {ticks.map((i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2"
              style={{ left: `${((i + 0.5) / hourly.length) * 100}%` }}
            >
              {format(new Date(hourly[i].time), "HH:mm")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface FleetHeroProps {
  lamps: OverviewLamp[];
  hourly: OverviewHour[];
  lastDataAt: string | null;
  unresolvedAlerts: number;
}

/** Night-navy status banner: fleet health, the headline for today, and the most urgent lamp. */
export function FleetHero({ lamps, hourly, lastDataAt, unresolvedAlerts }: FleetHeroProps) {
  const t = useTranslations("DashboardHome.hero");
  const locale = useLocale();
  const { issueTitle } = useIssueLabels();

  const total = lamps.length;
  const online = lamps.filter((l) => l.status === "online").length;
  const analysed = lamps.filter((l) => l.predicted_at).length;
  const attention = lamps.filter(needsAttention);
  const scores = lamps.map((l) => l.health_score).filter((v): v is number => v != null);
  const health = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : null;
  const top = lamps[0];
  const now = useNow();
  const live = lastDataAt != null && now - new Date(lastDataAt).getTime() < LIVE_WINDOW_MS;

  const headline = total === 0 ? t("no_lamps") : attention.length === 0 ? t("all_good") : t("attention", { count: attention.length });
  const detail =
    total === 0
      ? t("no_lamps_desc")
      : attention.length === 0
        ? analysed > 0
          ? t("all_good_desc")
          : t("waiting_desc")
        : t("attention_desc", {
            code: attention[0].lamp_code,
            issue: attention[0].top_issue ? issueTitle(attention[0].top_issue.code) : t(`reason.${attention[0].status}`),
          });

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#163a7f_0%,#0f2557_42%,#0a1a3f_100%)] text-white shadow-sm"
    >
      {/* lamp glow: a soft warm cone from the top right, like a street light over the panel */}
      <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(245,183,0,0.32)_0%,rgba(245,183,0,0.08)_45%,transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

      <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:p-7">
        <HealthGauge value={health} label={t("gauge")} />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/55">
            <span className={cn("h-2 w-2 rounded-full", live ? "animate-pulse bg-[#a3bf5b]" : "bg-white/35")} />
            {lastDataAt ? t(live ? "live" : "stale", { time: timeAgo(lastDataAt, locale) }) : t("no_data")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-white sm:text-[1.7rem]">{headline}</h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-white/65">{detail}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip icon={Wifi}>{t("chip_online", { online, total })}</Chip>
            <Chip icon={BellRing}>{t("chip_alerts", { count: unresolvedAlerts })}</Chip>
            <Chip icon={BrainCircuit}>{t("chip_ml", { analysed, total })}</Chip>
          </div>
          {hourly.some((h) => h.lux != null || h.load_w != null) && <DayRhythm hourly={hourly} />}
        </div>

        {top && <Spotlight lamp={top} />}
      </div>
    </motion.section>
  );
}
