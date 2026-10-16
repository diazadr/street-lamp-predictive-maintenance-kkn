import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import { routing } from "@/src/i18n/routing";
import { ThemeProvider } from "@/src/components/providers/ThemeProvider";
import { AuthProvider } from "@/src/components/providers/AuthProvider";
import { I18nProvider } from "@/src/components/providers/I18nProvider";

export const metadata: Metadata = {
  title: {
    template: "%s | Street Lamp PdM",
    default: "Street Lamp Predictive Maintenance",
  },
  description:
    "Platform pemeliharaan prediktif lampu jalan tenaga surya berbasis IoT — monitoring real-time, prediksi kerusakan berbasis machine learning, dan manajemen tiket perbaikan.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "id" | "en")) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <ThemeProvider>
      <I18nProvider locale={locale} messages={messages}>
        <AuthProvider>{children}</AuthProvider>
      </I18nProvider>
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
