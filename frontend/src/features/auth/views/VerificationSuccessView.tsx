"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { AuthShell, AuthStatusCard } from "../components/AuthShell";

export function VerificationSuccessView() {
  const t = useTranslations("VerificationSuccessPage");
  return (
    <AuthShell>
      <AuthStatusCard icon={<CheckCircle2 className="h-10 w-10" />} title={t("title")}>
        <p>{t("desc_1")}</p>
        <p>{t("desc_2")}</p>
      </AuthStatusCard>
      <Link href="/login" className="mt-8 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors">
        {t("to_login")}
      </Link>
    </AuthShell>
  );
}
