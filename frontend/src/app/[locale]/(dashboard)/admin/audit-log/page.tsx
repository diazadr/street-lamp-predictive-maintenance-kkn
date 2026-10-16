import { getTranslations } from "next-intl/server";
import { AuditLogView } from "@/src/features/admin-audit/views/AuditLogView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("audit_log") };
}

export default function Page() {
  return <AuditLogView />;
}
