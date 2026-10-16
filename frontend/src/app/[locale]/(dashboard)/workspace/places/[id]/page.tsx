import { getTranslations } from "next-intl/server";
import { PlaceDetailView } from "@/src/features/places/views/PlaceDetailView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("place_detail") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlaceDetailView id={id} />;
}
