"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import {
  Combobox,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

export type ComboboxItemType = {
  code: string
  name: string
}

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)))

type MultiProps = {
  multiple: true
  label?: string
  required?: boolean
  items: ComboboxItemType[]
  value: string[]
  onValueChange: (value: string[]) => void
  allowSelectAll?: boolean
  autoHighlight?: boolean
  className?: string
  placeholder?: string
  showCode?: boolean
}

type SingleProps = {
  multiple?: false
  label?: string
  required?: boolean
  items: ComboboxItemType[]
  value: string
  onValueChange: (value: string) => void
  allowSelectAll?: boolean
  autoHighlight?: boolean
  className?: string
  placeholder?: string
  showCode?: boolean
}

type Props =
  | (MultiProps & {
    open?: boolean
    onOpenChange?: (open: boolean) => void
  })
  | (SingleProps & {
    open?: boolean
    onOpenChange?: (open: boolean) => void
  })

export default function SearchableCombobox(props: Props) {
  const [showModal, setShowModal] = React.useState(false)
  const [modalSearch, setModalSearch] = React.useState("")
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const anchor = useComboboxAnchor()
  const searchRef = React.useRef<HTMLInputElement>(null)

  const {
    items,
    allowSelectAll = true,
    autoHighlight = true,
    className = "w-full max-w-xs",
    placeholder = props.multiple ? "Search and select..." : "Select an option...",
    showCode = false,
  } = props

  const open = props.open !== undefined ? props.open : internalOpen

  const setOpen = (value: boolean) => {
    if (props.onOpenChange) {
      props.onOpenChange(value)
    } else {
      setInternalOpen(value)
    }
  }

  const normalizedValue = React.useMemo(() => {
    if (props.multiple) {
      return Array.isArray(props.value)
        ? uniqueStrings(props.value.map((value) => String(value ?? "").trim()))
        : []
    }

    return props.value ?? ""
  }, [props.multiple, props.value])

  const uniqueItems = React.useMemo(() => {
    const seen = new Set<string>()

    return items.filter((item) => {
      const code = String(item.code ?? "").trim()
      if (!code || seen.has(code)) return false
      seen.add(code)
      return true
    })
  }, [items])

  const selectedCodes = React.useMemo(
    () => props.multiple ? normalizedValue as string[] : [],
    [normalizedValue, props.multiple]
  )

  const filteredItems = React.useMemo(() => {
    if (!search) return uniqueItems

    return uniqueItems.filter((item) =>
      `${item.code} ${item.name}`.toLowerCase().includes(search.toLowerCase())
    )
  }, [uniqueItems, search])

  const selectedItems = React.useMemo(() => {
    return selectedCodes.map((code) => (
      uniqueItems.find((item) => item.code === code) ?? { code, name: code }
    ))
  }, [uniqueItems, selectedCodes])

  const modalFiltered = React.useMemo(() => {
    if (!modalSearch) return selectedItems

    return selectedItems.filter((item) =>
      `${item.code} ${item.name}`.toLowerCase().includes(modalSearch.toLowerCase())
    )
  }, [selectedItems, modalSearch])

  const safeHighlightedIndex = Math.min(
    highlightedIndex,
    Math.max(0, filteredItems.length - 1),
  )

  const formatLabel = (item?: ComboboxItemType) => {
    if (!item) return ""
    return showCode ? `${item.code} - ${item.name}` : item.name
  }

  const removeItem = (code: string) => {
    if (!props.multiple) return
    props.onValueChange(selectedCodes.filter((value) => value !== code))
  }

  const selectItem = (code: string) => {
    if (props.multiple) {
      if (!selectedCodes.includes(code)) {
        props.onValueChange([...selectedCodes, code])
      }
      return
    }

    props.onValueChange(code)
    setOpen(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    setHighlightedIndex(0)

    if (nextOpen) {
      setTimeout(() => searchRef.current?.focus(), 0)
    } else {
      setSearch("")
    }
  }

  return (
    <div className="relative min-w-0 ">
      {(props.label || props.multiple) && (
        <div className="flex  items-center justify-between mb-0.5">
          {props.label && (
            <Label required={props.required} className="">
              {props.label}
            </Label>
          )}

          {props.multiple && (
            <span className="text-xs text-muted-foreground ">
              {selectedCodes.length} selected
            </span>
          )}
        </div>
      )}

      <Combobox
        open={open}
        onOpenChange={handleOpenChange}
        multiple={props.multiple}
        autoHighlight={autoHighlight}
          items={filteredItems}
          value={normalizedValue}
          onValueChange={(val) => {
            if (props.multiple) {
            props.onValueChange(uniqueStrings(Array.isArray(val) ? val : val ? [val] : []))
          } else {
            props.onValueChange(Array.isArray(val) ? val[0] ?? "" : val ?? "")
            setOpen(false)
          }
        }}
      >
        <ComboboxChips
          ref={anchor}
          className={cn(
            "min-h-10 border-[#b8b2aa] bg-[#fffdfb] px-3 py-2 shadow-none hover:border-ring dark:border-input dark:bg-input/30",
            props.multiple && "items-start",
            className
          )}
        >
          <ComboboxValue>
            {(values) => {
              const normalized = Array.isArray(values)
                ? values
                : values
                  ? [values]
                  : []

              if (props.multiple) {
                const visibleItems = selectedItems.slice(0, 2)
                const hiddenCount = selectedItems.length - visibleItems.length

                return (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {visibleItems.map((item) => (
                      <span
                        key={item.code}
                        className="inline-flex max-w-[220px] items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-700"
                      >
                        <span className="truncate">{formatLabel(item)}</span>
                        <button
                          type="button"
                          className="rounded-sm text-stone-500 hover:bg-stone-200 hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-300"
                          aria-label={`Remove ${formatLabel(item)}`}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            removeItem(item.code)
                          }}
                        >
                          <X className="size-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}

                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          setShowModal(true)
                        }}
                        className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        +{hiddenCount} more
                      </button>
                    )}

                    <ComboboxChipsInput
                      className="min-w-28 flex-1 text-sm placeholder:text-muted-foreground"
                      placeholder={selectedItems.length === 0 ? placeholder : "Search..."}
                    />
                  </div>
                )
              }

              const val = normalized[0]
              const item = uniqueItems.find((candidate) => candidate.code === val)

              return (
                <ComboboxChipsInput
                  value={formatLabel(item)}
                  placeholder={placeholder}
                  className="text-sm placeholder:text-muted-foreground"
                  readOnly
                />
              )
            }}
          </ComboboxValue>

          <ComboboxTrigger />
        </ComboboxChips>

        <ComboboxContent anchor={anchor} className="rounded-lg border border-stone-200 p-0 shadow-lg">
          <div className="border-b border-stone-200 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                className="h-9 w-full border-stone-300 pl-8 shadow-none"
                placeholder="Search..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setHighlightedIndex(0)
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" && filteredItems.length > 0) {
                    event.preventDefault()
                    setHighlightedIndex((current) => (current + 1) % filteredItems.length)
                    return
                  }

                  if (event.key === "ArrowUp" && filteredItems.length > 0) {
                    event.preventDefault()
                    setHighlightedIndex((current) => (
                      current - 1 + filteredItems.length
                    ) % filteredItems.length)
                    return
                  }

                  if ((event.key === "Enter" || event.key === "Tab") && filteredItems.length > 0) {
                    event.preventDefault()
                    selectItem(filteredItems[safeHighlightedIndex]?.code ?? filteredItems[0].code)
                  }
                }}
              />
            </div>
          </div>

          {props.multiple && allowSelectAll && (
            <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-2 py-2">
              <span className="text-xs text-muted-foreground">
                {filteredItems.length} result{filteredItems.length === 1 ? "" : "s"}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={filteredItems.length === 0}
                  onClick={() => {
                    const filteredCodes = filteredItems.map((item) => item.code)
                    props.onValueChange(Array.from(new Set([...selectedCodes, ...filteredCodes])))
                  }}
                >
                  Select results
                </button>

                <button
                  type="button"
                  className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={selectedCodes.length === 0}
                  onClick={() => props.onValueChange([])}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {filteredItems.length === 0 && (
            <ComboboxEmpty className="flex py-6">
              No items found.
            </ComboboxEmpty>
          )}

          <ComboboxList className="max-h-64 p-1">
            {(item: ComboboxItemType, index: number) => (
              <ComboboxItem
                key={`${item.code}-${index}`}
                value={item.code}
                className={cn(
                  "min-h-10 rounded-md px-2 py-2",
                  index === safeHighlightedIndex && "bg-accent text-accent-foreground",
                )}
                onMouseMove={() => setHighlightedIndex(index)}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {showCode && (
                    <span className="shrink-0 rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[11px] text-stone-600">
                      {item.code}
                    </span>
                  )}
                  <span className="truncate text-sm">{item.name}</span>
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>

        <Dialog
          open={showModal}
          onOpenChange={(nextOpen) => {
            setShowModal(nextOpen)
            if (!nextOpen) setModalSearch("")
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Selected Items
              </DialogTitle>
            </DialogHeader>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search selected..."
                value={modalSearch}
                onChange={(event) => setModalSearch(event.target.value)}
                className="pl-8"
              />
            </div>

            <div className="max-h-80 space-y-2 overflow-auto pr-1">
              {modalFiltered.length === 0 && (
                <div className="rounded-md border border-dashed border-stone-300 p-6 text-center text-sm text-muted-foreground">
                  No items found.
                </div>
              )}

              {modalFiltered.map((item) => (
                <div
                  key={item.code}
                  className="flex items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2"
                >
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-medium text-stone-900">
                      {item.name}
                    </span>
                    {showCode && (
                      <span className="block font-mono text-xs text-muted-foreground">
                        {item.code}
                      </span>
                    )}
                  </span>

                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
                    onClick={() => removeItem(item.code)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </Combobox>
    </div>
  )
}
