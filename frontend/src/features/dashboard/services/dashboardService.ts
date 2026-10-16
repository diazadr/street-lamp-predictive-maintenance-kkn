import { api, toList } from "@/src/lib/http/axios";
import type { Alert } from "@/src/types/domain";

export interface Kpi {
  total_lamps: number;
  online: number;
  offline: number;
  fault: number;
  warning: number;
  maintenance: number;
  alerts_today: number;
  unresolved_alerts: number;
  avg_battery: number;
  avg_health_score: number | null;
  solar_status: string;
}

export type RiskSummary = Partial<Record<"high" | "medium" | "low" | "unknown", number>>;

export interface EnergySummary {
  lamp_count?: number;
  solar_generated_kwh?: number;
  energy_consumed_kwh?: number;
  co2_avoided_kg?: number;
  efficiency_percent?: number;
  solar_generated_today?: number;
  consumed_today?: number;
  efficiency_pct?: number;
}

export interface TrendPoint {
  time: string;
  power?: number | null;
  solar_power?: number | null;
  battery_level?: number | null;
  voltage?: number | null;
  current?: number | null;
  temperature_internal?: number | null;
  lux?: number | null;
}

export const dashboardService = {
  async kpi() {
    const { data } = await api.get<Kpi>("/monitoring/kpi");
    return data;
  },
  async riskSummary() {
    const { data } = await api.get<RiskSummary>("/monitoring/risk-summary");
    return data;
  },
  async activeAlerts(limit = 5) {
    const { data } = await api.get("/alerts", { params: { is_resolved: false, limit } });
    return toList<Alert>(data);
  },
  async energySummary() {
    const { data } = await api.get<EnergySummary>("/energy/summary");
    return data;
  },
  async trend(limit = 100) {
    const { data } = await api.get("/monitoring/trend", { params: { limit } });
    // API mengembalikan urutan terbaru dulu — dibalik agar grafik kronologis
    return toList<TrendPoint>(data).slice().reverse();
  },
};
