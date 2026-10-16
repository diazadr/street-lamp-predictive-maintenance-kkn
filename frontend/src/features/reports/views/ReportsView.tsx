"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BarChart2, BrainCircuit, Calendar, Download, FileSpreadsheet, FileText, Loader2, Wrench, Zap } from "lucide-react";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { SectionCard } from "@/src/components/ui/dashboard/SectionCard";
import { Button } from "@/src/components/ui/button";
import { DateTimePicker } from "@/src/components/ui/date-time-picker";
import { Label } from "@/src/components/ui/label";
import { downloadFile, getErrorMessage } from "@/src/lib/http/axios";
import { format, parseISO } from "date-fns";
import { isoDate } from "@/src/lib/utils";

const REPORTS = [
  { id: "lamp_status", Icon: BarChart2 },
  { id: "energy", Icon: Zap },
  { id: "maintenance", Icon: Wrench },
  { id: "predictive", Icon: BrainCircuit },
] as const;

// Backend mendukung CSV & XLSX (lihat routers/reports.py)
const FORMATS = [
  { id: "csv", Icon: FileText },
  { id: "xlsx", Icon: FileSpreadsheet },
] as const;

export function ReportsView() {
  const t = useTranslations("Reports");
  const [generating, setGenerating] = useState("");
  const [range, setRange] = useState({ start: isoDate(30), end: isoDate() });

  const generate = async (type: string, format: string) => {
    if (range.start > range.end) {
      toast.error(t("invalid_range"));
      return;
    }
    setGenerating(`${type}-${format}`);
    try {
      await downloadFile(`/reports/${type}`, `laporan_${type}_${range.start}_${range.end}.${format}`, {
        start_date: range.start,
        end_date: range.end,
        format,
      });
      toast.success(t("success"));
    } catch (err) {
      toast.error(getErrorMessage(err, t("failed")));
    } finally {
      setGenerating("");
    }
  };

  return (
    <DashboardPageShell title={t("title")} subtitle={t("subtitle")} icon={FileText} className="max-w-5xl">
      <SectionCard title={t("range.title")} icon={Calendar}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 w-56">
            <Label>{t("range.start")}</Label>
            <DateTimePicker
              value={parseISO(range.start)}
              maxDate={parseISO(range.end)}
              onChange={(d) => d && setRange((r) => ({ ...r, start: format(d, "yyyy-MM-dd") }))}
            />
          </div>
          <div className="space-y-1.5 w-56">
            <Label>{t("range.end")}</Label>
            <DateTimePicker
              value={parseISO(range.end)}
              minDate={parseISO(range.start)}
              maxDate={new Date()}
              onChange={(d) => d && setRange((r) => ({ ...r, end: format(d, "yyyy-MM-dd") }))}
            />
          </div>
          <div className="flex gap-1.5">
            {[7, 30, 90].map((days) => (
              <Button key={days} variant="outline" size="sm" className="h-9" onClick={() => setRange({ start: isoDate(days), end: isoDate() })}>
                {t("range.days", { days })}
              </Button>
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORTS.map(({ id, Icon }) => (
          <div key={id} className="rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/25 transition-colors">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{t(`types.${id}.title`)}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{t(`types.${id}.desc`)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {FORMATS.map(({ id: fmt, Icon: FIcon }) => {
                const busy = generating === `${id}-${fmt}`;
                return (
                  <Button key={fmt} variant={fmt === "xlsx" ? "default" : "outline"} size="sm" disabled={!!generating} onClick={() => generate(id, fmt)}>
                    {busy ? <Loader2 className="animate-spin" /> : <FIcon />}
                    {fmt.toUpperCase()}
                    {!busy && <Download className="opacity-60" />}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </DashboardPageShell>
  );
}
