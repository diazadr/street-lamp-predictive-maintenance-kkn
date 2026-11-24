"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ArrowRight, BrainCircuit, Target, Trees, type LucideIcon } from "lucide-react";
import { SectionCard } from "@/src/components/ui/dashboard/SectionCard";
import { Link } from "@/src/i18n/navigation";
import { cn, formatDecimal } from "@/src/lib/utils";
import { useIssueLabels } from "@/src/features/lamps/hooks/useIssueLabels";
import type { OverviewLamp, OverviewModel } from "../services/dashboardService";

const RISKS = [
  { key: "high", bar: "bg-destructive", dot: "bg-destructive" },
  { key: "medium", bar: "bg-warning", dot: "bg-warning" },
  { key: "low", bar: "bg-success", dot: "bg-success" },
  { key: "unknown", bar: "bg-muted-foreground/30", dot: "bg-muted-foreground/40" },
] as const;

function Heading({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {children}
    </h4>
  );
}

interface MlInsightCardProps {
  lamps: OverviewLamp[];
  conditions: Record<string, number>;
  model: OverviewModel | null;
  className?: string;
}

/** Fleet view of the predictive model: risk split, Random Forest verdicts and validated accuracy. */
export function MlInsightCard({ lamps, conditions, model, className }: MlInsightCardProps) {
  const t = useTranslations("DashboardHome.ml");
  const { conditionLabel } = useIssueLabels();

  const risk = Object.fromEntries(RISKS.map((r) => [r.key, 0])) as Record<(typeof RISKS)[number]["key"], number>;
  for (const lamp of lamps) {
    const key = lamp.risk_level && lamp.risk_level in risk ? lamp.risk_level : "unknown";
    risk[key as keyof typeof risk] += 1;
  }
  const total = lamps.length || 1;

  // Faults first (most lamps first), then normal, then lamps without an assessment.
  const verdicts = Object.entries(conditions).sort(([a, x], [b, y]) => {
    const rank = (k: string) => (k === "no_data" ? 2 : k === "normal" ? 1 : 0);
    return rank(a) - rank(b) || y - x;
  });

  const accuracy = [
    { label: t("rf"), value: model?.rf_accuracy, bar: "bg-primary" },
    { label: t("rules"), value: model?.rules_accuracy, bar: "bg-muted-foreground/40" },
  ];

  return (
    <SectionCard
      className={className}
      title={t("title")}
      icon={BrainCircuit}
      headerAction={
        <Link href="/workspace/monitoring" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          {t("see_detail")} <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      <div className="space-y-6">
        <div>
          <Heading icon={Target}>{t("risk_title")}</Heading>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
            {RISKS.map((r, i) =>
              risk[r.key] > 0 ? (
                <motion.div
                  key={r.key}
                  className={cn("h-full", r.bar, i > 0 && "border-l-2 border-card")}
                  initial={{ width: 0 }}
                  animate={{ width: `${(risk[r.key] / total) * 100}%` }}
                  transition={{ duration: 0.8, delay: i * 0.08 }}
                />
              ) : null
            )}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {RISKS.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <span className={cn("h-2 w-2 rounded-full", r.dot)} />
                  {t(`risk.${r.key}`)}
                </dt>
                <dd className="font-semibold tabular-nums text-foreground">{risk[r.key]}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <Heading icon={Trees}>{t("verdict_title")}</Heading>
          {verdicts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("verdict_empty")}</p>
          ) : (
            <ul className="space-y-1.5">
              {verdicts.map(([label, count]) => (
                <li key={label} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        label === "normal" ? "bg-success" : label === "no_data" ? "bg-muted-foreground/40" : "bg-warning"
                      )}
                    />
                    <span className="truncate text-foreground">{label === "no_data" ? t("no_data") : conditionLabel(label)}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{t("lamps", { count })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {model && (model.rf_accuracy != null || model.rules_accuracy != null) && (
          <div>
            <Heading icon={BrainCircuit}>{t("accuracy_title")}</Heading>
            <div className="space-y-2.5">
              {accuracy.map((a, i) => (
                <div key={a.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">{a.label}</span>
                    <span className="font-semibold tabular-nums text-foreground">{a.value != null ? `${formatDecimal(a.value * 100, 0)}%` : "—"}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={cn("h-full rounded-full", a.bar)}
                      initial={{ width: 0 }}
                      animate={{ width: `${(a.value ?? 0) * 100}%` }}
                      transition={{ duration: 0.9, delay: 0.2 + i * 0.1 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
              {t("accuracy_note", { windows: model.windows ?? "—", version: model.version ?? "—" })}
            </p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
