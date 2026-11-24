import { api, toList } from "@/src/lib/http/axios";
import type { Alert, IssueSeverity, LampComponent, LampStatus, RiskLevel } from "@/src/types/domain";

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

/** One hour of /monitoring/trend: lamp and solar power in W (summed over lamps), bus voltage in V. */
export interface TrendPoint {
  time: string;
  power?: number | null;
  solar_power?: number | null;
  voltage?: number | null;
  lux?: number | null;
  temperature?: number | null;
}

/** One hour of the fleet: powers summed over lamps (W), the rest averaged. */
export interface OverviewHour {
  time: string;
  solar_w: number | null;
  load_w: number | null;
  bus_v: number | null;
  lux: number | null;
  temp_c: number | null;
}

export interface OverviewEnergy {
  solar_wh: number;
  load_wh: number;
  net_wh: number;
  peak_solar_w: number | null;
  peak_load_w: number | null;
  hours_with_data: number;
}

/** A lamp with its latest pju_ml assessment, as listed on the dashboard. */
export interface OverviewLamp {
  id: string;
  lamp_code: string;
  place_name: string | null;
  status: LampStatus;
  risk_level: RiskLevel | null;
  health_score: number | null;
  battery_soc: number | null;
  autonomy_nights: number | null;
  hours_since_full: number | null;
  nightly_consumption_ah: number | null;
  days_to_failure: number | null;
  issue_count: number;
  top_issue: { code: string; component: LampComponent; severity: IssueSeverity; message: string } | null;
  condition: { label: string; probability: number | null; confirmed: boolean } | null;
  predicted_at: string | null;
  last_seen: string | null;
  ml_ready: boolean;
}

/** Headline numbers of the Random Forest model card (leave-one-day-out validation). */
export interface OverviewModel {
  version: string | null;
  trained_at: string | null;
  windows: number | null;
  rf_accuracy: number | null;
  rf_f1_macro: number | null;
  rf_false_alarm_rate: number | null;
  rules_accuracy: number | null;
  rules_f1_macro: number | null;
}

export interface Overview {
  last_data_at: string | null;
  window: { start: string; end: string; hours: number };
  hourly: OverviewHour[];
  energy: OverviewEnergy;
  lamps: OverviewLamp[];
  conditions: Record<string, number>;
  model: OverviewModel | null;
}

export const dashboardService = {
  async overview() {
    const { data } = await api.get<Overview>("/monitoring/overview");
    return data;
  },
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
  /** Per hour over the last `hours` up to the newest reading, oldest first. */
  async trend(hours = 24, lampId?: string) {
    const { data } = await api.get("/monitoring/trend", { params: { hours, lamp_id: lampId } });
    return toList<TrendPoint>(data);
  },
};
