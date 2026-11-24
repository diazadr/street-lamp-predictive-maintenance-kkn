import { api, toList } from "@/src/lib/http/axios";
import type { EnergySummary } from "@/src/features/dashboard/services/dashboardService";

/** One hour of the fleet: solar and lamp power in W. */
export interface EnergyFlowPoint {
  time: string;
  solar_power?: number | null;
  load_power?: number | null;
}

export interface CostComparison {
  currency?: string;
  traditional_monthly_cost?: number;
  smart_monthly_cost?: number;
  estimated_saving?: number;
}

export const energyService = {
  async summary() {
    const { data } = await api.get<EnergySummary>("/energy/summary");
    return data;
  },
  async flow() {
    const { data } = await api.get("/energy/flow");
    // last 24 h per hour, oldest first
    return toList<EnergyFlowPoint>(data);
  },
  async costComparison() {
    const { data } = await api.get<CostComparison>("/energy/cost-comparison");
    return data;
  },
};
