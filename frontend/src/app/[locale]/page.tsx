import { getTranslations, setRequestLocale } from "next-intl/server";
import { LandingView } from "@/src/features/landing/views/LandingView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "HomePage" });
  return { title: { absolute: t("title") } };
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LandingView />;
}
