"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/components/ui/badge";

type Variant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "accent" | "info";

const variantMap: Record<string, Variant> = {
  // Peran pengguna
  admin: "info",
  operator: "success",
  viewer: "secondary",
  // Status lampu
  online: "success",
  warning: "warning",
  fault: "destructive",
  maintenance: "info",
  offline: "secondary",
  // Risiko ML
  high: "destructive",
  medium: "warning",
  low: "success",
  unknown: "secondary",
  // Tiket
  open: "warning",
  in_progress: "info",
  resolved: "success",
  cancelled: "secondary",
  critical: "destructive",
  // Pengguna
  active: "success",
  pending: "warning",
  awaiting_approval: "warning",
  rejected: "destructive",
  suspended: "secondary",
  // Alert
  info: "info",
};

const dotColor: Partial<Record<Variant, string>> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-primary",
  secondary: "bg-muted-foreground",
};

interface StatusBadgeProps {
  value: string | null | undefined;
  variant?: Variant;
  dot?: boolean;
  className?: string;
}

/** Badge status terpadu untuk lampu, risiko, tiket, peran, dan status akun. */
export function StatusBadge({ value, variant, dot = false, className }: StatusBadgeProps) {
  const t = useTranslations("StatusBadge");

  if (!value) {
    return (
      <Badge variant="secondary" className={className}>
        —
      </Badge>
    );
  }

  const resolved = variant || variantMap[value] || "secondary";
  const label = t.has(value) ? t(value) : value.replace(/_/g, " ");

  return (
    <Badge variant={resolved} className={cn("capitalize gap-1.5", className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[resolved] || "bg-current")} />}
      {label}
    </Badge>
  );
}
