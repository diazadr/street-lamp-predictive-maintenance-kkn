"use client";

import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Link } from "@/src/i18n/navigation";
import { AuthShell } from "../components/AuthShell";
import { AuthField } from "../components/AuthField";
import { useLoginForm } from "../hooks/useLoginForm";

export function LoginView() {
  const { form, onSubmit, isLoading, serverError, t } = useLoginForm();
  const searchParams = useSearchParams();
  const logoutSuccess = searchParams.get("logout") === "success";
  const resetSuccess = searchParams.get("reset") === "success";
  const errors = form.formState.errors;

  const notices = [
    serverError && { key: "err", variant: "destructive" as const, Icon: AlertCircle, text: serverError },
    !serverError && logoutSuccess && { key: "logout", variant: "success" as const, Icon: CheckCircle2, text: t("logout_success") },
    !serverError && resetSuccess && { key: "reset", variant: "success" as const, Icon: CheckCircle2, text: t("reset_success") },
  ].filter(Boolean) as { key: string; variant: "destructive" | "success"; Icon: typeof AlertCircle; text: string }[];

  return (
    <AuthShell>
      <div className="mb-10 text-center lg:text-left">
        <h1 className="text-3xl font-extrabold text-primary tracking-tight mb-2">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <AnimatePresence>
        {notices.map(({ key, variant, Icon, text }) => (
          <motion.div key={key} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6">
            <Alert variant={variant} className="rounded-xl">
              <Icon className="h-4 w-4" />
              <AlertDescription className="text-sm font-medium">{text}</AlertDescription>
            </Alert>
          </motion.div>
        ))}
      </AnimatePresence>

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <AuthField
          id="email"
          type="email"
          label={t("email_label")}
          icon={Mail}
          placeholder={t("email_placeholder")}
          autoComplete="email"
          disabled={isLoading}
          error={errors.email && t(`errors.${errors.email.message}`)}
          {...form.register("email")}
        />
        <AuthField
          id="password"
          type="password"
          label={t("password_label")}
          icon={Lock}
          placeholder={t("password_placeholder")}
          autoComplete="current-password"
          disabled={isLoading}
          error={errors.password && t(`errors.${errors.password.message}`)}
          labelAction={
            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:text-accent-ink transition-colors">
              {t("forgot_password")}
            </Link>
          }
          {...form.register("password")}
        />

        <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20">
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin mr-2" />
              {t("processing")}
            </>
          ) : (
            <span className="flex items-center justify-center gap-2">
              {t("submit_button")}
              <ArrowRight size={18} strokeWidth={2.2} />
            </span>
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        {t("no_account")}{" "}
        <Link href="/register" className="text-primary font-semibold hover:text-accent-ink underline underline-offset-4">
          {t("register")}
        </Link>
      </p>
    </AuthShell>
  );
}
