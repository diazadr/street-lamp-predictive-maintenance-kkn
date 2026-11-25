"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ChevronRight, Lightbulb, MapPin } from "lucide-react";
import { SectionCard } from "@/src/components/ui/dashboard/SectionCard";
import { StatusBadge } from "@/src/components/ui/dashboard/StatusBadge";
import { ProgressBar } from "@/src/components/ui/dashboard/ProgressBar";
import { EmptyState } from "@/src/components/ui/dashboard/EmptyState";
import { Link } from "@/src/i18n/navigation";
import { cn, formatDecimal, timeAgo } from "@/src/lib/utils";
import { useIssueLabels } from "@/src/features/lamps/hooks/useIssueLabels";
import type { OverviewLamp } from "../services/dashboardService";

const MAX_ROWS = 6;

const ICON_TONE: Record<string, string> = {
  online: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  fault: "bg-destructive/10 text-destructive",
  maintenance: "bg-primary/10 text-primary",
  offline: "bg-muted text-muted-foreground",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-destructive",
  warning: "bg-warning",
  info: "bg-primary",
};

/** Lamps with their latest assessment, most urgent first (the API sorts them). */
export function LampWatchlist({ lamps, className }: { lamps: OverviewLamp[]; className?: string }) {
  const t = useTranslations("DashboardHome.lamps");
  const locale = useLocale();
  const { issueTitle } = useIssueLabels();
  const rows = lamps.slice(0, MAX_ROWS);

  return (
    <SectionCard
      className={className}
      title={t("title")}
      icon={Lightbulb}
      noPadding
      headerAction={
        <Link href="/workspace/lamps" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          {t("see_all")} <ArrowRight className="h-3 w-3" />
        </Link>
      }
      footer={
        lamps.length > MAX_ROWS ? (
          <p className="text-xs text-muted-foreground">{t("showing", { shown: rows.length, total: lamps.length })}</p>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <EmptyState icon={Lightbulb} title={t("empty")} className="py-12" />
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                <th className="px-6 py-3 font-medium">{t("cols.lamp")}</th>
                <th className="px-3 py-3 font-medium">{t("cols.status")}</th>
                <th className="px-3 py-3 font-medium">{t("cols.health")}</th>
                <th className="px-3 py-3 font-medium">{t("cols.battery")}</th>
                <th className="px-3 py-3 font-medium">{t("cols.finding")}</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((lamp) => (
                <tr key={lamp.id} className="group transition-colors hover:bg-muted/40">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", ICON_TONE[lamp.status] ?? ICON_TONE.offline)}>
                        <Lightbulb className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <Link href={`/workspace/lamps/${lamp.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">
                          {lamp.lamp_code}
                        </Link>
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          {lamp.place_name ? (
                            <>
                              <MapPin className="h-3 w-3 shrink-0" /> {lamp.place_name}
                            </>
                          ) : (
                            timeAgo(lamp.last_seen, locale)
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge value={lamp.status} dot />
                      {lamp.risk_level && lamp.risk_level !== "low" && <StatusBadge value={lamp.risk_level} />}
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <ProgressBar value={lamp.health_score} />
                  </td>
                  <td className="px-3 py-3.5">
                    <ProgressBar value={lamp.battery_soc} />
                    {lamp.autonomy_nights != null && (
                      <p className="mt-1 text-[11px] text-muted-foreground">{t("reserve", { value: formatDecimal(lamp.autonomy_nights, 1) })}</p>
                    )}
                  </td>
                  <td className="max-w-[16rem] px-3 py-3.5">
                    {lamp.top_issue ? (
                      <div className="flex items-start gap-2">
                        <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", SEVERITY_DOT[lamp.top_issue.severity] ?? "bg-muted-foreground")} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{issueTitle(lamp.top_issue.code)}</p>
                          {lamp.issue_count > 1 && <p className="text-[11px] text-muted-foreground">{t("more", { count: lamp.issue_count - 1 })}</p>}
                        </div>
                      </div>
                    ) : lamp.predicted_at ? (
                      <span className="text-success">{t("no_issue")}</span>
                    ) : (
                      <span className="text-muted-foreground">{t(lamp.ml_ready ? "waiting_model" : "waiting_data")}</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <Link
                      href={`/workspace/lamps/${lamp.id}`}
                      aria-label={t("open", { code: lamp.lamp_code })}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
