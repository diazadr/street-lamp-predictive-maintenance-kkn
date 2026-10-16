"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { RefreshCw, Search, Wrench, X } from "lucide-react";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { DataTable, type Column } from "@/src/components/ui/dashboard/DataTable";
import { StatTile } from "@/src/components/ui/dashboard/StatTile";
import { StatusBadge } from "@/src/components/ui/dashboard/StatusBadge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { NativeSelect } from "@/src/components/ui/native-select";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { Link, useRouter } from "@/src/i18n/navigation";
import { timeAgo } from "@/src/lib/utils";
import { settle, useFetch } from "@/src/hooks/useFetch";
import type { Ticket } from "@/src/types/domain";
import { ticketService } from "../services/ticketService";
import { lampService } from "@/src/features/lamps/services/lampService";
import { CreateTicketDialog } from "../components/CreateTicketDialog";

const STATUSES = ["open", "in_progress", "resolved", "cancelled"];

export function TicketListView() {
  const t = useTranslations("TicketList");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const lampFilter = params.get("lamp") || "";
  const { user } = useAuth();
  const canCreate = user?.role !== "viewer";
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading, reload } = useFetch(
    () => settle([ticketService.list({ lamp_id: lampFilter || undefined }), lampService.list()] as const),
    [lampFilter]
  );
  const tickets = useMemo(() => data?.[0] ?? [], [data]);
  const lamps = useMemo(() => data?.[1] ?? [], [data]);
  const lampCode = useMemo(() => Object.fromEntries(lamps.map((l) => [l.id, l.lamp_code])), [lamps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((tk) => (!status || tk.status === status) && (!q || tk.title.toLowerCase().includes(q)));
  }, [tickets, status, search]);

  const count = (s: string) => tickets.filter((tk) => tk.status === s).length;

  const columns: Column<Ticket>[] = [
    {
      key: "title",
      label: t("cols.title"),
      render: (tk) => (
        <Link href={`/workspace/tickets/${tk.id}`} className="font-semibold text-primary hover:underline">
          {tk.title}
        </Link>
      ),
    },
    {
      key: "lamp",
      label: t("cols.lamp"),
      render: (tk) =>
        tk.lamp_id ? (
          <Link href={`/workspace/lamps/${tk.lamp_id}`} className="text-xs font-medium text-muted-foreground hover:text-primary">
            {lampCode[tk.lamp_id] || tk.lamp_id.slice(0, 8)}
          </Link>
        ) : (
          "—"
        ),
    },
    { key: "priority", label: t("cols.priority"), render: (tk) => <StatusBadge value={tk.priority} /> },
    { key: "status", label: t("cols.status"), render: (tk) => <StatusBadge value={tk.status} dot /> },
    { key: "created", label: t("cols.created"), render: (tk) => <span className="text-xs text-muted-foreground">{timeAgo(tk.created_at, locale)}</span> },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (tk) => (
        <Button asChild variant="outline" size="xs">
          <Link href={`/workspace/tickets/${tk.id}`}>{t("detail")}</Link>
        </Button>
      ),
    },
  ];

  return (
    <DashboardPageShell
      title={t("title")}
      subtitle={t("subtitle")}
      icon={Wrench}
      actions={
        <>
          <Button variant="outline" size="icon" onClick={reload} aria-label="Refresh">
            <RefreshCw className={isLoading ? "animate-spin" : ""} />
          </Button>
          {canCreate && (
            <CreateTicketDialog lamps={lamps} defaultLampId={lampFilter} defaultOpen={params.get("new") === "1"} onCreated={reload} />
          )}
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label={t("stats.total")} value={tickets.length} />
        <StatTile label={t("stats.open")} value={count("open")} tone="warning" />
        <StatTile label={t("stats.in_progress")} value={count("in_progress")} tone="primary" />
        <StatTile label={t("stats.resolved")} value={count("resolved")} tone="success" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
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
        {lampFilter && (
          <Button variant="secondary" size="sm" onClick={() => router.replace("/workspace/tickets")}>
            {t("lamp_filter", { code: lampCode[lampFilter] || "…" })} <X />
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyTitle={t("empty")} />
    </DashboardPageShell>
  );
}
