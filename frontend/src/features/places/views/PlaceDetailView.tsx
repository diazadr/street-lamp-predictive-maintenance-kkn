"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Battery, Lightbulb, MapPin, Wifi } from "lucide-react";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { MetricCard } from "@/src/components/ui/dashboard/MetricCard";
import { SectionCard } from "@/src/components/ui/dashboard/SectionCard";
import { DataTable, type Column } from "@/src/components/ui/dashboard/DataTable";
import { StatusBadge } from "@/src/components/ui/dashboard/StatusBadge";
import { ProgressBar } from "@/src/components/ui/dashboard/ProgressBar";
import { EmptyState } from "@/src/components/ui/dashboard/EmptyState";
import { CardSkeleton } from "@/src/components/ui/dashboard/LoadingSkeleton";
import { Badge } from "@/src/components/ui/badge";
import { setBreadcrumbLabel } from "@/src/components/layouts/dashboard/navbar/NavBreadcrumbs";
import { Link } from "@/src/i18n/navigation";
import { formatDecimal, timeAgo } from "@/src/lib/utils";
import { settle, useFetch } from "@/src/hooks/useFetch";
import type { Lamp } from "@/src/types/domain";
import { placeService } from "../services/placeService";

export function PlaceDetailView({ id }: { id: string }) {
  const t = useTranslations("PlaceDetail");
  const tList = useTranslations("LampList");
  const locale = useLocale();
  const { data, isLoading } = useFetch(() => settle([placeService.get(id), placeService.lamps(id)] as const), [id]);
  const place = data?.[0];
  const lamps = data?.[1] ?? [];

  useEffect(() => {
    if (place?.name) setBreadcrumbLabel(id, place.name);
  }, [place, id]);

  if (isLoading) return <CardSkeleton count={4} />;
  if (!place) return <EmptyState icon={MapPin} title={t("not_found")} />;

  const avgBattery = lamps.length ? lamps.reduce((s, l) => s + (l.last_battery_level || 0), 0) / lamps.length : 0;

  const columns: Column<Lamp>[] = [
    { key: "code", label: tList("cols.code"), render: (l) => <Link href={`/workspace/lamps/${l.id}`} className="font-semibold text-primary hover:underline">{l.lamp_code}</Link> },
    { key: "status", label: tList("cols.status"), render: (l) => <StatusBadge value={l.status} dot /> },
    { key: "battery", label: tList("cols.battery"), render: (l) => <ProgressBar value={l.last_battery_level} /> },
    { key: "health", label: tList("cols.health"), render: (l) => (l.health_score != null ? `${formatDecimal(l.health_score, 0)}%` : "—") },
    { key: "seen", label: tList("cols.last_seen"), render: (l) => <span className="text-xs text-muted-foreground">{timeAgo(l.last_seen, locale)}</span> },
  ];

  return (
    <DashboardPageShell
      title={place.name}
      backHref="/workspace/places"
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          {place.type && <Badge variant="info">{place.type}</Badge>}
          {place.description}
        </span>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title={t("total")} value={lamps.length} icon={Lightbulb} />
        <MetricCard title={t("online")} value={lamps.filter((l) => l.status === "online").length} icon={Wifi} iconColor="text-success" iconBg="bg-success/10" />
        <MetricCard title={t("fault")} value={lamps.filter((l) => l.status === "fault").length} icon={AlertTriangle} iconColor="text-destructive" iconBg="bg-destructive/10" />
        <MetricCard title={t("avg_battery")} value={`${avgBattery.toFixed(0)}%`} icon={Battery} />
      </div>
      <SectionCard title={t("info")} icon={MapPin}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t("type")}:</dt>
            <dd className="font-medium">{place.type || "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t("coords")}:</dt>
            <dd className="font-mono text-xs font-medium">
              {place.latitude && place.longitude ? `${Number(place.latitude).toFixed(6)}, ${Number(place.longitude).toFixed(6)}` : "—"}
            </dd>
          </div>
        </dl>
      </SectionCard>
      <div className="space-y-3">
        <h2 className="text-base font-semibold">{t("lamps", { count: lamps.length })}</h2>
        <DataTable columns={columns} data={lamps} emptyTitle={t("no_lamps")} />
      </div>
    </DashboardPageShell>
  );
}
