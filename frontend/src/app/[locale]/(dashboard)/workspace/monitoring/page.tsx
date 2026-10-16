import { getTranslations } from "next-intl/server";
import { MonitoringView } from "@/src/features/monitoring/views/MonitoringView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("monitoring") };
}

export default function Page() {
  return <MonitoringView />;
}
