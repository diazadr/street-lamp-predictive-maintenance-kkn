"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

/** Panel telemetri contoh yang "menempel" pada lampu 3D — menunjukkan apa yang dipantau platform. */
export function TelemetryCallout() {
  const t = useTranslations("LampCallout");
  const rows = [
    { label: t("battery"), value: "86%", bar: 86 },
    { label: t("solar"), value: "72 W", bar: 72 },
    { label: t("brightness"), value: "80%", bar: 80 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.4, duration: 0.6 }}
      className="pointer-events-none w-64 rounded-xl border border-white/10 bg-[#0a1a3f]/80 backdrop-blur-md text-white shadow-2xl shadow-black/40"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div>
          <p className="font-mono text-sm font-semibold">PJU-A07</p>
          <p className="text-[11px] text-white/50">Jl. Ganesha, Bandung</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-[#a3bf5b]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#a3bf5b] animate-pulse" />
          {t("online")}
        </span>
      </div>
      <div className="space-y-2.5 px-4 py-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex justify-between text-[11px]">
              <span className="text-white/55">{r.label}</span>
              <span className="font-mono text-white/90">{r.value}</span>
            </div>
            <div className="h-1 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-sun/85" style={{ width: `${r.bar}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 border-t border-white/10 text-[11px]">
        <div className="border-r border-white/10 px-4 py-2.5">
          <p className="text-white/50">{t("risk")}</p>
          <p className="font-mono font-semibold text-[#a3bf5b]">{t("risk_value")}</p>
        </div>
        <div className="px-4 py-2.5">
          <p className="text-white/50">{t("next_service")}</p>
          <p className="font-mono font-semibold">{t("next_service_value")}</p>
        </div>
      </div>
    </motion.div>
  );
}
