"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BatteryCharging, BrainCircuit, Info, ListChecks, ShieldCheck, Trees, type LucideIcon } from "lucide-react";
import { SectionCard } from "@/src/components/ui/dashboard/SectionCard";
import { StatusBadge } from "@/src/components/ui/dashboard/StatusBadge";
import { ProgressBar } from "@/src/components/ui/dashboard/ProgressBar";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { formatDecimal, timeAgo } from "@/src/lib/utils";
import type { Lamp, LampComponent, Prediction, PredictionIssue } from "@/src/types/domain";

/** Same as ML_MIN_TELEMETRY in backend/app/ml/engine.py (~1 hour of readings every ~14 s). */
export const ML_MIN_TELEMETRY = 260;

const COMPONENTS: LampComponent[] = ["panel", "battery", "lamp", "sensor"];

function Heading({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {children}
    </h4>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/50 py-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums text-foreground text-right">{value}</dd>
    </div>
  );
}

interface PredictionPanelProps {
  lamp: Lamp;
  prediction?: Prediction;
  className?: string;
}

/** Latest pju_ml assessment: risk, battery estimate, component health, findings and the Random Forest verdict. */
export function PredictionPanel({ lamp, prediction, className }: PredictionPanelProps) {
  const t = useTranslations("LampDetail.prediction");
  const locale = useLocale();
  const details = prediction?.details;
  const battery = details?.battery;
  const issues = details?.issues ?? [];
  const condition = details?.condition;
  const health = details?.health_score ?? lamp.health_score;

  const issueTitle = (issue: PredictionIssue) => {
    if (issue.code.startsWith("ML_")) {
      const key = `conditions.${issue.code.slice(3).toLowerCase()}`;
      return t("ml_prefix") + (t.has(key) ? t(key) : issue.code);
    }
    const key = `issue_codes.${issue.code}`;
    return t.has(key) ? t(key) : issue.code.replace(/_/g, " ").toLowerCase();
  };
  const conditionLabel = (label: string) => {
    const key = `conditions.${label}`;
    return t.has(key) ? t(key) : label;
  };
  const dash = "—";

  return (
    <SectionCard
      title={t("title")}
      icon={BrainCircuit}
      className={className}
      footer={
        prediction ? (
          <p className="text-xs text-muted-foreground">
            {t("footer", {
              model: prediction.model_version ?? dash,
              hours: formatDecimal(details?.data_hours, 0),
              time: timeAgo(prediction.predicted_at, locale),
            })}
          </p>
        ) : undefined
      }
    >
      {!lamp.ml_ready ? (
        <Alert variant="warning">
          <Info className="h-4 w-4" />
          <AlertDescription>{t("not_ready", { count: lamp.telemetry_count ?? 0, required: ML_MIN_TELEMETRY })}</AlertDescription>
        </Alert>
      ) : !prediction ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 divide-x divide-border text-center">
            <div className="px-2">
              <StatusBadge value={prediction.risk_level || "unknown"} className="text-sm h-6" />
              <p className="mt-2 text-xs text-muted-foreground">{t("risk")}</p>
            </div>
            <div className="px-2">
              <p className="text-2xl font-semibold tabular-nums text-foreground">{health != null ? `${formatDecimal(health, 0)}%` : dash}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("health")}</p>
            </div>
            <div className="px-2">
              {prediction.days_to_failure != null ? (
                <p className="text-2xl font-semibold tabular-nums text-foreground">{prediction.days_to_failure}</p>
              ) : (
                <p className="pt-1.5 text-sm font-medium text-success">{t("days_none")}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{t("days")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Heading icon={BatteryCharging}>{t("battery_title")}</Heading>
              <dl className="text-sm">
                <div className="flex items-center justify-between gap-3 border-b border-border/50 py-1.5">
                  <dt className="text-muted-foreground">{t("soc")}</dt>
                  <dd>
                    {battery?.soc_pct != null ? (
                      <ProgressBar value={battery.soc_pct} />
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("soc_unknown")}</span>
                    )}
                  </dd>
                </div>
                <Stat
                  label={t("autonomy")}
                  value={battery?.autonomy_nights != null ? t("autonomy_value", { value: formatDecimal(battery.autonomy_nights, 1) }) : dash}
                />
                <Stat
                  label={t("nightly")}
                  value={battery?.nightly_consumption_ah != null ? `${formatDecimal(battery.nightly_consumption_ah, 2)} Ah` : dash}
                />
                <Stat
                  label={t("since_full")}
                  value={battery?.hours_since_full != null ? t("since_full_value", { value: formatDecimal(battery.hours_since_full, 0) }) : dash}
                />
                <Stat label={t("voltage")} value={battery?.voltage_v != null ? `${formatDecimal(battery.voltage_v, 2)} V` : dash} />
              </dl>
            </div>

            <div>
              <Heading icon={ShieldCheck}>{t("components_title")}</Heading>
              <dl className="text-sm">
                {COMPONENTS.map((component) => (
                  <div key={component} className="flex items-center justify-between gap-3 border-b border-border/50 py-1.5 last:border-0">
                    <dt className="text-muted-foreground">{t(`components.${component}`)}</dt>
                    <dd>
                      <ProgressBar value={details?.component_health?.[component]} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div>
            <Heading icon={ListChecks}>{t("issues_title")}</Heading>
            {issues.length === 0 ? (
              <p className="text-sm text-success">{t("no_issues")}</p>
            ) : (
              <ul className="space-y-2">
                {issues.map((issue) => (
                  <li key={issue.code} className="rounded-md border border-border/60 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge value={issue.severity} />
                      <span className="text-sm font-medium text-foreground">{issueTitle(issue)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{issue.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {condition && (
            <div>
              <Heading icon={Trees}>{t("condition_title")}</Heading>
              <p className="text-sm text-foreground">
                {t("condition_value", {
                  label: conditionLabel(condition.label),
                  probability: formatDecimal((condition.probability ?? 0) * 100, 0),
                })}
              </p>
              {condition.label !== "normal" && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(condition.confirmed ? "condition_windows" : "condition_unconfirmed", {
                    windows: condition.windows_flagged ?? 0,
                    checked: condition.windows_checked ?? 0,
                  })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
