"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft, Clock } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { AuthShell, AuthStatusCard } from "../components/AuthShell";

export function AwaitingApprovalView() {
  const t = useTranslations("AwaitingApprovalPage");
  return (
    <AuthShell>
      <AuthStatusCard icon={<Clock className="h-10 w-10" />} tone="warning" title={t("title")}>
        <p>{t("desc")}</p>
      </AuthStatusCard>
      <p className="mt-8 text-center">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-accent-ink">
          <ArrowLeft size={16} /> {t("back_login")}
        </Link>
      </p>
    </AuthShell>
  );
}
