import { useEffect, useState } from "react";
import { publicService, type PublicDashboard } from "../services/publicService";

/** Data demo dipakai bila backend belum berjalan — landing page tetap informatif. */
export const DEMO_DASHBOARD: Required<Pick<PublicDashboard, "kpi" | "energy" | "energyFlow">> & PublicDashboard = {
  kpi: { total_lamps: 248, online_lamps: 238, warning_lamps: 6, offline_lamps: 4, unresolved_alerts: 9, avg_battery_level: 81.4, avg_signal_strength: 88 },
  latestTelemetry: { battery_level: 84, solar_power: 46, power: 32, temperature_ambient: 30.5, lux: 870 },
  energy: { dailyGenerated: 18450, dailyConsumed: 12620, efficiency: 146, co2Saved: 15.7, treesEquivalent: 0.7 },
  energyFlow: ["06", "08", "10", "12", "14", "16", "18", "20", "22", "00", "02", "04"].map((hour, i) => ({
    hour,
    generated: [8, 34, 61, 78, 72, 44, 6, 0, 0, 0, 0, 2][i],
    consumed: [6, 0, 0, 0, 0, 0, 22, 34, 30, 18, 17, 24][i],
  })),
};

export function usePublicDashboard() {
  const [data, setData] = useState<PublicDashboard | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const d = await publicService.getDashboard();
        if (!cancelled) {
          setData(d);
          setIsLive(true);
        }
      } catch {
        if (!cancelled) setIsLive(false);
      }
    };
    load();
    const interval = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const hasLiveKpi = !!data?.kpi?.total_lamps;
  return {
    isLive: isLive && hasLiveKpi,
    kpi: hasLiveKpi ? data!.kpi! : DEMO_DASHBOARD.kpi,
    energy: hasLiveKpi && data?.energy ? data.energy : DEMO_DASHBOARD.energy,
    energyFlow: data?.energyFlow?.length ? data.energyFlow : DEMO_DASHBOARD.energyFlow,
  };
}
