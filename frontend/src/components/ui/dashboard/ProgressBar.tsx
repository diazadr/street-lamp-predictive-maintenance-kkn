import { cn } from "@/src/lib/utils";

/** Bar progres kecil dengan warna otomatis berdasarkan ambang (mis. level baterai / health). */
export function ProgressBar({ value, className, showLabel = true }: { value: number | null | undefined; className?: string; showLabel?: boolean }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const v = Math.max(0, Math.min(100, Number(value)));
  const color = v > 50 ? "bg-success" : v > 20 ? "bg-warning" : "bg-destructive";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${v}%` }} />
      </div>
      {showLabel && <span className="text-xs tabular-nums text-muted-foreground">{v.toFixed(0)}%</span>}
    </div>
  );
}
