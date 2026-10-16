import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ResetPasswordView } from "@/src/features/auth/views/ResetPasswordView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ResetPasswordPage" });
  return { title: t("title") };
}

export default function Page() {
  return (
    <Suspense>
      <ResetPasswordView />
    </Suspense>
  );
}
