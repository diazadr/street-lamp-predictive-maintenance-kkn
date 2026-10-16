"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { AlertCircle, ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Link } from "@/src/i18n/navigation";
import { getErrorMessage } from "@/src/lib/http/axios";
import { AuthShell, AuthStatusCard } from "../components/AuthShell";
import { AuthField } from "../components/AuthField";
import { authService } from "../services/authService";
import { forgotPasswordSchema, type ForgotPasswordFormData } from "../schema/passwordSchema";

export function ForgotPasswordView() {
  const t = useTranslations("ForgotPasswordPage");
  const tErr = useTranslations("RegisterPage.errors");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordFormData>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const isLoading = form.formState.isSubmitting;

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await authService.forgotPassword(email);
      setSentTo(email);
    } catch (err) {
      setError(getErrorMessage(err, t("error")));
    }
  });

  return (
    <AuthShell>
      {sentTo ? (
        <AuthStatusCard icon={<MailCheck className="h-10 w-10" />} title={t("sent_title")}>
          <p>{t("sent_desc", { email: sentTo })}</p>
          <Link href="/login" className="inline-flex items-center gap-2 pt-6 text-sm font-semibold text-primary hover:text-accent-ink">
            <ArrowLeft size={16} /> {t("back_login")}
          </Link>
        </AuthStatusCard>
      ) : (
        <>
          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-3xl font-extrabold text-primary tracking-tight mb-2">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
          {error && (
            <Alert variant="destructive" className="rounded-xl mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <AuthField id="email" type="email" label={t("email_label")} icon={Mail} placeholder="nama@email.com" disabled={isLoading}
              error={form.formState.errors.email && tErr(form.formState.errors.email.message as string)} {...form.register("email")} />
            <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20">
              {isLoading ? <><Loader2 size={18} className="animate-spin mr-2" />{t("processing")}</> : t("submit_button")}
            </Button>
          </form>
          <p className="mt-8 text-center text-sm">
            <Link href="/login" className="inline-flex items-center gap-2 font-semibold text-primary hover:text-accent-ink">
              <ArrowLeft size={16} /> {t("back_login")}
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
