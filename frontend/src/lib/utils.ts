import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";
import { id as idLocale, enUS } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateLocale = (locale?: string) => (locale === "en" ? enUS : idLocale);

export function formatNumber(value: number | null | undefined, locale = "id"): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "id-ID").format(Number(value));
}

export function formatDecimal(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(digits);
}

export function formatRupiah(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    Number(value)
  );
}

export function formatDateTime(value: string | null | undefined, locale = "id"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd MMM yyyy, HH:mm", { locale: dateLocale(locale) });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return format(date, "dd/MM HH:mm");
}

export function timeAgo(value: string | null | undefined, locale = "id"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDistanceToNow(date, { addSuffix: true, locale: dateLocale(locale) });
}

export function isoDate(daysAgo = 0): string {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

/**
 * Agregasi deret waktu per jam (rata-rata tiap field numerik).
 * Telemetri dari banyak lampu datang bercampur per baris; tanpa agregasi garis grafik bergerigi.
 */
export function aggregateByHour<T extends { time: string }>(points: T[], fields: (keyof T)[]) {
  const buckets = new Map<number, { sums: Record<string, number>; counts: Record<string, number> }>();
  for (const p of points) {
    const date = new Date(p.time);
    if (Number.isNaN(date.getTime())) continue;
    date.setMinutes(0, 0, 0);
    const key = date.getTime();
    const bucket = buckets.get(key) ?? { sums: {}, counts: {} };
    for (const field of fields) {
      // backend mengirim kolom Decimal sebagai string ("30.97")
      const raw = p[field];
      const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
      if (typeof value !== "number" || Number.isNaN(value)) continue;
      const name = String(field);
      bucket.sums[name] = (bucket.sums[name] ?? 0) + value;
      bucket.counts[name] = (bucket.counts[name] ?? 0) + 1;
    }
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([key, { sums, counts }]) => {
      const row: Record<string, number | string | null> = { time: new Date(key).toISOString(), label: formatTime(new Date(key).toISOString()) };
      for (const field of fields) {
        const name = String(field);
        row[name] = counts[name] ? Math.round((sums[name] / counts[name]) * 100) / 100 : null;
      }
      return row as Partial<Record<keyof T, number | null>> & { time: string; label: string };
    });
}
