import { api, toList } from "@/src/lib/http/axios";
import type { Alert, DeviceLog, Lamp, Prediction, Ticket } from "@/src/types/domain";

export interface LampPayload {
  lamp_code: string;
  place_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  model?: string | null;
  power_rating?: number | null;
  panel_watt_peak?: number | null;
  battery_capacity_wh?: number | null;
  firmware_version?: string | null;
}

export interface DimmingEntry {
  hour: number;
  minute: number;
  brightness: number;
}

export interface LampSchedule {
  id?: string;
  name: string;
  is_active?: boolean;
  auto_sunrise: boolean;
  auto_sunset: boolean;
  on_time: string;
  off_time: string;
  dimming_schedule: DimmingEntry[];
}

export const lampService = {
  async list(params: { status?: string; place_id?: string; limit?: number } = {}) {
    const { data } = await api.get("/lamps", { params: { limit: 200, ...params } });
    return toList<Lamp>(data);
  },
  async get(id: string) {
    const { data } = await api.get<Lamp>(`/lamps/${id}`);
    return data;
  },
  async create(payload: LampPayload) {
    const { data } = await api.post<Lamp>("/lamps", payload);
    return data;
  },
  async alerts(id: string) {
    const { data } = await api.get(`/lamps/${id}/alerts`, { params: { limit: 5 } });
    return toList<Alert>(data);
  },
  async tickets(id: string) {
    const { data } = await api.get(`/lamps/${id}/tickets`, { params: { limit: 5 } });
    return toList<Ticket>(data);
  },
  async predictions(id: string) {
    const { data } = await api.get(`/lamps/${id}/predictions`);
    return toList<Prediction>(data);
  },
  async deviceLogs(id: string) {
    const { data } = await api.get(`/lamps/${id}/device-logs`, { params: { limit: 20 } });
    return toList<DeviceLog>(data);
  },
  async telemetry(id: string) {
    const { data } = await api.get(`/lamps/${id}/telemetry`, { params: { limit: 48 } });
    return toList<{ time: string; battery_level?: number | null; power?: number | null; solar_power?: number | null }>(data)
      .slice()
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  },
  async setBrightness(id: string, brightness: number) {
    return api.patch(`/lamps/${id}/brightness`, { brightness });
  },
  async schedules(id: string) {
    const { data } = await api.get(`/lamps/${id}/schedule`);
    return toList<LampSchedule>(data);
  },
  async saveSchedule(id: string, schedule: LampSchedule) {
    const { id: scheduleId, ...rest } = schedule;
    const payload = { ...rest, lamp_id: undefined };
    if (scheduleId) return api.put(`/lamps/${id}/schedule/${scheduleId}`, payload);
    return api.post(`/lamps/${id}/schedule`, payload);
  },
};
