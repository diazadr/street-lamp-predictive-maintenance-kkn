"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Save, ShieldCheck, User as UserIcon, UserCircle } from "lucide-react";
import { DashboardPageShell } from "@/src/components/layouts/dashboard/DashboardPageShell";
import { SectionCard } from "@/src/components/ui/dashboard/SectionCard";
import { StatusBadge } from "@/src/components/ui/dashboard/StatusBadge";
import { TabSwitch } from "@/src/components/ui/dashboard/TabSwitch";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { api, getErrorMessage } from "@/src/lib/http/axios";
import type { User } from "@/src/types/auth";

function IconInput({ icon: Icon, ...props }: React.ComponentProps<typeof Input> & { icon: typeof Mail }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-10 h-11 rounded-xl" {...props} />
    </div>
  );
}

export function ProfileView() {
  const t = useTranslations("Profile");
  const { user, setUser } = useAuth();
  const [tab, setTab] = useState("profile");
  const [name, setName] = useState(user?.name || "");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState<"" | "profile" | "password">("");

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving("profile");
    try {
      const { data } = await api.patch<User>("/users/me", { name: name.trim() });
      setUser(data);
      toast.success(t("profile_saved"));
    } catch (err) {
      toast.error(getErrorMessage(err, t("profile_failed")));
    } finally {
      setSaving("");
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next.length < 8) return toast.error(t("password_min"));
    if (pw.next !== pw.confirm) return toast.error(t("password_mismatch"));
    setSaving("password");
    try {
      await api.post("/users/me/change-password", { old_password: pw.current, new_password: pw.next });
      toast.success(t("password_saved"));
      setPw({ current: "", next: "", confirm: "" });
    } catch (err) {
      toast.error(getErrorMessage(err, t("password_failed")));
    } finally {
      setSaving("");
    }
  };

  return (
    <DashboardPageShell title={t("title")} subtitle={t("subtitle")} icon={UserCircle} className="max-w-3xl">
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
          {user?.name?.charAt(0).toUpperCase() || "U"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-foreground">{user?.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
          <div className="mt-1.5 flex gap-2">
            <StatusBadge value={user?.role} />
            <StatusBadge value={user?.status} dot />
          </div>
        </div>
      </div>

      <TabSwitch
        className="w-fit"
        activeTab={tab}
        onTabChange={setTab}
        tabs={[
          { value: "profile", label: t("tab_profile") },
          { value: "security", label: t("tab_security") },
        ]}
      />

      {tab === "profile" ? (
        <SectionCard title={t("tab_profile")} icon={UserIcon}>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("name")}</Label>
              <IconInput id="name" icon={UserIcon} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <IconInput id="email" icon={Mail} value={user?.email || ""} disabled />
              <p className="text-xs text-muted-foreground">{t("email_locked")}</p>
            </div>
            <Button type="submit" disabled={saving === "profile" || !name.trim()}>
              {saving === "profile" ? <Loader2 className="animate-spin" /> : <Save />} {t("save_profile")}
            </Button>
          </form>
        </SectionCard>
      ) : (
        <SectionCard title={t("change_password")} icon={ShieldCheck}>
          <form onSubmit={changePassword} className="space-y-4">
            {(
              [
                ["current", t("current_password")],
                ["next", t("new_password")],
                ["confirm", t("confirm_password")],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{label}</Label>
                <IconInput
                  id={key}
                  icon={Lock}
                  type="password"
                  autoComplete={key === "current" ? "current-password" : "new-password"}
                  value={pw[key]}
                  onChange={(e) => setPw((p) => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
            <Button type="submit" disabled={saving === "password" || !pw.current || !pw.next}>
              {saving === "password" ? <Loader2 className="animate-spin" /> : <ShieldCheck />} {t("save_password")}
            </Button>
          </form>
        </SectionCard>
      )}
    </DashboardPageShell>
  );
}
