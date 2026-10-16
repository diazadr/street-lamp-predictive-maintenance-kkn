"use client";

import { Globe } from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";

/** Tombol ganti bahasa ID ⇄ EN dengan mempertahankan path & query. */
export function LocaleToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggle = () => {
    const next = locale === "id" ? "en" : "id";
    const query = window.location.search.replace(/^\?/, "");
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { locale: next });
  };

  return (
    <button onClick={toggle} className={cn("icon-btn w-auto px-2.5 gap-1.5 text-xs font-bold", className)} aria-label="Language">
      <Globe className="h-4 w-4" />
      <span className="uppercase">{locale === "id" ? "EN" : "ID"}</span>
    </button>
  );
}
