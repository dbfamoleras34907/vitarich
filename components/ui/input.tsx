import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-input bg-[#fffdfb] px-3 py-2 text-base shadow-none transition-[color,box-shadow,border-color] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground read-only:bg-[#f8f6f2] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#f1efeb] disabled:text-muted-foreground md:text-sm dark:bg-input/30 dark:read-only:bg-input/20 dark:disabled:bg-input/20",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/15",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
