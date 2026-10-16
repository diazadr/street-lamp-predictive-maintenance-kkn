"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { NativeSelect } from "@/src/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { getErrorMessage } from "@/src/lib/http/axios";
import type { Lamp, TicketPriority } from "@/src/types/domain";
import { ticketService } from "../services/ticketService";

interface Props {
  lamps: Lamp[];
  defaultLampId?: string;
  defaultOpen?: boolean;
  onCreated: () => void;
}

export function CreateTicketDialog({ lamps, defaultLampId = "", defaultOpen = false, onCreated }: Props) {
  const t = useTranslations("TicketList.create");
  const tStatus = useTranslations("StatusBadge");
  const [open, setOpen] = useState(defaultOpen);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ lamp_id: defaultLampId, title: "", description: "", priority: "medium" as TicketPriority });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (defaultLampId) setForm((f) => ({ ...f, lamp_id: defaultLampId }));
  }, [defaultLampId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ticketService.create({ ...form, title: form.title.trim(), description: form.description.trim() || undefined });
      toast.success(t("success"));
      setOpen(false);
      setForm({ lamp_id: "", title: "", description: "", priority: "medium" });
      onCreated();
    } catch (err) {
      toast.error(getErrorMessage(err, t("failed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("desc")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="tlamp">{t("lamp")} *</Label>
                <NativeSelect id="tlamp" required value={form.lamp_id} onChange={(e) => setForm((f) => ({ ...f, lamp_id: e.target.value }))} className="w-full">
                  <option value="">{t("choose_lamp")}</option>
                  {lamps.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lamp_code} · {tStatus(l.status)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tprio">{t("priority")}</Label>
                <NativeSelect id="tprio" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TicketPriority }))} className="w-full">
                  {(["low", "medium", "high", "critical"] as const).map((p) => (
                    <option key={p} value={p}>
                      {tStatus(p)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ttitle">{t("ticket_title")} *</Label>
              <Input id="ttitle" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t("title_placeholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tdesc">{t("description")}</Label>
              <Textarea id="tdesc" rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={saving || !form.lamp_id || !form.title.trim()}>
                {saving && <Loader2 className="animate-spin" />} {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
