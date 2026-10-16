import { getTranslations } from "next-intl/server";
import { UserManagementView } from "@/src/features/admin-users/views/UserManagementView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("users") };
}

export default function Page() {
  return <UserManagementView />;
}
