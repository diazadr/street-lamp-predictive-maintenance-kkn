import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AwaitingApprovalView } from "@/src/features/auth/views/AwaitingApprovalView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AwaitingApprovalPage" });
  return { title: t("title") };
}

export default function Page() {
  return (
    <Suspense>
      <AwaitingApprovalView />
    </Suspense>
  );
}
