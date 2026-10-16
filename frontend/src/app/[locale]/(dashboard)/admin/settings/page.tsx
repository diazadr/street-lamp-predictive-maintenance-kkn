import { getTranslations } from "next-intl/server";
import { SystemSettingsView } from "@/src/features/admin-settings/views/SystemSettingsView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("settings") };
}

export default function Page() {
  return <SystemSettingsView />;
}
