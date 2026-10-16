import { getTranslations } from "next-intl/server";
import { PlaceListView } from "@/src/features/places/views/PlaceListView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("places") };
}

export default function Page() {
  return <PlaceListView />;
}
