import { api, toList } from "@/src/lib/http/axios";
import type { EnergySummary } from "@/src/features/dashboard/services/dashboardService";

export interface EnergyFlowPoint {
  time: string;
  // kolom Decimal dikirim backend sebagai string
  solar_power?: number | string | null;
  load_power?: number | string | null;
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
    return toList<EnergyFlowPoint>(data).slice(0, 96).reverse();
  },
  async costComparison() {
    const { data } = await api.get<CostComparison>("/energy/cost-comparison");
    return data;
  },
};
