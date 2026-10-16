"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Clock, Loader2, Plus, Save, Sun, Trash2 } from "lucide-react";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { SectionCard } from "@/src/components/ui/dashboard/SectionCard";
import { LoadingState } from "@/src/components/ui/dashboard/LoadingSkeleton";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { TimePicker } from "@/src/components/ui/date-time-picker";
import { Label } from "@/src/components/ui/label";
import { Switch } from "@/src/components/ui/switch";
import { setBreadcrumbLabel } from "@/src/components/layouts/dashboard/navbar/NavBreadcrumbs";
import { getErrorMessage } from "@/src/lib/http/axios";
import { settle, useFetch } from "@/src/hooks/useFetch";
import { lampService, type DimmingEntry, type LampSchedule } from "../services/lampService";

const DEFAULT_SCHEDULE: LampSchedule = {
  name: "Jadwal Default",
  auto_sunrise: true,
  auto_sunset: true,
  on_time: "18:00",
  off_time: "06:00",
  dimming_schedule: [
    { hour: 18, minute: 0, brightness: 100 },
    { hour: 22, minute: 0, brightness: 50 },
    { hour: 4, minute: 0, brightness: 100 },
  ],
};

const hhmm = (v?: string | null) => (v ? v.slice(0, 5) : "");

export function LampScheduleView({ id }: { id: string }) {
  const t = useTranslations("LampSchedule");
  const [form, setForm] = useState<LampSchedule>(DEFAULT_SCHEDULE);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useFetch(() => settle([lampService.get(id), lampService.schedules(id)] as const), [id]);
  const lamp = data?.[0];

  useEffect(() => {
    const existing = data?.[1]?.[0];
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        ...DEFAULT_SCHEDULE,
        ...existing,
        on_time: hhmm(existing.on_time) || DEFAULT_SCHEDULE.on_time,
        off_time: hhmm(existing.off_time) || DEFAULT_SCHEDULE.off_time,
        dimming_schedule: existing.dimming_schedule?.length ? existing.dimming_schedule : DEFAULT_SCHEDULE.dimming_schedule,
      });
    }
    if (lamp?.lamp_code) setBreadcrumbLabel(id, lamp.lamp_code);
  }, [data, lamp, id]);

  const updateEntry = (idx: number, field: keyof DimmingEntry, value: string) => {
    const n = Math.max(0, Math.min(field === "hour" ? 23 : field === "minute" ? 59 : 100, Number(value) || 0));
    setForm((f) => ({ ...f, dimming_schedule: f.dimming_schedule.map((d, i) => (i === idx ? { ...d, [field]: n } : d)) }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await lampService.saveSchedule(id, form);
      toast.success(t("success"));
    } catch (err) {
      toast.error(getErrorMessage(err, t("failed")));
    } finally {
      setSaving(false);
    }
  };

  // Blok timeline 24 jam
  const sorted = [...form.dimming_schedule].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  const blocks = sorted.map((entry, i) => {
    const next = sorted[(i + 1) % sorted.length];
    const start = entry.hour * 60 + entry.minute;
    const end = next.hour * 60 + next.minute;
    const span = sorted.length === 1 ? 1440 : end > start ? end - start : 1440 - start + end;
    return { start, span, brightness: entry.brightness };
  });

  if (isLoading) return <LoadingState />;

  return (
    <DashboardPageShell title={t("title")} subtitle={lamp?.lamp_code} backHref={`/workspace/lamps/${id}`} className="max-w-3xl">
      <SectionCard title={t("general")} icon={Clock}>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <Sun className="h-5 w-5 text-warning" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("auto")}</p>
                <p className="text-xs text-muted-foreground">{t("auto_desc")}</p>
              </div>
            </div>
            <Switch
              checked={form.auto_sunrise && form.auto_sunset}
              onCheckedChange={(v) => setForm((f) => ({ ...f, auto_sunrise: v, auto_sunset: v }))}
            />
          </div>
          {!(form.auto_sunrise && form.auto_sunset) && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("on_time")}</Label>
                <TimePicker value={form.on_time} onChange={(v) => setForm((f) => ({ ...f, on_time: v }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("off_time")}</Label>
                <TimePicker value={form.off_time} onChange={(v) => setForm((f) => ({ ...f, off_time: v }))} />
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title={t("dimming")}
        description={t("dimming_desc")}
        headerAction={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setForm((f) => ({ ...f, dimming_schedule: [...f.dimming_schedule, { hour: 0, minute: 0, brightness: 100 }] }))}
          >
            <Plus /> {t("add")}
          </Button>
        }
      >
        <div className="space-y-2">
          {form.dimming_schedule.map((entry, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 px-3 py-2">
              <TimePicker
                value={`${String(entry.hour).padStart(2, "0")}:${String(entry.minute).padStart(2, "0")}`}
                onChange={(v) => {
                  const [h, m] = v.split(":");
                  updateEntry(i, "hour", h);
                  updateEntry(i, "minute", m);
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={entry.brightness}
                onChange={(e) => updateEntry(i, "brightness", e.target.value)}
                className="flex-1 min-w-32 accent-primary"
                aria-label="brightness"
              />
              <span className="w-12 text-right text-sm font-semibold tabular-nums text-primary">{entry.brightness}%</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setForm((f) => ({ ...f, dimming_schedule: f.dimming_schedule.filter((_, j) => j !== i) }))}
                className="text-muted-foreground hover:text-destructive"
                aria-label={t("remove")}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("preview")}</p>
          <div className="relative h-10 overflow-hidden rounded-xl border border-border bg-muted">
            {blocks.map((b, i) => {
              const segments = b.start + b.span > 1440 ? [[b.start, 1440 - b.start], [0, b.start + b.span - 1440]] : [[b.start, b.span]];
              return segments.map(([s, w], j) => (
                <div
                  key={`${i}-${j}`}
                  className="absolute top-0 flex h-full items-center justify-center border-r border-background text-[10px] font-semibold text-primary-foreground"
                  style={{ left: `${(s / 1440) * 100}%`, width: `${(w / 1440) * 100}%`, background: `color-mix(in oklab, var(--primary) ${20 + b.brightness * 0.8}%, transparent)` }}
                >
                  {w > 90 ? `${b.brightness}%` : ""}
                </div>
              ));
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            {[0, 6, 12, 18, 24].map((h) => (
              <span key={h}>{String(h).padStart(2, "0")}:00</span>
            ))}
          </div>
        </div>
      </SectionCard>

      <Button onClick={save} disabled={saving} className="w-full h-11">
        {saving ? <Loader2 className="animate-spin" /> : <Save />} {t("save")}
      </Button>
    </DashboardPageShell>
  );
}
