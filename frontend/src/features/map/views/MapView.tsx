"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Map as MapIcon, RefreshCw, Search } from "lucide-react";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { StatTile } from "@/src/components/ui/dashboard/StatTile";
import { StatusBadge } from "@/src/components/ui/dashboard/StatusBadge";
import { TabSwitch } from "@/src/components/ui/dashboard/TabSwitch";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { NativeSelect } from "@/src/components/ui/native-select";
import { useRouter } from "@/src/i18n/navigation";
import { formatDecimal } from "@/src/lib/utils";
import { useFetch } from "@/src/hooks/useFetch";
import type { Lamp } from "@/src/types/domain";
import { lampService } from "@/src/features/lamps/services/lampService";
import { STATUS_COLORS, type TileKey } from "../components/mapConfig";

const LampMap = dynamic(() => import("../components/LampMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

export function MapView() {
  const t = useTranslations("MapPage");
  const tStatus = useTranslations("StatusBadge");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [tile, setTile] = useState<TileKey | "auto">("auto");
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);

  const { data: all = [], isLoading, reload } = useFetch(() => lampService.list(), [], [] as Lamp[]);
  const lamps = useMemo(() => all.filter((l) => l.latitude && l.longitude), [all]);
  const visible = useMemo(() => (status ? lamps.filter((l) => l.status === status) : lamps), [lamps, status]);
  const activeTile: TileKey = tile === "auto" ? "street" : tile;

  const search = () => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const found = lamps.find((l) => l.lamp_code.toLowerCase().includes(q));
    if (found) {
      setFlyTo([Number(found.latitude), Number(found.longitude)]);
      toast.success(t("found", { code: found.lamp_code }));
    } else {
      toast.error(t("not_found"));
    }
  };

  const avgBattery = lamps.length ? Math.round(lamps.reduce((s, l) => s + (Number(l.last_battery_level) || 0), 0) / lamps.length) : 0;

  return (
    <DashboardPageShell
      title={t("title")}
      subtitle={t("subtitle")}
      icon={MapIcon}
      actions={
        <Button variant="outline" size="icon" onClick={reload} aria-label="Refresh">
          <RefreshCw className={isLoading ? "animate-spin" : ""} />
        </Button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label={t("stats.total")} value={lamps.length} />
        <StatTile label={t("stats.online")} value={lamps.filter((l) => l.status === "online").length} tone="success" />
        <StatTile label={t("stats.fault")} value={lamps.filter((l) => l.status === "fault").length} tone="destructive" />
        <StatTile label={t("stats.offline")} value={lamps.filter((l) => l.status === "offline").length} tone="muted" />
        <StatTile label={t("stats.avg_battery")} value={`${avgBattery}%`} tone="primary" className="col-span-2 md:col-span-1" />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex flex-1 gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder={t("search")} className="pl-9 rounded-xl" />
          </div>
          <Button onClick={search}>{t("search_button")}</Button>
        </div>
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="lg:w-44">
          <option value="">{t("all_status")}</option>
          {Object.keys(STATUS_COLORS).map((s) => (
            <option key={s} value={s}>
              {tStatus(s)}
            </option>
          ))}
        </NativeSelect>
        <TabSwitch
          className="w-fit"
          activeTab={tile}
          onTabChange={(v) => setTile(v as TileKey | "auto")}
          tabs={[
            { value: "auto", label: t("layers.auto") },
            { value: "satellite", label: t("layers.satellite") },
          ]}
        />
      </div>

      <div className="relative h-[560px] overflow-hidden rounded-xl border border-border bg-card shadow-sm isolate">
        <LampMap
          lamps={visible}
          tile={activeTile}
          flyTo={flyTo}
          renderPopup={(lamp) => (
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold">{lamp.lamp_code}</p>
                <StatusBadge value={lamp.status} dot />
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">{t("popup.battery")}</dt>
                <dd>{lamp.last_battery_level != null ? `${formatDecimal(lamp.last_battery_level, 0)}%` : "—"}</dd>
                <dt className="text-muted-foreground">{t("popup.brightness")}</dt>
                <dd>{lamp.last_brightness != null ? `${formatDecimal(lamp.last_brightness, 0)}%` : "—"}</dd>
                <dt className="text-muted-foreground">{t("popup.health")}</dt>
                <dd>{lamp.health_score != null ? formatDecimal(lamp.health_score, 0) : "—"}</dd>
                <dt className="text-muted-foreground">{t("popup.risk")}</dt>
                <dd className="capitalize">{lamp.risk_level || "—"}</dd>
              </dl>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="flex-1" onClick={() => router.push(`/workspace/lamps/${lamp.id}`)}>
                  {t("popup.detail")}
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => router.push(`/workspace/tickets?lamp=${lamp.id}&new=1`)}>
                  {t("popup.ticket")}
                </Button>
              </div>
            </div>
          )}
        />
        {!isLoading && lamps.length === 0 && (
          <div className="absolute inset-x-0 top-4 z-[500] mx-auto w-fit rounded-full border border-border bg-background/90 px-4 py-2 text-xs text-muted-foreground shadow">
            {t("no_coords")}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-5">
        {Object.entries(STATUS_COLORS).map(([key, color]) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full ring-2 ring-background" style={{ background: color }} />
            {tStatus(key)} <span className="opacity-60">({lamps.filter((l) => l.status === key).length})</span>
          </span>
        ))}
      </div>
    </DashboardPageShell>
  );
}
