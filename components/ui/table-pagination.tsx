"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type TablePaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
};

export function TablePagination({ page, pageSize, totalItems, itemLabel, onPageChange }: TablePaginationProps) {
  if (!totalItems) return null;

  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>Showing {start}-{end} of {totalItems} {itemLabel}</span>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="icon" variant="outline" onClick={() => onPageChange(1)} disabled={currentPage === 1} aria-label="Latest page" title="Latest page"><ChevronsLeft className="size-4" /></Button>
        <Button type="button" size="icon" variant="outline" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} aria-label="Previous page" title="Previous page"><ChevronLeft className="size-4" /></Button>
        <span className="flex h-9 items-center px-2">Page {currentPage} of {pageCount}</span>
        <Button type="button" size="icon" variant="outline" onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))} disabled={currentPage === pageCount} aria-label="Next page" title="Next page"><ChevronRight className="size-4" /></Button>
        <Button type="button" size="icon" variant="outline" onClick={() => onPageChange(pageCount)} disabled={currentPage === pageCount} aria-label="Last page" title="Last page"><ChevronsRight className="size-4" /></Button>
      </div>
    </div>
  );
}
