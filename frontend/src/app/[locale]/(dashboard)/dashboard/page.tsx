import { getTranslations } from "next-intl/server";
import { DashboardHomeView } from "@/src/features/dashboard/views/DashboardHomeView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("dashboard") };
}

export default function Page() {
  return <DashboardHomeView />;
}
