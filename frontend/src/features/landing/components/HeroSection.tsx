"use client";

import { useEffect, useRef } from "react";
import { useScroll, useTransform, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ArrowRight, ChevronDown, MapPinned } from "lucide-react";
import { Link } from "@/src/i18n/navigation";

// Video: "Street During Rain at Night" (Pexels, lisensi bebas pakai) — dikompres ke WebM + MP4 cadangan
const VIDEO = {
  webm: "/videos/hero-night-street.webm",
  mp4: "/videos/hero-night-street.mp4",
  poster: "/videos/hero-night-street.webp",
};

/** Video latar yang tidak diputar otomatis bila pengguna memilih "kurangi gerakan" (poster tetap tampil). */
function BackgroundVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      return;
    }
    // autoplay bisa ditolak browser walau muted — abaikan, poster tetap tampil
    video.play().catch(() => {});
  }, []);

  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover"
      poster={VIDEO.poster}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      aria-hidden="true"
    >
      <source src={VIDEO.webm} type="video/webm" />
      <source src={VIDEO.mp4} type="video/mp4" />
    </video>
  );
}

export const HeroSection = () => {
  const t = useTranslations("HeroSection");
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["end end", "end start"] });
  const videoOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.8, 0]);

  const scrollToMap = () => document.getElementById("map")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollNext = () => containerRef.current?.nextElementSibling?.scrollIntoView({ behavior: "smooth", block: "start" });

  const facts = ["fact_1", "fact_2", "fact_3"] as const;

  return (
    <section ref={containerRef} className="relative h-screen min-h-[680px] w-full overflow-hidden bg-black">
      <motion.div style={{ opacity: videoOpacity }} className="absolute inset-0">
        <BackgroundVideo />
        {/* overlay: gelap merata + gradasi dari kiri agar teks terbaca, rona hijau tipis untuk identitas */}
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-[#0f2557]/30 mix-blend-multiply" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />
      </motion.div>

      <div className="relative z-20 h-full container mx-auto px-6 lg:px-12 flex flex-col justify-center">
        <div className="max-w-xl pt-16">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-[2.6rem] sm:text-6xl lg:text-[4.25rem] font-heading font-extrabold tracking-[-0.03em] leading-[1.02] text-white"
          >
            {t("title_1")}{" "}
            <span className="relative whitespace-nowrap text-sun">
              {t("title_highlight")}
              <svg viewBox="0 0 300 12" preserveAspectRatio="none" className="absolute -bottom-1.5 left-0 h-2.5 w-full" aria-hidden="true">
                <motion.path
                  d="M2 9 C 80 2, 220 2, 298 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                />
              </svg>
            </span>{" "}
            {t("title_2")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="mt-7 text-base sm:text-lg text-white/75 leading-relaxed"
          >
            {t("description")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <button
              onClick={scrollToMap}
              className="group inline-flex h-12 items-center gap-2.5 rounded-lg bg-sun px-6 text-sm font-semibold text-[#0a1a3f] hover:bg-[#ffc933] transition-colors cursor-pointer"
            >
              <MapPinned className="h-4 w-4" />
              {t("cta_map")}
            </button>
            <Link
              href="/login"
              className="group inline-flex h-12 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white/85 hover:text-white transition-colors"
            >
              {t("open_dashboard")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12 flex flex-wrap gap-x-8 gap-y-4"
          >
            {facts.map((key, i) => (
              <div key={key} className={`flex flex-col ${i > 0 ? "sm:border-l sm:border-white/20 sm:pl-8" : ""}`}>
                <dt className="font-mono text-xl font-semibold text-white">{t(`${key}.value`)}</dt>
                <dd className="text-xs text-white/60">{t(`${key}.label`)}</dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </div>

      <button
        onClick={scrollNext}
        aria-label={t("scroll")}
        className="absolute z-20 bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-[11px] text-white/55 hover:text-white/85 transition-colors cursor-pointer"
      >
        {t("scroll")}
        <ChevronDown className="h-4 w-4 animate-bounce" />
      </button>
    </section>
  );
};
