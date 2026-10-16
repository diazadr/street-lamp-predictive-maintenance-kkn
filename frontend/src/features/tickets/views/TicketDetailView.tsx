"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, Clock, ImageIcon, Loader2, MessageSquare, Upload, User, Wrench, XCircle, Info } from "lucide-react";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { SectionCard } from "@/src/components/ui/dashboard/SectionCard";
import { StatusBadge } from "@/src/components/ui/dashboard/StatusBadge";
import { EmptyState } from "@/src/components/ui/dashboard/EmptyState";
import { CardSkeleton } from "@/src/components/ui/dashboard/LoadingSkeleton";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { setBreadcrumbLabel } from "@/src/components/layouts/dashboard/navbar/NavBreadcrumbs";
import { Link } from "@/src/i18n/navigation";
import { API_BASE_URL, getErrorMessage } from "@/src/lib/http/axios";
import { formatDateTime, timeAgo } from "@/src/lib/utils";
import { settle, useFetch } from "@/src/hooks/useFetch";
import type { TicketStatus } from "@/src/types/domain";
import { ticketService } from "../services/ticketService";
import { lampService } from "@/src/features/lamps/services/lampService";

const MAX_ATTACHMENTS = 5;

export function TicketDetailView({ id }: { id: string }) {
  const t = useTranslations("TicketDetail");
  const locale = useLocale();
  const { user } = useAuth();
  const canEdit = user?.role !== "viewer";
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "note" | "status" | "upload">("");

  const { data, isLoading, reload } = useFetch(
    () => settle([ticketService.get(id), ticketService.logs(id), ticketService.attachments(id)] as const),
    [id]
  );
  const [ticket, logs = [], attachments = []] = data || [];
  const { data: lamp } = useFetch(async () => (ticket?.lamp_id ? lampService.get(ticket.lamp_id) : null), [ticket?.lamp_id]);

  useEffect(() => {
    if (ticket?.title) setBreadcrumbLabel(id, ticket.title.length > 24 ? `${ticket.title.slice(0, 24)}…` : ticket.title);
  }, [ticket, id]);

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy("note");
    try {
      await ticketService.addNote(id, note.trim());
      setNote("");
      toast.success(t("note_added"));
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, t("note_failed")));
    } finally {
      setBusy("");
    }
  };

  const updateStatus = async (status: TicketStatus) => {
    setBusy("status");
    try {
      await ticketService.updateStatus(id, status);
      toast.success(t("status_updated"));
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, t("status_failed")));
    } finally {
      setBusy("");
    }
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("file_too_big"));
      return;
    }
    setBusy("upload");
    try {
      await ticketService.upload(id, file);
      toast.success(t("upload_success"));
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, t("upload_failed")));
    } finally {
      setBusy("");
    }
  };

  if (isLoading && !ticket) return <CardSkeleton count={3} className="lg:grid-cols-3" />;
  if (!ticket) return <EmptyState icon={Wrench} title={t("not_found")} />;

  const fileUrl = (path: string) => `${API_BASE_URL}/uploads/${path.replace(/^\/?(uploads\/)?/, "")}`;

  return (
    <DashboardPageShell
      title={ticket.title}
      backHref="/workspace/tickets"
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge value={ticket.status} dot />
          <StatusBadge value={ticket.priority} />
          <span>· {t("created", { time: timeAgo(ticket.created_at, locale) })}</span>
        </span>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title={t("description")} icon={Info}>
            <p className="whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">{ticket.description || t("no_description")}</p>
          </SectionCard>

          {canEdit && (
            <SectionCard title={t("add_note")} icon={MessageSquare}>
              <form onSubmit={addNote} className="space-y-3">
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("note_placeholder")} />
                <Button type="submit" disabled={busy === "note" || !note.trim()}>
                  {busy === "note" && <Loader2 className="animate-spin" />} {t("send_note")}
                </Button>
              </form>
            </SectionCard>
          )}

          <SectionCard title={t("timeline")} icon={Clock}>
            {logs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("no_activity")}</p>
            ) : (
              <ol className="relative space-y-5 border-l border-border pl-6">
                {logs.map((log, i) => (
                  <li key={log.id || i} className="relative">
                    <span className="absolute -left-[33px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                      <User className="h-3 w-3" />
                    </span>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{log.user_name || t("system")}</span> · {timeAgo(log.created_at, locale)}
                      {log.action && log.action !== "note" && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px]">{log.action}</span>}
                    </p>
                    {log.note && <p className="mt-1 text-sm text-foreground">{log.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <SectionCard
            title={t("attachments", { count: attachments.length, max: MAX_ATTACHMENTS })}
            icon={ImageIcon}
            headerAction={
              canEdit && (
                <Button asChild variant="outline" size="sm" disabled={busy === "upload" || attachments.length >= MAX_ATTACHMENTS}>
                  <label className={attachments.length >= MAX_ATTACHMENTS ? "pointer-events-none opacity-50" : "cursor-pointer"}>
                    {busy === "upload" ? <Loader2 className="animate-spin" /> : <Upload />} {t("upload")}
                    <input type="file" accept="image/*" className="hidden" onChange={upload} />
                  </label>
                </Button>
              )
            }
          >
            {attachments.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {attachments.map((att) => (
                  <a
                    key={att.id}
                    href={fileUrl(att.file_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square overflow-hidden rounded-xl border border-border bg-muted hover:border-primary/40 transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(att.file_path)} alt={att.file_name} className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("no_attachments")}</p>
            )}
          </SectionCard>
        </div>

        <div className="space-y-4">
          {canEdit && (
            <SectionCard title={t("actions")}>
              <div className="space-y-2">
                {ticket.status === "open" && (
                  <Button className="w-full" onClick={() => updateStatus("in_progress")} disabled={busy === "status"}>
                    <Clock /> {t("start")}
                  </Button>
                )}
                {ticket.status === "in_progress" && (
                  <Button className="w-full" variant="accent" onClick={() => updateStatus("resolved")} disabled={busy === "status"}>
                    <CheckCircle2 /> {t("resolve")}
                  </Button>
                )}
                {ticket.status !== "cancelled" && ticket.status !== "resolved" && (
                  <Button className="w-full" variant="outline" onClick={() => updateStatus("cancelled")} disabled={busy === "status"}>
                    <XCircle /> {t("cancel")}
                  </Button>
                )}
                {(ticket.status === "resolved" || ticket.status === "cancelled") && (
                  <Button className="w-full" variant="outline" onClick={() => updateStatus("open")} disabled={busy === "status"}>
                    {t("reopen")}
                  </Button>
                )}
              </div>
            </SectionCard>
          )}

          <SectionCard title={t("details")}>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{t("lamp")}</dt>
                <dd>
                  {ticket.lamp_id ? (
                    <Link href={`/workspace/lamps/${ticket.lamp_id}`} className="font-medium text-primary hover:underline">
                      {lamp?.lamp_code || ticket.lamp_id.slice(0, 8)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("assigned")}</dt>
                <dd className="font-medium">{ticket.assigned_to ? `#${ticket.assigned_to.slice(0, 8)}` : t("unassigned")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("created_at")}</dt>
                <dd className="font-medium">{formatDateTime(ticket.created_at, locale)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("updated_at")}</dt>
                <dd className="font-medium">{formatDateTime(ticket.updated_at, locale)}</dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>
    </DashboardPageShell>
  );
}
