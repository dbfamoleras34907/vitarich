'use client'
import { Button } from "@/components/ui/button"
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Search, FileText, Package, Settings, ArrowUp, ArrowDown, CornerDownLeft, Smartphone } from "lucide-react"
import { filterNavFolders } from '@/lib/sidebar/AppSidebar'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { NavFolders } from '@/lib/Defaults/DefaultValues'
import { Modal } from "@/lib/Moda"
import GlobalFarmUserSettings, { getAllowedFarms } from "./GlobalFarmUserSettings"
import { Kbd } from "./kbd"

interface collapsed {
  collapsed: boolean
}

export default function GlobalSearch({ collapsed }: collapsed) {
  const [open, setOpen] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState("All")
  const navtype = ["All", "Settings", "Navigation"]
  // internal modal state example
  const [farmModalOpen, setFarmModalOpen] = useState(false)

  const router = useRouter()
  const { getValue } = useGlobalContext()

  const filteredFolders = filterNavFolders(
    NavFolders,
    getValue("UserPermission") || []
  )

  /**
   * INTERNAL COMMANDS
   */
  const commands = [
    {
      group: "Settings",
      items: [
        {
          title: "Select Default Farm",
          description: "Change active farm",
          icon: Settings,
          action: () => setFarmModalOpen(true),
        },
      ],
    },
  ]

  useEffect(() => {
    if (getValue('DefaultFarmId') == null || getValue('DefaultFarmId') == undefined) setFarmModalOpen(true)
  }, [getValue])



  /**
   * Keyboard shortcut (CTRL+K / CMD+K)
   */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  return (
    <>
      {/* SEARCH BUTTON */}
      <Button
        variant="secondary"
        type="button"
        onClick={() => setOpen(true)}
        className={`relative h-9 w-56 justify-start gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary ${collapsed ? "justify-center" : ""
          }`}
      >
        <Search className="h-4 w-4" />

        {!collapsed && (
          <>
            <span className="flex-1 text-left">Search...</span>

            <kbd className="pointer-events-none absolute right-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </>
        )}
      </Button>

      {/* COMMAND DIALOG */}
      <CommandDialog open={open} onOpenChange={setOpen} >
        <CommandInput placeholder="Search modules, reports, or commands..." />
        <div className="p-2 flex gap-2 text-center items-center pb-2 border-b">
          {navtype.map((filter) => (
            <Button
              key={filter}
              size={"xs"}
              variant={selectedFilter === filter ? "default" : "outline"}
              className={`${selectedFilter === filter ? "bg-black hover:bg-black/70" : "bg-transparent"} h-6 px-2`}
              onClick={() => setSelectedFilter(filter)}
            >
              {filter}
            </Button>
          ))}
        </div>
        <CommandList className="max-h-100">
          <CommandEmpty>No results found.</CommandEmpty>

          {(selectedFilter === "All" || selectedFilter === "Settings") && (
            commands.map((group) => (
              <React.Fragment key={group.group}>
                <CommandGroup heading={group.group}>
                  {group.items.map((cmd) => {
                    const Icon = cmd.icon

                    return (
                      <CommandItem
                        key={cmd.title}
                        value={`${group.group} ${cmd.title}`}
                        onSelect={() =>
                          runCommand(cmd.action)
                        }
                      >
                        <Icon className="mr-2 h-4 w-4 text-green-500" />

                        <div className="flex flex-col">
                          <span>{cmd.title}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {cmd.description}
                          </span>
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>

                <CommandSeparator />
              </React.Fragment>
            ))
          )}



          {(selectedFilter === "All" || selectedFilter === "Navigation") && filteredFolders.map((folder) => (
            <React.Fragment key={folder.id}>
              <CommandGroup heading={folder.title}>
                {folder.items.map((group: any) =>
                  group.children.map((child: any) => (
                    <CommandItem
                      key={child.url + child.title}
                      value={`${folder.title} ${child.title} ${group.group}`}
                      onSelect={() => {
                        if (child.url !== "#") {
                          runCommand(() =>
                            router.push(child.url)
                          )
                        }
                      }}
                    >
                      {child.type === "Module" ? (
                        <Package className="mr-2 h-4 w-4 text-blue-500" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4 text-orange-500" />
                      )}

                      <div className="flex flex-col">
                        <span>{child.title}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {folder.title} › {group.group}
                        </span>
                      </div>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>

              <CommandSeparator />
            </React.Fragment>
          ))}

        </CommandList>
        <div className="flex items-center border-t p-2 mt-auto gap-4 px-6">
          <div className="flex gap-2">
            <div>
              <Kbd><ArrowUp /> <ArrowDown /></Kbd>
            </div>
            <div className="text-sm">to select</div>
          </div>

          <div className="flex gap-2 border-x px-4">
            <div>
              <Kbd><CornerDownLeft /></Kbd>
            </div>
            <div className="text-sm">to navigate</div>
          </div>

          <div className="flex gap-2">
            <div>
              <Kbd>ESC</Kbd>
            </div>
            <div className="text-sm">to close</div>
          </div>
        </div>
      </CommandDialog>

      {/* FARM MODAL EXAMPLE */}
      <Modal
        open={farmModalOpen}
        onOpenChange={setFarmModalOpen}
        title="Select Default Farm"
      >
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            Choose the farm that will be used as your default working location.
          </p>

          {/* Farm selector component */}
          <div className="max-h-100 overflow-y-auto">
            <GlobalFarmUserSettings />
          </div>
        </div>
        <Button
          onClick={() => setFarmModalOpen(false)}
          className="bg-black text-white float-right mx-4 mb-3 hover:bg-black/70" size={"xs"}>Close</Button>
      </Modal>
    </>
  )
}