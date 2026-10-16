"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ArrowRight, BrainCircuit, Cpu, Radio, Wrench } from "lucide-react";

/** Contoh data di setiap langkah — menunjukkan apa yang benar-benar mengalir di sistem. */
function SensorSample() {
  const rows = [
    ["battery", "86 %"],
    ["voltage", "12.6 V"],
    ["power", "32.4 W"],
    ["lux", "3"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function TransportSample() {
  return (
    <div className="space-y-1.5 font-mono text-[11px]">
      <p className="truncate text-foreground">pju/PJU-A07/telemetry</p>
      <p className="text-muted-foreground">
        QoS 1 · <span className="text-foreground">142 ms</span>
      </p>
    </div>
  );
}

function AnalysisSample() {
  const t = useTranslations("SolutionSection.steps.analyze");
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[11px]">
        <span className="text-muted-foreground">{t("risk")}</span>
        <span className="text-warning font-semibold">58 %</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: "58%" }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.6 }}
          className="h-full rounded-full bg-warning"
        />
      </div>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        {t("eta")} <span className="text-foreground">±9 {t("days")}</span>
      </p>
    </div>
  );
}

function ActionSample() {
  const t = useTranslations("SolutionSection.steps.act");
  return (
    <div className="space-y-1.5 font-mono text-[11px]">
      <p className="text-foreground">TKT-0142 · {t("priority")}</p>
      <p className="text-muted-foreground">{t("assigned")}</p>
    </div>
  );
}

const STEPS = [
  { id: "sense", Icon: Cpu, Sample: SensorSample },
  { id: "send", Icon: Radio, Sample: TransportSample },
  { id: "analyze", Icon: BrainCircuit, Sample: AnalysisSample },
  { id: "act", Icon: Wrench, Sample: ActionSample },
] as const;

export const SolutionSection = () => {
  const t = useTranslations("SolutionSection");

  return (
    <section id="solution" className="relative py-24 lg:py-32 bg-[#0f2557] text-white overflow-hidden">
      {/* garis sirkuit tipis sebagai tekstur latar */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, #a9b8dc 1px, transparent 1px), linear-gradient(to bottom, #a9b8dc 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative container mx-auto px-6 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <h2 className="text-3xl md:text-5xl font-heading font-bold tracking-tight leading-[1.1] text-white">
            {t("title_part1")} <span className="text-sun">{t("title_part2")}</span>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-white/70 leading-relaxed">{t("description")}</p>
        </motion.div>

        <div className="relative mt-16">
          {/* jalur data yang menghubungkan langkah — titik kuning mengalir dari sensor ke tindakan */}
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-white/15 lg:block">
            <motion.span
              className="absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-sun shadow-[0_0_12px_#f5b700]"
              animate={{ left: ["0%", "100%"] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
          </div>

          <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map(({ id, Icon, Sample }, i) => (
              <motion.li
                key={id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.12 }}
                className="relative"
              >
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-[#0a1a3f] text-sun">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-5 font-mono text-xs text-white/45">0{i + 1}</p>
                <h3 className="mt-1 text-lg font-semibold text-white">{t(`steps.${id}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{t(`steps.${id}.desc`)}</p>
                {/* kartu contoh memakai permukaan terang agar data mudah dibaca */}
                <div className="mt-5 rounded-lg bg-card p-3.5 text-foreground shadow-lg shadow-black/20">
                  <Sample />
                </div>
              </motion.li>
            ))}
          </ol>
        </div>

        <a
          href="#technology"
          className="group mt-14 inline-flex items-center gap-2 text-sm font-semibold text-sun hover:text-sun-light transition-colors"
        >
          {t("cta_button")}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </a>
      </div>
    </section>
  );
};
