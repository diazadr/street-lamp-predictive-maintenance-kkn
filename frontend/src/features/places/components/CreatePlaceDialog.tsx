"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { getErrorMessage } from "@/src/lib/http/axios";
import { placeService } from "../services/placeService";

const EMPTY = { name: "", type: "", description: "", latitude: "", longitude: "" };

export function CreatePlaceDialog({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("PlaceList.create");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await placeService.create({
        name: form.name.trim(),
        type: form.type || null,
        description: form.description || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
      });
      toast.success(t("success"));
      setOpen(false);
      setForm(EMPTY);
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pname">{t("fields.name")} *</Label>
                <Input id="pname" required value={form.name} onChange={set("name")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ptype">{t("fields.type")}</Label>
                <Input id="ptype" value={form.type} onChange={set("type")} placeholder={t("type_placeholder")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plat">{t("fields.latitude")}</Label>
                <Input id="plat" type="number" step="any" value={form.latitude} onChange={set("latitude")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plng">{t("fields.longitude")}</Label>
                <Input id="plng" type="number" step="any" value={form.longitude} onChange={set("longitude")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pdesc">{t("fields.description")}</Label>
                <Textarea id="pdesc" rows={3} value={form.description} onChange={set("description")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={saving || !form.name.trim()}>
                {saving && <Loader2 className="animate-spin" />} {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
