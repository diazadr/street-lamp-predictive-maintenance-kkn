"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RefreshCw, Search, Users, XCircle } from "lucide-react";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { DataTable, type Column } from "@/src/components/ui/dashboard/DataTable";
import { StatusBadge } from "@/src/components/ui/dashboard/StatusBadge";
import { StatTile } from "@/src/components/ui/dashboard/StatTile";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { NativeSelect } from "@/src/components/ui/native-select";
import { Textarea } from "@/src/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { getErrorMessage } from "@/src/lib/http/axios";
import { timeAgo } from "@/src/lib/utils";
import { useFetch } from "@/src/hooks/useFetch";
import type { User } from "@/src/types/auth";
import { adminUserService } from "../services/adminUserService";

const STATUSES = ["active", "awaiting_approval", "pending", "rejected", "suspended"];

export function UserManagementView() {
  const t = useTranslations("UserManagement");
  const tStatus = useTranslations("StatusBadge");
  const locale = useLocale();
  const { user: me } = useAuth();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState("");
  const [reject, setReject] = useState<{ id: string; reason: string } | null>(null);

  const { data: users = [], isLoading, reload } = useFetch(() => adminUserService.list(), [], [] as User[]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => (!status || u.status === status) && (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
  }, [users, status, search]);
  const awaiting = users.filter((u) => u.status === "awaiting_approval").length;

  const run = async (id: string, action: () => Promise<unknown>, success: string) => {
    setProcessing(id);
    try {
      await action();
      toast.success(success);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, t("failed")));
    } finally {
      setProcessing("");
    }
  };

  const columns: Column<User>[] = [
    {
      key: "name",
      label: t("cols.name"),
      render: (u) => (
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{u.name.charAt(0).toUpperCase()}</span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{u.name}</p>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: t("cols.role"),
      render: (u) =>
        u.id === me?.id || u.status !== "active" ? (
          <StatusBadge value={u.role} />
        ) : (
          <NativeSelect
            value={u.role}
            disabled={processing === u.id}
            onChange={(e) => run(u.id, () => adminUserService.changeRole(u.id, e.target.value), t("role_changed"))}
            className="h-8 w-32 text-xs"
          >
            <option value="admin">{tStatus("admin")}</option>
            <option value="operator">{tStatus("operator")}</option>
          </NativeSelect>
        ),
    },
    { key: "status", label: t("cols.status"), render: (u) => <StatusBadge value={u.status} dot /> },
    { key: "created", label: t("cols.registered"), render: (u) => <span className="text-xs text-muted-foreground">{timeAgo(u.created_at, locale)}</span> },
    {
      key: "actions",
      label: t("cols.actions"),
      align: "right",
      render: (u) => {
        const busy = processing === u.id;
        if (u.id === me?.id) return <span className="text-xs text-muted-foreground">{t("you")}</span>;
        return (
          <div className="flex justify-end gap-1.5">
            {u.status === "awaiting_approval" && (
              <>
                <Button size="xs" variant="accent" disabled={busy} onClick={() => run(u.id, () => adminUserService.approve(u.id), t("approved"))}>
                  {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} {t("approve")}
                </Button>
                <Button size="xs" variant="destructive" disabled={busy} onClick={() => setReject({ id: u.id, reason: "" })}>
                  <XCircle /> {t("reject")}
                </Button>
              </>
            )}
            {u.status === "active" && (
              <Button size="xs" variant="outline" disabled={busy} onClick={() => run(u.id, () => adminUserService.suspend(u.id), t("suspended"))}>
                {t("suspend")}
              </Button>
            )}
            {u.status === "suspended" && (
              <Button size="xs" variant="outline" disabled={busy} onClick={() => run(u.id, () => adminUserService.activate(u.id), t("activated"))}>
                {t("activate")}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DashboardPageShell
      title={t("title")}
      subtitle={t("subtitle")}
      icon={Users}
      actions={
        <Button variant="outline" size="icon" onClick={reload} aria-label="Refresh">
          <RefreshCw className={isLoading ? "animate-spin" : ""} />
        </Button>
      }
    >
      {awaiting > 0 && (
        <Alert variant="warning">
          <Users className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{t("awaiting_alert", { count: awaiting })}</span>
            <Button size="xs" variant="outline" onClick={() => setStatus("awaiting_approval")}>
              {t("show_awaiting")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label={t("stats.total")} value={users.length} />
        <StatTile label={t("stats.active")} value={users.filter((u) => u.status === "active").length} tone="success" />
        <StatTile label={t("stats.awaiting")} value={awaiting} tone="warning" />
        <StatTile label={t("stats.admins")} value={users.filter((u) => u.role === "admin").length} tone="primary" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="pl-9 rounded-xl" />
        </div>
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-52">
          <option value="">{t("all_status")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {tStatus(s)}
            </option>
          ))}
        </NativeSelect>
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyTitle={t("empty")} />

      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("reject_title")}</DialogTitle>
            <DialogDescription>{t("reject_desc")}</DialogDescription>
          </DialogHeader>
          <Textarea rows={3} value={reject?.reason || ""} onChange={(e) => setReject((r) => (r ? { ...r, reason: e.target.value } : r))} placeholder={t("reject_placeholder")} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!!processing}
              onClick={async () => {
                if (!reject) return;
                await run(reject.id, () => adminUserService.reject(reject.id, reject.reason), t("rejected"));
                setReject(null);
              }}
            >
              {processing && <Loader2 className="animate-spin" />} {t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPageShell>
  );
}
