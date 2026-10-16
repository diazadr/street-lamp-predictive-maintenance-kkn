"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { motion, useScroll, useTransform } from "framer-motion";
import { useTranslations } from "next-intl";
import { Building2, HardHat, Landmark, ArrowRight, MousePointer2 } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { TelemetryCallout } from "./TelemetryCallout";

const LampScene = dynamic(() => import("./three/LampScene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="h-14 w-14 rounded-full border-2 border-white/15 border-t-sun animate-spin" />
    </div>
  ),
});

const ENTITIES = [
  { key: "government", Icon: Landmark },
  { key: "operator", Icon: HardHat },
  { key: "village", Icon: Building2 },
] as const;

export const CTASection = () => {
  const t = useTranslations("CTASection");
  const sectionRef = useRef<HTMLElement>(null);

  // lampu berputar setengah putaran selama section melintas di layar (selain bisa diseret)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const spin = useTransform(scrollYProgress, [0, 1], [-Math.PI / 2, Math.PI / 2]);

  return (
    <section ref={sectionRef} id="cta" className="relative w-full overflow-hidden bg-[#0a1a3f]">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_28%_60%,#1f4e9e_0%,#0f2557_45%,#0a1a3f_82%)]" />

      <div className="relative container mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 items-center gap-4 lg:gap-10">
        {/* Lampu 3D — bisa diseret untuk diputar, berputar mengikuti scroll */}
        <div className="relative lg:col-span-6 h-[440px] sm:h-[520px] lg:h-[720px] -mx-6 lg:mx-0">
          <div
            className="absolute inset-0"
            style={{
              // tepi bawah kanvas memudar agar piringan tanah tidak terpotong lurus
              maskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
            }}
          >
            <LampScene mode="hero" isDark spin={spin} className="!absolute inset-0" />
          </div>
          <div className="hidden md:block absolute right-2 lg:-right-4 bottom-[16%] z-10">
            <TelemetryCallout />
          </div>
          <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[11px] text-white/45">
            <MousePointer2 className="h-3.5 w-3.5" /> {t("drag_hint")}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="relative z-10 lg:col-span-6 pb-16 lg:py-24"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-white leading-tight">
            {t("title_part1")} <span className="text-sun">{t("title_highlight")}</span>
            {t("title_part2")}
          </h2>
          <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-white/70">{t("description")}</p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-sun px-6 text-sm font-semibold text-[#0a1a3f] hover:bg-[#ffc933] transition-colors"
            >
              {t("btn_primary")} <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-white/20 px-6 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              {t("btn_secondary")}
            </Link>
          </div>

          <p className="mt-12 mb-4 text-sm font-semibold text-white/50">{t("card_title")}</p>
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {ENTITIES.map(({ key, Icon }, i) => (
              <motion.li
                key={key}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                className="flex items-start gap-4 py-4"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-sun" />
                <div>
                  <p className="text-sm font-semibold text-white">{t(`entities.${key}.title`)}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-white/60">{t(`entities.${key}.desc`)}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
};
