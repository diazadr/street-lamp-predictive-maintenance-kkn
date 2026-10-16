"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { ArrowLeft } from "lucide-react";

interface PageShellProps {
  title?: string;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  backHref?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Kerangka halaman dashboard: judul, subjudul, tombol kembali & aksi — gaya MANGO. */
export function DashboardPageShell({ title, subtitle, icon: Icon, backHref, actions, children, className }: PageShellProps) {
  useEffect(() => {
    document.title = title ? `${title} | Street Lamp PdM` : "Street Lamp PdM";
  }, [title]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className ? `w-full space-y-6 ${className}` : "w-full space-y-6"}
    >
      {(title || subtitle || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {backHref && (
              <Link href={backHref} className="icon-btn mt-0.5" aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}
            {Icon && !backHref && (
              <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              {title && <h1 className="text-xl font-semibold tracking-tight text-foreground leading-tight">{title}</h1>}
              {subtitle && <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{subtitle}</div>}
            </div>
          </div>
          {actions && <div className="shrink-0 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </motion.div>
  );
}
