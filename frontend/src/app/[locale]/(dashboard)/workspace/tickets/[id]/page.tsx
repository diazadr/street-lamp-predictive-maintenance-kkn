import { getTranslations } from "next-intl/server";
import { TicketDetailView } from "@/src/features/tickets/views/TicketDetailView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t("ticket_detail") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketDetailView id={id} />;
}
