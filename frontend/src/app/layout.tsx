import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/src/app/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
};

/**
 * Root layout — satu-satunya shell html/body untuk seluruh aplikasi.
 * [locale]/layout.tsx menyediakan provider i18n tanpa membungkus ulang html/body.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
