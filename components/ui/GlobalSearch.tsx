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
import { Search, Settings, ArrowUp, ArrowDown, CornerDownLeft } from "lucide-react"
import { filterNavFolders } from '@/lib/sidebar/AppSidebar'
import { getModuleIcon } from '@/lib/sidebar/moduleIcons'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { NavFolders } from '@/lib/Defaults/DefaultValues'
import { Modal } from "@/lib/Moda"
import GlobalFarmUserSettings from "./GlobalFarmUserSettings"
import { Kbd } from "./kbd"

interface collapsed {
  collapsed: boolean
}

type NavCommandChild = {
  title: string
  url: string
  type?: string
  insert?: boolean
  newDocumentUrl?: string
}

type NavCommandGroup = {
  group: string
  children: NavCommandChild[]
}

type NavCommandFolder = {
  id: number | string
  title: string
  items?: NavCommandGroup[]
}

type RankedSearchItem =
  | {
      kind: "settings"
      key: string
      title: string
      description: string
      group: string
      score: number
      order: number
      icon: typeof Settings
      action: () => void
    }
  | {
      kind: "navigation"
      key: string
      title: string
      description: string
      type?: string
      url: string
      score: number
      order: number
    }

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")

const fuzzyScore = (text: string, token: string) => {
  let tokenIndex = 0
  let firstMatch = -1
  let lastMatch = -1

  for (let textIndex = 0; textIndex < text.length && tokenIndex < token.length; textIndex += 1) {
    if (text[textIndex] === token[tokenIndex]) {
      if (firstMatch === -1) firstMatch = textIndex
      lastMatch = textIndex
      tokenIndex += 1
    }
  }

  if (tokenIndex < token.length || firstMatch === -1) return 0

  const spread = lastMatch - firstMatch + 1
  return Math.max(8, 48 - spread - firstMatch)
}

const tokenScore = (text: string, token: string) => {
  if (!text || !token) return 0

  if (text === token) return 420
  if (text.startsWith(token)) return 360 - Math.min(text.length - token.length, 40)

  const words = text.split(" ")
  let best = 0

  words.forEach((word, index) => {
    if (word === token) {
      best = Math.max(best, 340 - index * 8)
      return
    }

    if (word.startsWith(token)) {
      best = Math.max(best, 300 - index * 8 - Math.min(word.length - token.length, 30))
      return
    }

    const wordIndex = word.indexOf(token)
    if (wordIndex > -1) {
      best = Math.max(best, 180 - index * 6 - wordIndex)
    }
  })

  const textIndex = text.indexOf(token)
  if (textIndex > -1) best = Math.max(best, 130 - Math.min(textIndex, 80))

  return Math.max(best, fuzzyScore(text, token))
}

const scoreText = (text: string, search: string) => {
  const normalizedText = normalizeSearchText(text)
  const normalizedSearch = normalizeSearchText(search)

  if (!normalizedSearch) return 1
  if (!normalizedText) return 0

  if (normalizedText === normalizedSearch) return 2000
  if (normalizedText.startsWith(normalizedSearch)) return 1600
  if (normalizedText.includes(normalizedSearch)) return 1200 - normalizedText.indexOf(normalizedSearch)

  const tokens = normalizedSearch.split(" ")
  let total = 0

  for (const token of tokens) {
    const score = tokenScore(normalizedText, token)
    if (score === 0) return 0
    total += score
  }

  return total / tokens.length
}

const globalSearchFilter = (value: string, search: string, keywords?: string[]) => {
  const keywordText = keywords?.join(" ") ?? ""
  const titleScore = scoreText(value, search)
  const combinedScore = scoreText(`${value} ${keywordText}`, search) * 0.65
  const keywordScore = scoreText(keywordText, search) * 0.35

  return Math.max(titleScore, combinedScore, keywordScore)
}

export default function GlobalSearch({ collapsed }: collapsed) {
  const router = useRouter()
  const { getValue } = useGlobalContext()

  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilter, setSelectedFilter] = useState("All")
  const navtype = ["All", "Settings", "Navigation"]
  const [farmModalOpen, setFarmModalOpen] = useState(() => getValue('DefaultFarmId') == null)

  const rawPermissions = getValue("UserPermission")
  let userPermissions: Array<{
    group_name: string
    title: string
    ilink?: string
    is_visible: boolean
  }> = []

  try {
    userPermissions = typeof rawPermissions === "string"
      ? JSON.parse(rawPermissions)
      : rawPermissions || []
  } catch {
    userPermissions = []
  }

  const filteredFolders = filterNavFolders(
    NavFolders,
    userPermissions
  ) as NavCommandFolder[]

  const canInsertDocument = (child: NavCommandChild) =>
    child.insert === true &&
    Boolean(child.newDocumentUrl) &&
    userPermissions.some(
      (permission) => permission.ilink === `${child.url}/insert` && permission.is_visible
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
        {
          title: "Approval",
          description: "Manage approval templates, stages, approvers, and requests",
          icon: Settings,
          action: () => router.push("/admin/approval"),
        },
      ],
    },
  ]

  const isSearching = normalizeSearchText(searchQuery).length > 0
  const canShowSettings = selectedFilter === "All" || selectedFilter === "Settings"
  const canShowNavigation = selectedFilter === "All" || selectedFilter === "Navigation"

  const rankedResults: RankedSearchItem[] = [
    ...(canShowSettings
      ? commands.flatMap((group, groupIndex) =>
          group.items.map((cmd, itemIndex) => ({
            kind: "settings" as const,
            key: `${group.group}-${cmd.title}`,
            title: cmd.title,
            description: cmd.description,
            group: group.group,
            score: globalSearchFilter(cmd.title, searchQuery, [group.group, cmd.description]),
            order: groupIndex * 1000 + itemIndex,
            icon: cmd.icon,
            action: cmd.action,
          }))
        )
      : []),
    ...(canShowNavigation
      ? filteredFolders.flatMap((folder, folderIndex) =>
          folder.items?.flatMap((group, groupIndex) =>
            group.children.flatMap((child, childIndex) => {
              const navigationItem: RankedSearchItem = {
                kind: "navigation",
                key: `${child.url}-${child.title}`,
                title: child.title,
                description: `${folder.title} > ${group.group}`,
                type: child.type,
                url: child.url,
                score: globalSearchFilter(child.title, searchQuery, [folder.title, group.group, child.type ?? ""]),
                order: folderIndex * 10000 + groupIndex * 1000 + childIndex * 2,
              }

              if (!canInsertDocument(child)) return [navigationItem]

              const newDocumentTitle = `${child.title} New Document`
              const newDocumentItem: RankedSearchItem = {
                kind: "navigation",
                key: `${child.newDocumentUrl}-${newDocumentTitle}`,
                title: newDocumentTitle,
                description: `${folder.title} > ${group.group} > New Document`,
                type: child.type,
                url: child.newDocumentUrl!,
                score: globalSearchFilter(newDocumentTitle, searchQuery, [
                  folder.title,
                  group.group,
                  child.type ?? "",
                  "new insert create add",
                ]),
                order: folderIndex * 10000 + groupIndex * 1000 + childIndex * 2 + 1,
              }

              return [navigationItem, newDocumentItem]
            })
          ) ?? []
        )
      : []),
  ]
    .filter((item) => !isSearching || item.score > 0)
    .sort((left, right) => {
      if (!isSearching) return left.order - right.order
      return right.score - left.score || left.order - right.order
    })

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
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className={`relative h-9 gap-2 rounded-xl border border-border/80 bg-card py-2 text-sm font-normal text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40 ${collapsed ? "w-9 justify-center px-0" : "w-full justify-start px-3"}`}
        aria-label="Open global search"
      >
        <Search className="h-4 w-4" />

        {!collapsed && (
          <>
            <span className="flex-1 text-left">Search settings...</span>

            <kbd className="pointer-events-none absolute right-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted/70 px-1.5 font-mono text-[10px] font-medium opacity-80 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </>
        )}
      </Button>

      {/* COMMAND DIALOG */}
      <CommandDialog open={open} onOpenChange={setOpen} filter={globalSearchFilter} shouldFilter={!isSearching}>
        <CommandInput
          placeholder="Search modules, reports, or commands..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <div className="p-2 flex gap-2 text-center items-center pb-2 border-b">
          {navtype.map((filter) => (
            <Button
              key={filter}
              size={"xs"}
              variant={selectedFilter === filter ? "default" : "outline"}
              className={`${selectedFilter === filter ? "" : "bg-transparent"} h-6 px-2`}
              onClick={() => setSelectedFilter(filter)}
            >
              {filter}
            </Button>
          ))}
        </div>
        <CommandList className="max-h-100">
          {rankedResults.length === 0 && (
            <div className="py-6 text-center text-sm">No results found.</div>
          )}

          {isSearching && rankedResults.length > 0 && (
            <CommandGroup heading="Results">
              {rankedResults.map((item) => {
                if (item.kind === "settings") {
                  const Icon = item.icon

                  return (
                    <CommandItem
                      key={item.key}
                      value={item.title}
                      onSelect={() => runCommand(item.action)}
                    >
                      <Icon className="mr-2 h-4 w-4 text-green-500" />

                      <div className="flex flex-col">
                        <span>{item.title}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {item.description}
                        </span>
                      </div>
                    </CommandItem>
                  )
                }

                const Icon = getModuleIcon(item.title, item.type)

                return (
                  <CommandItem
                    key={item.key}
                    value={item.title}
                    onSelect={() => {
                      if (item.url !== "#") {
                        runCommand(() => router.push(item.url))
                      }
                    }}
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />

                    <div className="flex flex-col">
                      <span>{item.title}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.description}
                      </span>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}

          {!isSearching && (
            <>
              <CommandEmpty>No results found.</CommandEmpty>

          {canShowSettings && (
            commands.map((group) => (
              <React.Fragment key={group.group}>
                <CommandGroup heading={group.group}>
                  {group.items.map((cmd) => {
                    const Icon = cmd.icon

                    return (
                      <CommandItem
                        key={cmd.title}
                        value={cmd.title}
                        keywords={[group.group, cmd.description]}
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



          {canShowNavigation && filteredFolders.map((folder) => (
            <React.Fragment key={folder.id}>
              <CommandGroup heading={folder.title}>
                {folder.items?.map((group) =>
                  group.children.flatMap((child) => {
                    const Icon = getModuleIcon(child.title, child.type)
                    const items = [(
                    <CommandItem
                      key={child.url + child.title}
                      value={child.title}
                      keywords={[folder.title, group.group, child.type ?? ""]}
                      onSelect={() => {
                        if (child.url !== "#") {
                          runCommand(() =>
                            router.push(child.url)
                          )
                        }
                      }}
                    >
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground" />

                      <div className="flex flex-col">
                        <span>{child.title}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {folder.title} &gt; {group.group}
                        </span>
                      </div>
                    </CommandItem>
                    )]

                    if (canInsertDocument(child)) {
                      const newDocumentTitle = `${child.title} New Document`
                      items.push(
                        <CommandItem
                          key={`${child.newDocumentUrl}-${newDocumentTitle}`}
                          value={newDocumentTitle}
                          keywords={[folder.title, group.group, child.type ?? "", "new insert create add"]}
                          onSelect={() => runCommand(() => router.push(child.newDocumentUrl!))}
                        >
                          <Icon className="mr-2 h-4 w-4 text-green-500" />

                          <div className="flex flex-col">
                            <span>{newDocumentTitle}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {folder.title} &gt; {group.group} &gt; New Document
                            </span>
                          </div>
                        </CommandItem>
                      )
                    }

                    return items
                  })
                )}
              </CommandGroup>

              <CommandSeparator />
            </React.Fragment>
          ))}
            </>
          )}

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
          className="float-right mx-4 mb-3" size={"xs"}>Close</Button>
      </Modal>
    </>
  )
}
