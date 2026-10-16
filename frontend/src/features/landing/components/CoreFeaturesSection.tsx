"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Radio, BrainCircuit, Wrench, MapPinned, CalendarClock, FileBarChart } from "lucide-react";

const FEATURES = [
  { id: "realtime", Icon: Radio },
  { id: "prediction", Icon: BrainCircuit },
  { id: "tickets", Icon: Wrench },
  { id: "map", Icon: MapPinned },
  { id: "schedule", Icon: CalendarClock },
  { id: "reports", Icon: FileBarChart },
] as const;

export const CoreFeaturesSection = () => {
  const t = useTranslations("CoreFeaturesSection");

  return (
    <section id="features" className="relative py-24 lg:py-32 bg-brand-soft/60 overflow-hidden scroll-mt-16">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="container mx-auto px-6 lg:px-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="max-w-3xl mb-14"
        >
          <h2 className="text-4xl lg:text-5xl font-heading font-bold text-foreground leading-[1.1] tracking-tight mb-5">
            {t("title_part1")} <span className="text-accent-ink">{t("title_highlight")}</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">{t("description")}</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ id, Icon }, i) => (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="group relative rounded-3xl border border-border bg-card p-7 shadow-sm hover:shadow-xl hover:shadow-[#0f2557]/5 hover:-translate-y-1 hover:border-primary/20 transition-all duration-300"
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="font-mono text-sm font-bold text-muted-foreground/40">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="text-xl font-heading font-bold text-foreground mb-2">{t(`items.${id}.title`)}</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{t(`items.${id}.desc`)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
