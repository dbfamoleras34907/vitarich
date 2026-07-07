"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type FormTableProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  emptyState?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  children: React.ReactNode
}

function FormTable({
  title,
  description,
  actions,
  emptyState,
  footer,
  className,
  children,
}: FormTableProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border bg-card shadow-[var(--starbucks-card-shadow)]",
        className
      )}
    >
      {(title || description || actions) && (
        <div className="flex flex-col gap-3 border-b bg-card px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && (
              <h2 className="text-base font-semibold text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}

      <div className="overflow-x-auto">
        {children}
      </div>

      {emptyState}
      {footer}
    </section>
  )
}

function FormTableFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex justify-end gap-2 border-t bg-secondary/70 px-3 py-3",
        className
      )}
      {...props}
    />
  )
}

export { FormTable, FormTableFooter }
