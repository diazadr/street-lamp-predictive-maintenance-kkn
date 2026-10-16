"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { AlertCircle, ArrowLeft, Loader2, Lock, ShieldX } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Link, useRouter } from "@/src/i18n/navigation";
import { getErrorMessage } from "@/src/lib/http/axios";
import { AuthShell, AuthStatusCard } from "../components/AuthShell";
import { AuthField } from "../components/AuthField";
import { authService } from "../services/authService";
import { resetPasswordSchema, type ResetPasswordFormData } from "../schema/passwordSchema";

export function ResetPasswordView() {
  const t = useTranslations("ResetPasswordPage");
  const tErr = useTranslations("RegisterPage.errors");
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ResetPasswordFormData>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirm: "" } });
  const isLoading = form.formState.isSubmitting;
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await authService.resetPassword(token, password);
      router.replace("/login?reset=success");
    } catch (err) {
      setError(getErrorMessage(err, t("error")));
    }
  });

  if (!token) {
    return (
      <AuthShell>
        <AuthStatusCard icon={<ShieldX className="h-10 w-10" />} tone="destructive" title={t("invalid_title")}>
          <p>{t("invalid_desc")}</p>
          <Link href="/forgot-password" className="inline-block pt-6 text-sm font-semibold text-primary hover:text-accent-ink">
            {t("request_new")}
          </Link>
        </AuthStatusCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
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
        <AuthField id="password" type="password" label={t("password_label")} icon={Lock} autoComplete="new-password" disabled={isLoading}
          error={errors.password && tErr(errors.password.message as string)} {...form.register("password")} />
        <AuthField id="confirm" type="password" label={t("confirm_label")} icon={Lock} autoComplete="new-password" disabled={isLoading}
          error={errors.confirm && tErr(errors.confirm.message as string)} {...form.register("confirm")} />
        <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20">
          {isLoading ? <><Loader2 size={18} className="animate-spin mr-2" />{t("processing")}</> : t("submit_button")}
        </Button>
      </form>
      <p className="mt-8 text-center text-sm">
        <Link href="/login" className="inline-flex items-center gap-2 font-semibold text-primary hover:text-accent-ink">
          <ArrowLeft size={16} /> {t("back_login")}
        </Link>
      </p>
    </AuthShell>
  );
}
