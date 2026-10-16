"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "@/src/i18n/navigation";
import { BrandMark } from "@/src/components/common/BrandMark";
import { LocaleToggle } from "@/src/components/layouts/dashboard/navbar/LocaleToggle";
import { ThemeToggle } from "@/src/components/layouts/dashboard/ThemeToggle";

/** Ilustrasi deretan lampu jalan (SVG) untuk panel kiri halaman auth. */
function StreetIllustration() {
  const poles = [0, 1, 2, 3];
  return (
    <svg viewBox="0 0 600 420" preserveAspectRatio="xMidYMax meet" className="absolute inset-x-0 bottom-0 w-full h-[46%]" aria-hidden="true">
      <defs>
        <radialGradient id="glow" cx="50%" cy="0%" r="70%">
          <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fef9c3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M0 380 L600 330 L600 420 L0 420Z" fill="rgba(255,255,255,0.06)" />
      {poles.map((i) => {
        const x = 80 + i * 150;
        const s = 1 - i * 0.14;
        const base = 392 - i * 14;
        const top = base - 250 * s;
        return (
          <g key={i} opacity={1 - i * 0.15}>
            <path d={`M${x + 40 * s} ${top + 8} L${x - 10 * s} ${base} L${x + 140 * s} ${base} Z`} fill="url(#glow)" />
            <rect x={x - 3 * s} y={top} width={6 * s} height={base - top} rx={3} fill="#f8fafc" />
            <path d={`M${x} ${top + 14} q ${6 * s} ${-22 * s} ${44 * s} ${-18 * s}`} stroke="#f8fafc" strokeWidth={4 * s} fill="none" strokeLinecap="round" />
            <rect x={x + 34 * s} y={top - 10 * s} width={34 * s} height={9 * s} rx={4 * s} fill="#f8fafc" />
            <rect x={x + 36 * s} y={top - 2 * s} width={30 * s} height={3 * s} rx={1.5} fill="#fef08a" />
            <rect x={x - 24 * s} y={top - 34 * s} width={46 * s} height={8 * s} rx={2} fill="#1e3a5f" transform={`rotate(-14 ${x} ${top - 30 * s})`} />
            <rect x={x - 9 * s} y={top + 100 * s} width={18 * s} height={26 * s} rx={3} fill="#f8fafc" />
            <rect x={x - 9 * s} y={top + 104 * s} width={18 * s} height={4 * s} fill="#f5b700" />
          </g>
        );
      })}
    </svg>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("AuthLayout");

  return (
    <main className="min-h-screen w-full flex bg-background text-foreground relative">
      <div className="absolute top-6 left-6 z-50">
        <Link
          href="/"
          className="inline-flex h-8 items-center gap-2 rounded-xl border border-border/50 bg-background/80 px-3 text-sm font-bold text-foreground shadow-sm backdrop-blur-md hover:text-primary transition-colors"
        >
          <ArrowLeft size={16} />
          {t("back_home")}
        </Link>
      </div>
      <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
        <LocaleToggle />
        <ThemeToggle />
      </div>

      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#1f4e9e] via-[#0f2557] to-[#0a1a3f]">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <StreetIllustration />
        <div className="relative z-10 flex flex-col gap-14 p-12 w-full">
          <div className="flex items-center gap-3 mt-12">
            <BrandMark inverted className="h-11 w-11" />
            <div className="leading-tight">
              <p className="text-lg font-black text-white">Street Lamp PdM</p>
              <p className="text-xs text-white/60">Predictive Maintenance</p>
            </div>
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-md">
            <h2 className="text-4xl font-bold font-heading mb-4 text-white leading-tight">
              {t("hero_title_1")} <span className="text-sun">{t("hero_title_accent")}</span>
            </h2>
            <p className="text-lg text-white/80 leading-relaxed">{t("hero_desc")}</p>
          </motion.div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:py-16 bg-background relative overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-md my-auto pt-12 lg:pt-0"
        >
          {children}
        </motion.div>
      </div>
    </main>
  );
}

/** Kartu status terpusat (verifikasi email, menunggu persetujuan, dll.). */
export function AuthStatusCard({
  icon,
  tone = "primary",
  title,
  children,
}: {
  icon: React.ReactNode;
  tone?: "primary" | "warning" | "destructive";
  title: string;
  children: React.ReactNode;
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className="text-center">
      <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl ${toneClass}`}>{icon}</div>
      <h1 className="text-3xl font-extrabold text-primary tracking-tight mb-3">{title}</h1>
      <div className="text-muted-foreground space-y-2">{children}</div>
    </div>
  );
}
