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

export type IssueSeverity = "critical" | "warning" | "info";
export type LampComponent = "panel" | "battery" | "lamp" | "sensor";

/** One finding of the pju_ml assessment (rule engine or Random Forest). */
export interface PredictionIssue {
  code: string;
  component: LampComponent;
  severity: IssueSeverity;
  message: string;
  value?: number | null;
}

/** Battery model estimate (coulomb counting, reset to 100% when the controller reports "full"). */
export interface BatteryEstimate {
  soc_pct?: number | null;
  hours_since_full?: number | null;
  nightly_consumption_ah?: number | null;
  autonomy_nights?: number | null;
  days_to_empty?: number | null;
  capacity_ah?: number | null;
  last_full_at?: string | null;
  observed_hours?: number | null;
  voltage_v?: number | null;
}

export interface LampActivity {
  night_duty_cycle?: number | null;
  on_current_a?: number | null;
  bright_episodes_per_hour?: number | null;
}

/** Verdict of the Random Forest condition classifier over the last 24 h of 10-minute windows. */
export interface ConditionVerdict {
  label: string;
  label_id?: string;
  probability?: number | null;
  /** True once enough windows agree; only confirmed verdicts raise an issue. */
  confirmed?: boolean;
  windows_flagged?: number;
  windows_checked?: number;
  model_version?: string;
}

export interface PredictionDetails {
  health_score?: number | null;
  component_health?: Partial<Record<LampComponent, number>>;
  issues?: PredictionIssue[];
  battery?: BatteryEstimate | null;
  lamp?: LampActivity | null;
  condition?: ConditionVerdict | null;
  assessed_at?: string | null;
  data_hours?: number | null;
}

export interface Prediction {
  id?: string;
  predicted_at?: string | null;
  risk_level?: RiskLevel;
  failure_probability?: number;
  days_to_failure?: number | null;
  recommendation?: string | null;
  model_version?: string | null;
  confidence?: number | null;
  details?: PredictionDetails | null;
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
