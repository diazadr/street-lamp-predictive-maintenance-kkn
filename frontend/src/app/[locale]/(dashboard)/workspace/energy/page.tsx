import { getTranslations } from "next-intl/server";
import { EnergyView } from "@/src/features/energy/views/EnergyView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("energy") };
}

export default function Page() {
  return <EnergyView />;
}
