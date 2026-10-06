import * as React from "react"

import { cn } from "@/lib/utils"

function PageShell({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="page-shell"
      className={cn(
        "@container/page min-h-[calc(100vh-4rem)] min-w-0 space-y-3 p-3 text-foreground md:p-4",
        className,
      )}
      {...props}
    />
  )
}

function PageHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex min-w-0 flex-col gap-2 md:flex-row md:items-start md:justify-between",
        className,
      )}
      {...props}
    />
  )
}

function PageHeaderActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header-actions"
      className={cn(
        "flex w-full flex-wrap items-center gap-2 md:w-auto md:shrink-0 md:justify-end",
        className,
      )}
      {...props}
    />
  )
}

function PageSection({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="page-section"
      className={cn(
        "min-w-0 overflow-hidden rounded-md border border-border bg-card shadow-[var(--starbucks-card-shadow)]",
        className,
      )}
      {...props}
    />
  )
}

function PageSectionHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="page-section-header"
      className={cn(
        "flex min-w-0 flex-col gap-2 border-b bg-muted/25 px-3 py-2.5 md:flex-row md:items-center md:justify-between",
        className,
      )}
      {...props}
    />
  )
}

function PageSectionTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="page-section-title"
      className={cn("text-sm font-semibold leading-5", className)}
      {...props}
    />
  )
}

function PageSectionDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="page-section-description"
      className={cn("text-xs leading-4 text-muted-foreground", className)}
      {...props}
    />
  )
}

function PageActionBar({ className, ...props }: React.ComponentProps<"footer">) {
  return (
    <footer
      data-slot="page-action-bar"
      className={cn(
        "flex flex-col gap-2 border-t bg-muted/20 p-3 md:flex-row md:items-end md:justify-end [&_[data-slot=button]]:w-full md:[&_[data-slot=button]]:w-auto",
        className,
      )}
      {...props}
    />
  )
}

function CompactMetric({
  className,
  label,
  value,
  icon,
  ...props
}: React.ComponentProps<"div"> & {
  label: React.ReactNode
  value: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div
      data-slot="compact-metric"
      className={cn(
        "flex min-h-14 min-w-0 items-center gap-2.5 rounded-md border bg-card px-3 py-2",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-primary [&_svg]:size-4">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="mt-0.5 block truncate text-base font-semibold leading-5 tabular-nums">{value}</span>
      </span>
    </div>
  )
}

export {
  CompactMetric,
  PageActionBar,
  PageHeader,
  PageHeaderActions,
  PageSection,
  PageSectionDescription,
  PageSectionHeader,
  PageSectionTitle,
  PageShell,
}
