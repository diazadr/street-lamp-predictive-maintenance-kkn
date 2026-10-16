"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Lightbulb, Sun, BatteryCharging, Cpu } from "lucide-react";
import type { LampPart } from "./three/StreetLampModel";

const LampScene = dynamic(() => import("./three/LampScene"), { ssr: false });

const PARTS: { id: LampPart; Icon: typeof Lightbulb }[] = [
  { id: "lamp", Icon: Lightbulb },
  { id: "solar", Icon: Sun },
  { id: "battery", Icon: BatteryCharging },
  { id: "controller", Icon: Cpu },
];

/**
 * Exploded view interaktif: saat di-scroll, lampu terurai dan kamera
 * berpindah ke setiap komponen. Panel kanan menampilkan komponen aktif + stepper.
 */
export const TechnologySection = () => {
  const t = useTranslations("TechnologySection");
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [explode, setExplode] = useState(0);

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    // 0–10%: terurai bertahap, lalu tiap 22,5% berpindah komponen
    setExplode(Math.min(1, v / 0.1));
    const idx = Math.min(PARTS.length - 1, Math.max(0, Math.floor((v - 0.1) / 0.225)));
    setActiveIndex(idx);
  });

  const labels = Object.fromEntries(PARTS.map((p) => [p.id, t(`items.${p.id}.title`)])) as Record<LampPart, string>;
  const active = PARTS[activeIndex];

  // klik langkah → gulir ke posisi scroll milik komponen itu
  const goTo = (index: number) => {
    const el = containerRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const range = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + range * (0.1 + index * 0.225 + 0.02), behavior: "smooth" });
  };

  return (
    <section id="technology" ref={containerRef} className="relative bg-background h-[420vh] scroll-mt-0">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div className="container mx-auto h-full px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-12 items-center pt-16 lg:pt-0">
          {/* Model 3D — di kiri */}
          <div
            className="lg:col-span-7 relative h-[40vh] sm:h-[46vh] lg:h-[84vh] -mx-6 lg:mx-0"
            style={{
              // tepi kanvas memudar agar tidak terlihat sebagai kotak
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%), linear-gradient(to bottom, black 85%, transparent 100%)",
              WebkitMaskComposite: "source-in",
              maskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%), linear-gradient(to bottom, black 85%, transparent 100%)",
              maskComposite: "intersect",
            }}
          >
            <div
              className="absolute inset-0 opacity-60 dark:opacity-25 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
                maskImage: "radial-gradient(ellipse at center, black 30%, transparent 72%)",
                WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 72%)",
              }}
            />
            <LampScene mode="exploded" explode={explode} activePart={explode > 0.3 ? active.id : null} labels={labels} isDark={resolvedTheme === "dark"} className="!absolute inset-0" />
          </div>

          {/* Panel komponen aktif — di kanan */}
          <div className="lg:col-span-5 relative z-20">
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7 }}
              className="mb-6 lg:mb-10 text-3xl lg:text-5xl font-heading font-bold text-foreground leading-[1.1] tracking-tight"
            >
              {t("title_part1")} <span className="text-accent-ink">{t("title_highlight")}</span>
            </motion.h2>

            <div className="relative min-h-[300px] lg:min-h-[340px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.35 }}
                >
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-5xl lg:text-6xl font-semibold text-primary/15 tabular-nums">{String(activeIndex + 1).padStart(2, "0")}</span>
                    <h3 className="text-xl lg:text-2xl font-heading font-bold text-foreground">{t(`items.${active.id}.title`)}</h3>
                  </div>
                  <p className="mt-3 text-sm lg:text-base text-muted-foreground leading-relaxed">{t(`items.${active.id}.desc`)}</p>
                  <dl className="mt-6 grid grid-cols-2 border-t border-l border-border">
                    {(t.raw(`items.${active.id}.specs`) as string[]).map((spec) => (
                      <div key={spec} className="border-b border-r border-border px-4 py-3">
                        <dd className="font-mono text-sm font-semibold text-foreground">{spec}</dd>
                      </div>
                    ))}
                  </dl>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* stepper horizontal */}
            <div className="mt-6 grid grid-cols-4 gap-2">
              {PARTS.map(({ id, Icon }, index) => {
                const isActive = activeIndex === index;
                const done = index < activeIndex;
                return (
                  <button key={id} onClick={() => goTo(index)} className="group text-left cursor-pointer" aria-current={isActive}>
                    <span className="block h-1 rounded-full bg-muted overflow-hidden">
                      <span className={`block h-full rounded-full bg-primary transition-all duration-500 ${isActive || done ? "w-full" : "w-0"} ${done ? "opacity-40" : ""}`} />
                    </span>
                    <span className={`mt-2.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t(`items.${id}.short`)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
