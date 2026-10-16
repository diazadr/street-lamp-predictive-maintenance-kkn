"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { NativeSelect } from "@/src/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { getErrorMessage } from "@/src/lib/http/axios";
import type { Place } from "@/src/types/domain";
import { lampService, type LampPayload } from "../services/lampService";

const EMPTY = { lamp_code: "", place_id: "", latitude: "", longitude: "", model: "", power_rating: "", panel_watt_peak: "", battery_capacity_wh: "", firmware_version: "" };

const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function CreateLampDialog({ places, onCreated }: { places: Place[]; onCreated: () => void }) {
  const t = useTranslations("LampList.create");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lamp_code.trim()) return;
    setSaving(true);
    const payload: LampPayload = {
      lamp_code: form.lamp_code.trim(),
      place_id: form.place_id || null,
      latitude: num(form.latitude),
      longitude: num(form.longitude),
      model: form.model || null,
      power_rating: num(form.power_rating),
      panel_watt_peak: num(form.panel_watt_peak),
      battery_capacity_wh: num(form.battery_capacity_wh),
      firmware_version: form.firmware_version || null,
    };
    try {
      await lampService.create(payload);
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

  const fields: { key: keyof typeof EMPTY; type?: string; step?: string }[] = [
    { key: "latitude", type: "number", step: "any" },
    { key: "longitude", type: "number", step: "any" },
    { key: "model" },
    { key: "firmware_version" },
    { key: "power_rating", type: "number", step: "any" },
    { key: "panel_watt_peak", type: "number", step: "any" },
    { key: "battery_capacity_wh", type: "number", step: "any" },
  ];

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
                <Label htmlFor="lamp_code">{t("fields.lamp_code")} *</Label>
                <Input id="lamp_code" required value={form.lamp_code} onChange={set("lamp_code")} placeholder="PJU-A01" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="place_id">{t("fields.place_id")}</Label>
                <NativeSelect id="place_id" value={form.place_id} onChange={set("place_id")} className="w-full">
                  <option value="">—</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key}>{t(`fields.${f.key}`)}</Label>
                  <Input id={f.key} type={f.type || "text"} step={f.step} value={form[f.key]} onChange={set(f.key)} />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={saving || !form.lamp_code.trim()}>
                {saving && <Loader2 className="animate-spin" />} {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
