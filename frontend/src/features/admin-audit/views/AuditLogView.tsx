"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, RefreshCw, ScrollText } from "lucide-react";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { DataTable, type Column } from "@/src/components/ui/dashboard/DataTable";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { NativeSelect } from "@/src/components/ui/native-select";
import { formatDateTime } from "@/src/lib/utils";
import { useFetch } from "@/src/hooks/useFetch";
import { auditService, type AuditLog } from "../services/auditService";

const PAGE_SIZE = 50;
const ACTIONS = ["login", "logout", "create", "update", "delete", "approve", "reject", "suspend", "export", "command", "settings"];

const actionVariant = (a: string) =>
  a.includes("delete") || a.includes("reject")
    ? "destructive"
    : a.includes("create") || a.includes("approve")
      ? "success"
      : a.includes("update") || a.includes("suspend") || a.includes("settings")
        ? "warning"
        : "info";

export function AuditLogView() {
  const t = useTranslations("AuditLog");
  const locale = useLocale();
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, reload } = useFetch(
    () => auditService.list({ skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, action: action || undefined }),
    [page, action]
  );
  const logs = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Column<AuditLog>[] = [
    { key: "time", label: t("cols.time"), render: (l) => <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatDateTime(l.created_at, locale)}</span> },
    {
      key: "user",
      label: t("cols.user"),
      render: (l) => (
        <div>
          <p className="text-sm text-foreground">{l.user?.name || t("system")}</p>
          <p className="text-xs text-muted-foreground">{l.user?.email || ""}</p>
        </div>
      ),
    },
    { key: "action", label: t("cols.action"), render: (l) => <Badge variant={actionVariant(l.action)}>{l.action}</Badge> },
    { key: "resource", label: t("cols.resource"), render: (l) => <span className="text-xs text-muted-foreground">{l.resource_type || "—"}</span> },
    { key: "id", label: "ID", render: (l) => (l.resource_id ? <span className="font-mono text-xs text-muted-foreground">{String(l.resource_id).slice(0, 8)}…</span> : "—") },
    { key: "details", label: t("cols.details"), render: (l) => <span className="block max-w-[240px] truncate text-xs text-muted-foreground" title={l.details || ""}>{l.details || "—"}</span> },
    { key: "ip", label: "IP", render: (l) => <span className="font-mono text-xs text-muted-foreground">{l.ip_address || "—"}</span> },
  ];

  return (
    <DashboardPageShell
      title={t("title")}
      subtitle={t("subtitle")}
      icon={ScrollText}
      actions={
        <Button variant="outline" size="icon" onClick={reload} aria-label="Refresh">
          <RefreshCw className={isLoading ? "animate-spin" : ""} />
        </Button>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <NativeSelect
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="w-52"
        >
          <option value="">{t("all_actions")}</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </NativeSelect>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {t("page_info", { page, pages, total })}
          <Button variant="outline" size="icon-sm" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)} aria-label="prev">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={page >= pages || isLoading} onClick={() => setPage((p) => p + 1)} aria-label="next">
            <ChevronRight />
          </Button>
        </div>
      </div>
      <DataTable columns={columns} data={logs} isLoading={isLoading} pageSize={0} emptyTitle={t("empty")} />
    </DashboardPageShell>
  );
}
