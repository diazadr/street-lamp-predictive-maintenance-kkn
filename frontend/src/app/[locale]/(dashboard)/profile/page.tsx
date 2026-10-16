import { getTranslations } from "next-intl/server";
import { ProfileView } from "@/src/features/profile/views/ProfileView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("profile") };
}

export default function Page() {
  return <ProfileView />;
}
