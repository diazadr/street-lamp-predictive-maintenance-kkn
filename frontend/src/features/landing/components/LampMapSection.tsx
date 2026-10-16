"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { BatteryMedium, HeartPulse, MapPin, ShieldAlert, SunMedium } from "lucide-react";
import { STATUS_COLORS } from "@/src/features/map/components/mapConfig";
import { cn } from "@/src/lib/utils";
import { usePublicLamps } from "../hooks/usePublicLamps";
import type { PublicLamp } from "../services/publicService";

const PublicLampMap = dynamic(() => import("./map/PublicLampMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

const FILTERS = ["all", "online", "warning", "fault", "offline"] as const;
type Filter = (typeof FILTERS)[number];

// maintenance dikelompokkan bersama offline: sama-sama tidak menyala normal
const matches = (lamp: PublicLamp, f: Filter) =>
  f === "all" || (f === "offline" ? lamp.status === "offline" || lamp.status === "maintenance" : lamp.status === f);

const RISK_TONE: Record<string, string> = {
  low: "text-success",
  medium: "text-warning",
  high: "text-destructive",
};

const batteryTone = (v: number | null) => (v == null ? "bg-muted-foreground/40" : v < 20 ? "bg-destructive" : v < 40 ? "bg-warning" : "bg-success");
const fmt = (v: number | null, unit = "") => (v == null ? "—" : `${Math.round(v)}${unit}`);

function StatusDot({ status, className }: { status: string; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)} style={{ background: STATUS_COLORS[status] || STATUS_COLORS.offline }} />;
}

function LampDetail({ lamp }: { lamp: PublicLamp }) {
  const t = useTranslations("LampMapSection");
  const payload = {
    lamp_code: lamp.code,
    status: lamp.status,
    battery_level: lamp.battery,
    brightness: lamp.brightness,
    health_score: lamp.health_score,
    risk_level: lamp.risk_level,
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card">
      <div className="border-b border-border p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">{lamp.code}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {lamp.place || t("no_place")}
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <StatusDot status={lamp.status} />
            {t(`status.${lamp.status}`)}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border">
        <div className="p-4">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><BatteryMedium className="h-3.5 w-3.5" /> {t("battery")}</dt>
          <dd className="mt-1 font-mono text-lg font-semibold">{fmt(lamp.battery, "%")}</dd>
          <div className="mt-2 h-1 rounded-full bg-muted">
            <div className={cn("h-full rounded-full transition-all", batteryTone(lamp.battery))} style={{ width: `${lamp.battery ?? 0}%` }} />
          </div>
        </div>
        <div className="p-4">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><SunMedium className="h-3.5 w-3.5" /> {t("brightness")}</dt>
          <dd className="mt-1 font-mono text-lg font-semibold">{fmt(lamp.brightness, "%")}</dd>
        </div>
        <div className="p-4">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><HeartPulse className="h-3.5 w-3.5" /> {t("health")}</dt>
          <dd className="mt-1 font-mono text-lg font-semibold">{fmt(lamp.health_score)}</dd>
        </div>
        <div className="p-4">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5" /> {t("risk")}</dt>
          <dd className={cn("mt-1 text-lg font-semibold", RISK_TONE[lamp.risk_level || ""] || "text-muted-foreground")}>
            {t(`risk_level.${lamp.risk_level && ["low", "medium", "high"].includes(lamp.risk_level) ? lamp.risk_level : "unknown"}`)}
          </dd>
        </div>
      </dl>

      <div className="flex-1 p-5">
        <p className="mb-2 text-xs font-medium text-muted-foreground">{t("payload")}</p>
        <pre className="overflow-x-auto rounded-lg bg-[#0a1a3f] p-3.5 font-mono text-[11.5px] leading-relaxed text-sun-light/90">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export const LampMapSection = () => {
  const t = useTranslations("LampMapSection");
  const { lamps, isLive } = usePublicLamps();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f, lamps.filter((l) => matches(l, f)).length])) as Record<Filter, number>, [lamps]);
  const visible = useMemo(() => lamps.filter((l) => matches(l, filter)), [lamps, filter]);

  // default: lampu bermasalah pertama — lebih informatif daripada lampu normal
  const selected =
    lamps.find((l) => l.code === selectedCode) ??
    lamps.find((l) => l.status === "fault") ??
    lamps.find((l) => l.status === "warning") ??
    lamps[0] ??
    null;

  return (
    <section id="map" className="relative py-24 lg:py-28 bg-muted/30 border-y border-border scroll-mt-16">
      <div className="container mx-auto px-6 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="max-w-2xl">
            <h2 className="text-3xl lg:text-5xl font-heading font-bold tracking-tight text-foreground leading-[1.1]">{t("title")}</h2>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">{t("description")}</p>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", isLive ? "bg-success animate-pulse" : "bg-muted-foreground/60")} />
            {isLive ? t("source_live", { count: lamps.length }) : t("source_demo")}
          </p>
        </motion.div>

        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label={t("filter_label")}>
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors cursor-pointer",
                filter === f ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {f !== "all" && <StatusDot status={f} />}
              {t(`filter.${f}`)}
              <span className="font-mono text-xs opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="relative h-[380px] overflow-hidden rounded-2xl border border-border bg-card lg:col-span-8 lg:h-[540px] isolate">
            <PublicLampMap lamps={visible} selected={selected} onSelect={(l) => setSelectedCode(l.code)} />
            <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-background/90 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur">
              {(["online", "warning", "fault", "offline", "maintenance"] as const).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <StatusDot status={s} /> {t(`status.${s}`)}
                </span>
              ))}
            </div>
          </div>
          <div className="lg:col-span-4">{selected && <LampDetail lamp={selected} />}</div>
        </div>

        {/* contoh data per lampu */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="max-h-80 overflow-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 font-medium">{t("table.code")}</th>
                  <th className="px-5 py-3 font-medium">{t("table.place")}</th>
                  <th className="px-5 py-3 font-medium">{t("table.status")}</th>
                  <th className="px-5 py-3 font-medium">{t("battery")}</th>
                  <th className="px-5 py-3 font-medium">{t("health")}</th>
                  <th className="px-5 py-3 font-medium">{t("risk")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((l) => (
                  <tr
                    key={l.code}
                    onClick={() => setSelectedCode(l.code)}
                    className={cn(
                      "cursor-pointer border-b border-border/60 last:border-0 transition-colors hover:bg-muted/50",
                      selected?.code === l.code && "bg-primary/5"
                    )}
                  >
                    <td className="px-5 py-2.5 font-mono font-medium text-foreground">{l.code}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{l.place || "—"}</td>
                    <td className="px-5 py-2.5">
                      <span className="flex items-center gap-1.5"><StatusDot status={l.status} /> {t(`status.${l.status}`)}</span>
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="h-1 w-14 rounded-full bg-muted">
                          <span className={cn("block h-full rounded-full", batteryTone(l.battery))} style={{ width: `${l.battery ?? 0}%` }} />
                        </span>
                        <span className="font-mono text-xs">{fmt(l.battery, "%")}</span>
                      </span>
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs">{fmt(l.health_score)}</td>
                    <td className={cn("px-5 py-2.5 text-xs font-medium", RISK_TONE[l.risk_level || ""] || "text-muted-foreground")}>
                      {t(`risk_level.${l.risk_level && ["low", "medium", "high"].includes(l.risk_level) ? l.risk_level : "unknown"}`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
