"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { LightbulbOff, Route, BatteryWarning, FileQuestion } from "lucide-react";
import { cn } from "@/src/lib/utils";

// Sumbu waktu satu lampu: H-14 … H+5 (hari relatif terhadap saat lampu padam di skenario reaktif)
const START = -14;
const END = 5;
const pos = (day: number) => `${((day - START) / (END - START)) * 100}%`;
const TICKS = [-14, -10, -7, -5, 0, 3, 5];

type Marker = { day: number; key: string; tone: "muted" | "danger" | "royal" | "sun" | "eco"; below?: boolean };
type Band = { from: number; to: number; tone: "dark" | "lit" | "fade" };

const LANES: { id: "reactive" | "predictive"; bands: Band[]; markers: Marker[] }[] = [
  {
    id: "reactive",
    bands: [
      { from: -14, to: 0, tone: "fade" },
      { from: 0, to: 5, tone: "dark" },
    ],
    markers: [
      { day: -14, key: "degrading", tone: "muted" },
      { day: 0, key: "lamp_off", tone: "danger" },
      { day: 3, key: "citizen_report", tone: "muted", below: true },
      { day: 5, key: "repaired_late", tone: "muted" },
    ],
  },
  {
    id: "predictive",
    bands: [
      { from: -14, to: -5, tone: "fade" },
      { from: -5, to: 5, tone: "lit" },
    ],
    markers: [
      { day: -14, key: "detected", tone: "royal" },
      { day: -10, key: "alert", tone: "sun", below: true },
      { day: -7, key: "ticket", tone: "royal" },
      { day: -5, key: "repaired_early", tone: "eco", below: true },
    ],
  },
];

const DOT: Record<Marker["tone"], string> = {
  muted: "bg-muted-foreground",
  danger: "bg-destructive",
  royal: "bg-royal",
  sun: "bg-sun",
  eco: "bg-success",
};

const BAND: Record<Band["tone"], string> = {
  fade: "bg-muted-foreground/15",
  dark: "bg-[repeating-linear-gradient(135deg,#1c2541_0_6px,#2c3658_6px_12px)]",
  lit: "bg-sun/70",
};

const PAINS = [
  { id: "late_detection", Icon: LightbulbOff },
  { id: "manual_patrol", Icon: Route },
  { id: "battery_degradation", Icon: BatteryWarning },
  { id: "no_data", Icon: FileQuestion },
] as const;

function Timeline() {
  const t = useTranslations("ProblemSection.timeline");

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <div className="min-w-[760px] px-6 py-8 sm:px-8">
        {LANES.map((lane, li) => (
          <div key={lane.id} className={cn("grid grid-cols-[150px_1fr_110px] items-center gap-6", li > 0 && "mt-14")}>
            <div>
              <p className="text-sm font-semibold text-foreground">{t(`${lane.id}.title`)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t(`${lane.id}.desc`)}</p>
            </div>

            <div className="relative h-24">
              {/* pita kondisi lampu */}
              <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-muted overflow-hidden">
                {lane.bands.map((b, bi) => (
                  <motion.span
                    key={bi}
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.15 + bi * 0.5 + li * 0.3 }}
                    style={{ left: pos(b.from), width: `calc(${pos(b.to)} - ${pos(b.from)})`, transformOrigin: "left" }}
                    className={cn("absolute inset-y-0", BAND[b.tone])}
                  />
                ))}
              </div>
              {lane.markers.map((m, mi) => (
                <motion.div
                  key={m.key}
                  initial={{ opacity: 0, y: m.below ? -6 : 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: 0.4 + mi * 0.25 + li * 0.3 }}
                  style={{ left: pos(m.day) }}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  <span className={cn("block h-3.5 w-3.5 rounded-full ring-4 ring-card", DOT[m.tone])} />
                  <span
                    className={cn(
                      "absolute whitespace-nowrap text-[11px] font-medium text-foreground",
                      // label di ujung sumbu diratakan ke dalam agar tidak keluar dari lajur
                      m.day === START ? "left-0" : m.day === END ? "right-0" : "left-1/2 -translate-x-1/2",
                      m.below ? "top-6" : "bottom-6"
                    )}
                  >
                    {t(`events.${m.key}`)}
                  </span>
                </motion.div>
              ))}
            </div>

            <div className="text-right">
              <p className={cn("font-mono text-3xl font-semibold", lane.id === "reactive" ? "text-destructive" : "text-success")}>
                {lane.id === "reactive" ? "5" : "0"}
              </p>
              <p className="text-xs text-muted-foreground">{t("dark_nights")}</p>
            </div>
          </div>
        ))}

        {/* sumbu hari */}
        <div className="mt-8 grid grid-cols-[150px_1fr_110px] gap-6">
          <span />
          <div className="relative h-5 border-t border-border">
            {TICKS.map((d) => (
              <span key={d} style={{ left: pos(d) }} className="absolute top-1.5 -translate-x-1/2 font-mono text-[10px] text-muted-foreground">
                {d === 0 ? t("day_zero") : d > 0 ? `H+${d}` : `H${d}`}
              </span>
            ))}
          </div>
          <span />
        </div>
      </div>
    </div>
  );
}

export const ProblemSection = () => {
  const t = useTranslations("ProblemSection");

  return (
    <section id="about" className="relative py-24 lg:py-32 bg-background scroll-mt-16">
      <div className="container mx-auto px-6 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-12 grid gap-6 lg:grid-cols-2 lg:items-end"
        >
          <h2 className="text-3xl md:text-5xl font-heading font-bold tracking-tight leading-[1.1] text-foreground">
            <span className="text-primary underline decoration-sun decoration-[5px] underline-offset-[10px]">{t("title_highlight")}</span> {t("title_rest")}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed lg:pb-1">{t("description")}</p>
        </motion.div>

        <Timeline />

        <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {PAINS.map(({ id, Icon }, i) => (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="border-t-2 border-sun pt-5"
            >
              <Icon className="mb-3 h-5 w-5 text-royal" />
              <h3 className="text-base font-semibold text-foreground">{t(`items.${id}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`items.${id}.desc`)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
