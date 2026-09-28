"use client"

import { RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useGlobalDefaults } from "@/lib/Defaults/GlobalDefaults"

export default function RefreshDataButton({ collapsed = false }: { collapsed?: boolean }) {
  const { loading, setGlobals } = useGlobalDefaults()

  const button = (
    <Button
      type="button"
      variant="ghost"
      onClick={() => setGlobals()}
      disabled={loading}
      aria-label="Refresh Data"
      aria-busy={loading}
      className={`w-full min-w-0 gap-2 rounded-xl border border-sidebar-border bg-card text-sm font-normal tracking-normal text-sidebar-foreground transition-colors hover:border-primary/40 hover:bg-sidebar-accent hover:text-sidebar-foreground ${collapsed ? "h-10 justify-center px-0" : "h-auto justify-start px-3 py-2 text-left"}`}
    >
      <RefreshCcw className={`shrink-0 ${collapsed ? "size-5" : "size-4"} ${loading ? "animate-spin" : ""}`} />
      {!collapsed && <span>Refresh Data</span>}
    </Button>
  )

  if (!collapsed) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild><span className="flex w-full">{button}</span></TooltipTrigger>
      <TooltipContent side="right">Refresh Data</TooltipContent>
    </Tooltip>
  )
}
