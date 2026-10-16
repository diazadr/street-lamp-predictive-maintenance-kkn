"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTableRow,
} from "./AdminTable";
import { TableSkeleton } from "./LoadingSkeleton";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  className?: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  /** Jumlah baris per halaman (paginasi sisi klien). 0 = tanpa paginasi. */
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  rowKey?: (row: T, index: number) => string;
}

/** Tabel data generik dengan skeleton, empty state, dan paginasi — dibangun dari AdminTable. */
export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  pageSize = 10,
  emptyTitle,
  emptyDescription,
  rowKey,
}: DataTableProps<T>) {
  const t = useTranslations("DataTable");
  const [page, setPage] = React.useState(1);
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(data.length / pageSize)) : 1;
  const current = Math.min(page, totalPages);
  const rows = pageSize > 0 ? data.slice((current - 1) * pageSize, current * pageSize) : data;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {isLoading ? (
        <TableSkeleton columns={Math.min(columns.length, 6)} rows={6} />
      ) : data.length === 0 ? (
        <EmptyState icon={Inbox} title={emptyTitle || t("empty")} description={emptyDescription} />
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <AdminTable>
            <AdminTableHeader>
              <AdminTableRow className="hover:bg-transparent">
                {columns.map((col) => (
                  <AdminTableHeadCell key={col.key} align={col.align} className={col.className}>
                    {col.label}
                  </AdminTableHeadCell>
                ))}
              </AdminTableRow>
            </AdminTableHeader>
            <AdminTableBody>
              {rows.map((row, index) => (
                <AdminTableRow key={rowKey ? rowKey(row, index) : String((row as { id?: string }).id ?? index)}>
                  {columns.map((col) => (
                    <AdminTableCell key={col.key} align={col.align} className={col.className}>
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? "—")}
                    </AdminTableCell>
                  ))}
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminTable>
        </div>
      )}

      {!isLoading && pageSize > 0 && data.length > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-border/50 bg-muted/20 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {t("page_info", { page: current, pages: totalPages, total: data.length })}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
              aria-label={t("prev")}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={current >= totalPages}
              onClick={() => setPage(current + 1)}
              aria-label={t("next")}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
