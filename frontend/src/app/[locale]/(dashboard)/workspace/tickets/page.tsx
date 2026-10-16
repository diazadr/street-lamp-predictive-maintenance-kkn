import { getTranslations } from "next-intl/server";
import { TicketListView } from "@/src/features/tickets/views/TicketListView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("tickets") };
}

export default function Page() {
  return <TicketListView />;
}
