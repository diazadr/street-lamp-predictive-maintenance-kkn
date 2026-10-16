import { getTranslations } from "next-intl/server";
import { LampScheduleView } from "@/src/features/lamps/views/LampScheduleView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("lamp_schedule") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LampScheduleView id={id} />;
}
