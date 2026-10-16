import { getTranslations } from "next-intl/server";
import { LampDetailView } from "@/src/features/lamps/views/LampDetailView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("lamp_detail") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LampDetailView id={id} />;
}
