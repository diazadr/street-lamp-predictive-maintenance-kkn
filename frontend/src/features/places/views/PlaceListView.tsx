"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, RefreshCw, Search } from "lucide-react";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { DataTable, type Column } from "@/src/components/ui/dashboard/DataTable";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { Link } from "@/src/i18n/navigation";
import { useFetch } from "@/src/hooks/useFetch";
import type { Place } from "@/src/types/domain";
import { placeService } from "../services/placeService";
import { CreatePlaceDialog } from "../components/CreatePlaceDialog";

export function PlaceListView() {
  const t = useTranslations("PlaceList");
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const { data: places = [], isLoading, reload } = useFetch(() => placeService.list(), [], [] as Place[]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return places.filter((p) => !q || p.name.toLowerCase().includes(q) || p.type?.toLowerCase().includes(q));
  }, [places, search]);

  const columns: Column<Place>[] = [
    {
      key: "name",
      label: t("cols.name"),
      render: (p) => (
        <Link href={`/workspace/places/${p.id}`} className="font-semibold text-primary hover:underline">
          {p.name}
        </Link>
      ),
    },
    { key: "type", label: t("cols.type"), render: (p) => (p.type ? <Badge variant="info">{p.type}</Badge> : "—") },
    { key: "description", label: t("cols.description"), render: (p) => <span className="block max-w-xs truncate text-muted-foreground">{p.description || "—"}</span> },
    {
      key: "coords",
      label: t("cols.coords"),
      render: (p) =>
        p.latitude && p.longitude ? (
          <span className="font-mono text-xs text-muted-foreground">
            {Number(p.latitude).toFixed(4)}, {Number(p.longitude).toFixed(4)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (p) => (
        <Button asChild variant="outline" size="xs">
          <Link href={`/workspace/places/${p.id}`}>{t("detail")}</Link>
        </Button>
      ),
    },
  ];

  return (
    <DashboardPageShell
      title={t("title")}
      subtitle={t("subtitle")}
      icon={MapPin}
      actions={
        <>
          <Button variant="outline" size="icon" onClick={reload} aria-label="Refresh">
            <RefreshCw className={isLoading ? "animate-spin" : ""} />
          </Button>
          {isAdmin && <CreatePlaceDialog onCreated={reload} />}
        </>
      }
    >
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="pl-9 rounded-xl" />
      </div>
      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyTitle={t("empty")} />
    </DashboardPageShell>
  );
}
