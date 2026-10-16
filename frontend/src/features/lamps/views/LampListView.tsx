"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Lightbulb, RefreshCw, Search } from "lucide-react";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { DataTable, type Column } from "@/src/components/ui/dashboard/DataTable";
import { StatTile } from "@/src/components/ui/dashboard/StatTile";
import { StatusBadge } from "@/src/components/ui/dashboard/StatusBadge";
import { ProgressBar } from "@/src/components/ui/dashboard/ProgressBar";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { NativeSelect } from "@/src/components/ui/native-select";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { Link } from "@/src/i18n/navigation";
import { formatDecimal, timeAgo } from "@/src/lib/utils";
import { settle, useFetch } from "@/src/hooks/useFetch";
import type { Lamp } from "@/src/types/domain";
import { lampService } from "../services/lampService";
import { placeService } from "@/src/features/places/services/placeService";
import { CreateLampDialog } from "../components/CreateLampDialog";

const STATUSES = ["online", "warning", "fault", "maintenance", "offline"];

export function LampListView() {
  const t = useTranslations("LampList");
  const locale = useLocale();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading, reload } = useFetch(() => settle([lampService.list(), placeService.list()] as const), []);
  const lamps = useMemo(() => data?.[0] ?? [], [data]);
  const places = useMemo(() => data?.[1] ?? [], [data]);
  const placeName = useMemo(() => Object.fromEntries(places.map((p) => [p.id, p.name])), [places]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lamps.filter(
      (l) =>
        (!status || l.status === status) &&
        (!q || l.lamp_code.toLowerCase().includes(q) || (l.place_id && placeName[l.place_id]?.toLowerCase().includes(q)))
    );
  }, [lamps, status, search, placeName]);

  const avgBattery = lamps.length ? lamps.reduce((s, l) => s + (l.last_battery_level || 0), 0) / lamps.length : 0;

  const columns: Column<Lamp>[] = [
    {
      key: "lamp_code",
      label: t("cols.code"),
      render: (l) => (
        <Link href={`/workspace/lamps/${l.id}`} className="font-semibold text-primary hover:underline">
          {l.lamp_code}
        </Link>
      ),
    },
    { key: "place", label: t("cols.place"), render: (l) => <span className="text-muted-foreground">{(l.place_id && placeName[l.place_id]) || "—"}</span> },
    { key: "status", label: t("cols.status"), render: (l) => <StatusBadge value={l.status} dot /> },
    { key: "battery", label: t("cols.battery"), render: (l) => <ProgressBar value={l.last_battery_level} /> },
    { key: "brightness", label: t("cols.brightness"), render: (l) => (l.last_brightness != null ? `${formatDecimal(l.last_brightness, 0)}%` : "—") },
    {
      key: "health",
      label: t("cols.health"),
      render: (l) =>
        l.health_score != null ? (
          <span className={`font-medium tabular-nums ${l.health_score > 70 ? "text-success" : l.health_score > 40 ? "text-warning" : "text-destructive"}`}>
            {formatDecimal(l.health_score, 0)}%
          </span>
        ) : (
          "—"
        ),
    },
    { key: "risk", label: t("cols.risk"), render: (l) => (l.risk_level ? <StatusBadge value={l.risk_level} /> : "—") },
    { key: "last_seen", label: t("cols.last_seen"), render: (l) => <span className="text-xs text-muted-foreground">{timeAgo(l.last_seen, locale)}</span> },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (l) => (
        <Button asChild variant="outline" size="xs">
          <Link href={`/workspace/lamps/${l.id}`}>{t("detail")}</Link>
        </Button>
      ),
    },
  ];

  return (
    <DashboardPageShell
      title={t("title")}
      subtitle={t("subtitle")}
      icon={Lightbulb}
      actions={
        <>
          <Button variant="outline" size="icon" onClick={reload} aria-label="Refresh">
            <RefreshCw className={isLoading ? "animate-spin" : ""} />
          </Button>
          {isAdmin && <CreateLampDialog places={places} onCreated={reload} />}
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label={t("stats.total")} value={lamps.length} />
        <StatTile label={t("stats.online")} value={lamps.filter((l) => l.status === "online").length} tone="success" />
        <StatTile label={t("stats.fault")} value={lamps.filter((l) => l.status === "fault").length} tone="destructive" />
        <StatTile label={t("stats.avg_battery")} value={`${avgBattery.toFixed(0)}%`} tone="primary" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="pl-9 rounded-xl" />
        </div>
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48">
          <option value="">{t("all_status")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </NativeSelect>
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyTitle={t("empty")} />
    </DashboardPageShell>
  );
}
