"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, BrainCircuit, Clock, Loader2, Save, Settings, Zap } from "lucide-react";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { SectionCard } from "@/src/components/ui/dashboard/SectionCard";
import { LoadingState } from "@/src/components/ui/dashboard/LoadingSkeleton";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Switch } from "@/src/components/ui/switch";
import { api, getErrorMessage } from "@/src/lib/http/axios";
import { useFetch } from "@/src/hooks/useFetch";

type SettingsValues = Record<string, number | boolean | string>;

const DEFAULTS: SettingsValues = {
  telemetry_interval_seconds: 120,
  max_offline_minutes: 30,
  alert_email_enabled: true,
  auto_create_ticket_on_fault: true,
  battery_low_threshold: 20,
  solar_efficiency_target: 80,
  maintenance_reminder_days: 7,
  ml_prediction_enabled: true,
  ml_min_data_points: 48,
  system_name: "Street Lamp Predictive Maintenance",
};

type Field = { key: string; type: "number" | "boolean" | "text"; min?: number; max?: number };

const SECTIONS: { id: string; Icon: typeof Clock; fields: Field[] }[] = [
  { id: "telemetry", Icon: Clock, fields: [{ key: "telemetry_interval_seconds", type: "number", min: 30, max: 600 }, { key: "max_offline_minutes", type: "number", min: 5, max: 120 }] },
  {
    id: "alerts",
    Icon: Bell,
    fields: [{ key: "alert_email_enabled", type: "boolean" }, { key: "auto_create_ticket_on_fault", type: "boolean" }, { key: "battery_low_threshold", type: "number", min: 5, max: 50 }],
  },
  { id: "energy", Icon: Zap, fields: [{ key: "solar_efficiency_target", type: "number", min: 50, max: 100 }, { key: "maintenance_reminder_days", type: "number", min: 1, max: 30 }] },
  { id: "ml", Icon: BrainCircuit, fields: [{ key: "ml_prediction_enabled", type: "boolean" }, { key: "ml_min_data_points", type: "number", min: 10, max: 200 }] },
  { id: "system", Icon: Settings, fields: [{ key: "system_name", type: "text" }] },
];

export function SystemSettingsView() {
  const t = useTranslations("SystemSettings");
  const [values, setValues] = useState<SettingsValues>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const { data, isLoading } = useFetch(async () => (await api.get<SettingsValues>("/settings")).data, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data) setValues((v) => ({ ...v, ...data }));
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      const { data: saved } = await api.put<SettingsValues>("/settings", values);
      setValues((v) => ({ ...v, ...saved }));
      toast.success(t("saved"));
    } catch (err) {
      toast.error(getErrorMessage(err, t("failed")));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <DashboardPageShell
      title={t("title")}
      subtitle={t("subtitle")}
      icon={Settings}
      className="max-w-3xl"
      actions={
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} {t("save")}
        </Button>
      }
    >
      {SECTIONS.map(({ id, Icon, fields }) => (
        <SectionCard key={id} title={t(`sections.${id}`)} icon={Icon}>
          <div className="divide-y divide-border/60">
            {fields.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-6 py-3.5 first:pt-0 last:pb-0">
                <div>
                  <Label htmlFor={f.key} className="text-sm font-medium text-foreground">
                    {t(`fields.${f.key}.label`)}
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t(`fields.${f.key}.desc`)}</p>
                </div>
                {f.type === "boolean" ? (
                  <Switch id={f.key} checked={Boolean(values[f.key])} onCheckedChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
                ) : (
                  <Input
                    id={f.key}
                    type={f.type}
                    min={f.min}
                    max={f.max}
                    value={String(values[f.key] ?? "")}
                    onChange={(e) => setValues((s) => ({ ...s, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                    className={f.type === "text" ? "w-64" : "w-28 text-right"}
                  />
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      ))}
    </DashboardPageShell>
  );
}
