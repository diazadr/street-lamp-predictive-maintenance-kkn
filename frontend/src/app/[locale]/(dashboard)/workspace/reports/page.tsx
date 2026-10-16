import { getTranslations } from "next-intl/server";
import { ReportsView } from "@/src/features/reports/views/ReportsView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("reports") };
}

export default function Page() {
  return <ReportsView />;
}
