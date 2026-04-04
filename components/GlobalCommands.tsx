import { Settings, PlusCircle, RefreshCcw } from "lucide-react"

export type GlobalCommand = {
  group: string
  title: string
  description?: string
  keywords?: string
  icon?: any
  handler: () => void
}

type CommandActions = {
  openFarmSelector: () => void
  createReceiving?: () => void
  triggerSync?: () => void
}

export function getGlobalCommands(
  actions: CommandActions
): GlobalCommand[] {
  return [
    {
      group: "Settings",
      title: "Select Default Farm",
      description: "Change active farm",
      keywords: "farm settings default",
      icon: Settings,
      handler: actions.openFarmSelector,
    },

    // future-ready example
    {
      group: "Create",
      title: "New Receiving Record",
      description: "Create manual receiving entry",
      keywords: "receiving create manual",
      icon: PlusCircle,
      handler: () => actions.createReceiving?.(),
    },

    // example system command
    {
      group: "System",
      title: "Trigger Data Sync",
      description: "Run background sync job",
      keywords: "sync refresh update",
      icon: RefreshCcw,
      handler: () => actions.triggerSync?.(),
    },
  ]
}