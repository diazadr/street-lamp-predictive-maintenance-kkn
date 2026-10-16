import { api } from "@/src/lib/http/axios";

export interface PublicDashboard {
  kpi?: {
    total_lamps?: number;
    online_lamps?: number;
    warning_lamps?: number;
    offline_lamps?: number;
    unresolved_alerts?: number;
    avg_battery_level?: number;
    avg_signal_strength?: number;
  };
  latestTelemetry?: Record<string, number | null>;
  energy?: { dailyGenerated?: number; dailyConsumed?: number; efficiency?: number; co2Saved?: number; treesEquivalent?: number };
  energyFlow?: { hour: string; generated: number; consumed: number }[];
}

export interface PublicLamp {
  code: string;
  place: string | null;
  latitude: number;
  longitude: number;
  status: string;
  battery: number | null;
  brightness: number | null;
  health_score: number | null;
  risk_level: string | null;
  last_seen: string | null;
}

export const publicService = {
  async getLamps(): Promise<PublicLamp[]> {
    const { data } = await api.get<PublicLamp[]>("/public/lamps");
    return data;
  },
  async getDashboard(): Promise<PublicDashboard> {
    const { data } = await api.get<PublicDashboard>("/public/dashboard");
    return data;
  },
};
