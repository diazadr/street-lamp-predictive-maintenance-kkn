"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, MailWarning, RefreshCw } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Link, useRouter } from "@/src/i18n/navigation";
import { AuthShell, AuthStatusCard } from "../components/AuthShell";
import { authService } from "../services/authService";

/**
 * Dua mode:
 *  1. ?token=...  → tautan dari email; verifikasi otomatis lalu ke halaman sukses.
 *  2. ?email=...  → setelah registrasi; instruksi cek email + kirim ulang.
 */
export function VerifyEmailView() {
  const t = useTranslations("VerifyEmailPage");
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [email, setEmail] = useState(params.get("email") || "");
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifyState, setVerifyState] = useState<"idle" | "verifying" | "failed">(token ? "verifying" : "idle");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    authService
      .verifyEmail(token)
      .then(() => router.replace("/verification-success"))
      .catch(() => setVerifyState("failed"));
  }, [token, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    if (cooldown > 0 || !email) return;
    setSending(true);
    try {
      await authService.resendVerification(email);
      toast.success(t("resent"));
      setCooldown(60);
    } catch {
      toast.error(t("resend_failed"));
    } finally {
      setSending(false);
    }
  };

  if (verifyState === "verifying") {
    return (
      <AuthShell>
        <AuthStatusCard icon={<Loader2 className="h-10 w-10 animate-spin" />} title={t("verifying")}>
          <p />
        </AuthStatusCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthStatusCard
        icon={verifyState === "failed" ? <MailWarning className="h-10 w-10" /> : <Mail className="h-10 w-10" />}
        tone={verifyState === "failed" ? "destructive" : "primary"}
        title={verifyState === "failed" ? t("verify_failed_title") : t("title")}
      >
        {verifyState === "failed" ? (
          <p>{t("verify_failed")}</p>
        ) : (
          <>
            <p>{t("desc_sent")}</p>
            {params.get("email") && <p className="font-semibold text-primary">{email}</p>}
            <p className="text-sm">{t("desc_expire")}</p>
          </>
        )}
      </AuthStatusCard>

      <div className="mt-8 space-y-4">
        {(!params.get("email") || verifyState === "failed") && (
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("email_label")} className="h-12 rounded-xl bg-muted/50 border-transparent" />
        )}
        <Button variant="outline" onClick={resend} disabled={cooldown > 0 || sending || !email} className="w-full h-12 rounded-xl">
          {sending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> {t("sending")}</>
          ) : (
            <><RefreshCw className="h-4 w-4" /> {cooldown > 0 ? t("resend_wait", { seconds: cooldown }) : t("resend")}</>
          )}
        </Button>
        <p className="text-center">
          <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-accent-ink">
            <ArrowLeft size={16} /> {t("back_login")}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
