import { cn } from "@/src/lib/utils";

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "success" | "warning" | "destructive" | "primary" | "muted";
  className?: string;
}

const toneClass = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  primary: "text-primary",
  muted: "text-muted-foreground",
};

/** Ringkasan angka kompak (label kiri, nilai kanan) untuk bar ringkasan di atas tabel. */
export function StatTile({ label, value, tone = "default", className }: StatTileProps) {
  return (
    <div className={cn("flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("text-lg font-semibold tabular-nums", toneClass[tone])}>{value}</span>
    </div>
  );
}
