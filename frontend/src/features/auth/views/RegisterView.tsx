"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail, User } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { AuthShell } from "../components/AuthShell";
import { AuthField } from "../components/AuthField";
import { useRegisterForm } from "../hooks/useRegisterForm";

function passwordScore(password: string) {
  let s = 0;
  if (password.length >= 8) s++;
  if (/[A-Z]/.test(password)) s++;
  if (/[0-9]/.test(password)) s++;
  if (/[^A-Za-z0-9]/.test(password)) s++;
  return s;
}

export function RegisterView() {
  const { form, onSubmit, isLoading, serverError, t } = useRegisterForm();
  const errors = form.formState.errors;
  const password = form.watch("password");
  const confirm = form.watch("confirm");
  const score = passwordScore(password || "");
  const barColor = ["", "bg-destructive", "bg-warning", "bg-accent", "bg-primary"][score];

  return (
    <AuthShell>
      <div className="mb-8 text-center lg:text-left">
        <h1 className="text-3xl font-extrabold text-primary tracking-tight mb-2">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <AnimatePresence>
        {serverError && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6">
            <Alert variant="destructive" className="rounded-xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm font-medium">{serverError}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <AuthField id="name" label={t("name_label")} icon={User} placeholder={t("name_placeholder")} autoComplete="name" disabled={isLoading}
          error={errors.name && t(`errors.${errors.name.message}`)} {...form.register("name")} />
        <AuthField id="email" type="email" label={t("email_label")} icon={Mail} placeholder={t("email_placeholder")} autoComplete="email" disabled={isLoading}
          error={errors.email && t(`errors.${errors.email.message}`)} {...form.register("email")} />
        <div className="space-y-2">
          <AuthField id="password" type="password" label={t("password_label")} icon={Lock} placeholder={t("password_placeholder")} autoComplete="new-password" disabled={isLoading}
            error={errors.password && t(`errors.${errors.password.message}`)} {...form.register("password")} />
          {password && (
            <div>
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i <= score ? barColor : "bg-muted")} />
                ))}
              </div>
              {score > 0 && <p className="text-xs text-muted-foreground">{t(`strength.${score}`)}</p>}
            </div>
          )}
        </div>
        <AuthField
          id="confirm"
          type="password"
          label={t("confirm_label")}
          icon={Lock}
          placeholder={t("confirm_placeholder")}
          autoComplete="new-password"
          disabled={isLoading}
          labelAction={confirm && confirm === password ? <CheckCircle2 className="h-4 w-4 text-success" /> : null}
          error={errors.confirm && t(`errors.${errors.confirm.message}`)}
          {...form.register("confirm")}
        />

        <p className="text-xs text-muted-foreground leading-relaxed">
          {t.rich("note", { accent: (chunks) => <span className="font-semibold text-primary">{chunks}</span> })}
        </p>

        <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20">
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin mr-2" />
              {t("processing")}
            </>
          ) : (
            t("submit_button")
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        {t("have_account")}{" "}
        <Link href="/login" className="text-primary font-semibold hover:text-accent-ink underline underline-offset-4">
          {t("login")}
        </Link>
      </p>
    </AuthShell>
  );
}
