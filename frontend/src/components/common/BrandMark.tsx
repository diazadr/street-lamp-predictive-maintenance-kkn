import { cn } from "@/src/lib/utils";

/**
 * Logo Street Lamp Predictive Maintenance — tiang lampu dengan panel surya
 * dan denyut "pulse" sebagai simbol pemantauan prediktif.
 */
export function BrandMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl",
        inverted ? "bg-white/10 text-white" : "bg-primary text-primary-foreground",
        className
      )}
    >
      <svg viewBox="0 0 32 32" fill="none" className="h-[62%] w-[62%]" aria-hidden="true">
        {/* panel surya */}
        <path d="M5 6.5 13 4.5l1 3.2-8 2z" fill="currentColor" opacity="0.55" />
        {/* tiang + lengan */}
        <path d="M11 9v19M11 9c0-3 2.5-4.5 6-4.5h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        {/* kepala lampu */}
        {/* kuning matahari; di mode gelap latar logo sudah kuning, jadi kepala lampu navy */}
        <rect x="19" y="3" width="9" height="3.6" rx="1.8" className={inverted ? "fill-sun" : "fill-sun dark:fill-[#0a1a3f]"} />
        {/* pulse prediktif */}
        <path d="M15 22h3l1.6-3.4 2.4 6.2 1.8-2.8H28" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 28h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
