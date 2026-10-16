import { getTranslations } from "next-intl/server";
import { MapView } from "@/src/features/map/views/MapView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("map") };
}

export default function Page() {
  return <MapView />;
}
