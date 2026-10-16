export type LampStatus = "online" | "warning" | "fault" | "maintenance" | "offline";
export type RiskLevel = "high" | "medium" | "low" | "unknown";

export interface Place {
  id: string;
  name: string;
  type?: string | null;
  description?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

export interface Lamp {
  id: string;
  lamp_code: string;
  place_id?: string | null;
  place?: Place | null;
  model?: string | null;
  power_rating?: number | null;
  panel_watt_peak?: number | null;
  battery_capacity_wh?: number | null;
  firmware_version?: string | null;
  installed_at?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  status: LampStatus;
  health_score?: number | null;
  risk_level?: RiskLevel | null;
  last_seen?: string | null;
  last_battery_level?: number | null;
  last_brightness?: number | null;
  last_signal_strength?: number | null;
  telemetry_count?: number;
  ml_ready?: boolean;
}

export interface Alert {
  id: string;
  lamp_id?: string | null;
  alert_type?: string | null;
  severity: "critical" | "warning" | "info";
  message: string;
  created_at: string;
  is_resolved?: boolean;
}

export type TicketStatus = "open" | "in_progress" | "resolved" | "cancelled";
export type TicketPriority = "low" | "medium" | "high" | "critical";

export interface TicketLog {
  id?: string;
  action?: string;
  note?: string | null;
  created_at: string;
  user_name?: string | null;
}

export interface Ticket {
  id: string;
  title: string;
  description?: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  lamp_id?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
}

export interface Prediction {
  risk_level?: RiskLevel;
  failure_probability?: number;
  days_to_failure?: number | null;
  recommendation?: string | null;
}

export interface DeviceLog {
  time: string;
  log_level?: "info" | "warn" | "error";
  message: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
}
