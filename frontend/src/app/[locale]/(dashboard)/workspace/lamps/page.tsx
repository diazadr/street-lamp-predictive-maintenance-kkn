import { getTranslations } from "next-intl/server";
import { LampListView } from "@/src/features/lamps/views/LampListView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("lamps") };
}

export default function Page() {
  return <LampListView />;
}
