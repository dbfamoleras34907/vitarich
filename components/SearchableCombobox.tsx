"use client"

import * as React from "react"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { Input } from "./ui/input"
import { Label } from "./ui/label"


export type ComboboxItemType = {
  code: string
  name: string
}

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
  const anchor = useComboboxAnchor()
  const searchRef = React.useRef<HTMLInputElement>(null)

  // const [open, setOpen] = React.useState(false)

  const [internalOpen, setInternalOpen] = React.useState(false)

  const open =
    props.open !== undefined ? props.open : internalOpen

  const setOpen = (value: boolean) => {
    if (props.onOpenChange) {
      props.onOpenChange(value)
    } else {
      setInternalOpen(value)
    }
  }
  const [search, setSearch] = React.useState("")

  const {
    items,
    autoHighlight = true,
    className = "w-full max-w-xs",
    showCode = false,
  } = props

  /**
   * 🔑 Normalize value so Combobox NEVER receives undefined
   */
  const normalizedValue = React.useMemo(() => {
    if (props.multiple) {
      return Array.isArray(props.value) ? props.value : []
    }
    return props.value ?? ""
  }, [props.multiple, props.value])

  const filteredItems = React.useMemo(() => {
    if (!search) return items

    return items.filter((item) =>
      `${item.code} ${item.name}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  }, [items, search])

  const selectedItems = React.useMemo(() => {
    if (!props.multiple) return []
    return items.filter((item) =>
      normalizedValue.includes(item.code)
    )
  }, [items, normalizedValue, props.multiple])

  const modalFiltered = React.useMemo(() => {
    if (!modalSearch) return selectedItems

    return selectedItems.filter((item) =>
      `${item.code} ${item.name}`
        .toLowerCase()
        .includes(modalSearch.toLowerCase())
    )
  }, [selectedItems, modalSearch])

  const formatLabel = (item?: ComboboxItemType) => {
    if (!item) return ""
    return showCode ? `${item.code} - ${item.name}` : item.name
  }

  const selectItem = (code: string) => {
    if (props.multiple) {
      const current = normalizedValue as string[]

      if (!current.includes(code)) {
        props.onValueChange([...current, code])
      }
    } else {
      props.onValueChange(code)
      setOpen(false)
    }
  }

  const renderHiddenBadge = () => {
    if (!props.multiple) return null

    const selected = normalizedValue as string[]
    const hiddenCount = selected.length - 1

    if (hiddenCount <= 0) return null

    return (
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="absolute right-0 mb-1 px-2 py-0.5 text-xs rounded bg-primary mt-1 z-50 hover:bg-primary/70 border-black/10 shadow-2xl border-2 text-white transition whitespace-nowrap"
      >
        +{hiddenCount} more
      </button>
    )
  }

  return (
    <div className="relative overflow-x-auto">
      <div className="flex justify-between items-center">
        {props.label && (
          <Label className="mb-2" required={props.required} >
            {props.label}
          </Label>
        )
        }

        {renderHiddenBadge()}
      </div>

      <Combobox
        open={open}
        onOpenChange={(o) => {
          setOpen(o)

          if (o) {
            setTimeout(() => searchRef.current?.focus(), 0)
          } else {
            setSearch("")
          }
        }}
        multiple={props.multiple}
        autoHighlight={autoHighlight}
        items={filteredItems}
        value={normalizedValue}
        onValueChange={(val) => {
          if (props.multiple) {
            props.onValueChange(
              Array.isArray(val) ? val : val ? [val] : []
            )
          } else {
            props.onValueChange(
              Array.isArray(val)
                ? val[0] ?? ""
                : val ?? ""
            )
          }

          if (!props.multiple) {
            setOpen(false)
          }
        }}
      >
        <ComboboxChips ref={anchor} className={className}>
          <ComboboxValue>
            {(values) => {
              const normalized = Array.isArray(values)
                ? values
                : values
                  ? [values]
                  : []

              if (props.multiple) {
                const selected = normalizedValue as string[]
                const first = selected[0]

                const firstItem = items.find(
                  (f) => f.code === first
                )

                return (
                  <div className="flex flex-col w-full min-w-0 gap-1">
                    <div className="flex items-center gap-1 overflow-hidden flex-nowrap">
                      {first && (
                        <ComboboxChip className="bg-secondary  rounded-2xl text-secondary-foreground shrink-0">
                          <span className="truncate">
                            {formatLabel(firstItem)}
                          </span>
                        </ComboboxChip>
                      )}

                      <ComboboxChipsInput className="min-w-15" />
                    </div>
                  </div>
                )
              }

              const val = normalized[0]
              const item = items.find((f) => f.code === val)

              return (
                <ComboboxChipsInput
                  value={formatLabel(item)}
                  readOnly
                />
              )
            }}
          </ComboboxValue>
        </ComboboxChips>

        {/* <ComboboxContent anchor={anchor}> */}

        <ComboboxContent
          anchor={anchor}
          onMouseDownCapture={(e) => e.stopPropagation()}
          onPointerDownCapture={(e) => e.stopPropagation()}
        >
          <div className="">
            <Input
              ref={searchRef}
              className="w-full"
              placeholder="Search..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Tab" &&
                  filteredItems.length > 0
                ) {
                  e.preventDefault()
                  selectItem(filteredItems[0].code)
                }
              }}
            />
          </div>

          <div className="flex gap-1 px-2 pb-2">
            {props.multiple && (
              <>
                <button
                  type="button"
                  className="bg-secondary text-secondary-foreground text rounded-md px-2 text-sm font-semibold"
                  onClick={() => {
                    const current =
                      normalizedValue as string[]

                    const filteredCodes =
                      filteredItems.map(
                        (i) => i.code
                      )

                    const merged = Array.from(
                      new Set([
                        ...current,
                        ...filteredCodes,
                      ])
                    )

                    props.onValueChange(merged)
                  }}
                >
                  Select all
                </button>

                <button
                  type="button"
                  className="bg-secondary text-secondary-foreground text rounded-md px-2 text-sm font-semibold"
                  onClick={() =>
                    props.onValueChange([])
                  }
                >
                  Clear
                </button>
              </>
            )}
          </div>

          {filteredItems.length === 0 && (
            <ComboboxEmpty>
              No items found.
            </ComboboxEmpty>
          )}

          <ComboboxList>
            {(item: ComboboxItemType) => (
              <ComboboxItem
                key={item.code}
                value={item.code}
              >
                {formatLabel(item)}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>

        <Dialog
          open={showModal}
          onOpenChange={setShowModal}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Selected Items
              </DialogTitle>
            </DialogHeader>

            <Input
              placeholder="Search selected..."
              value={modalSearch}
              onChange={(e) =>
                setModalSearch(e.target.value)
              }
              className="mb-2"
            />

            <div className="max-h-75 overflow-auto space-y-2">
              {modalFiltered.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No items found.
                </div>
              )}

              {modalFiltered.map((item) => (
                <div
                  key={item.code}
                  className="flex items-center justify-between border rounded-md px-3 py-2"
                >
                  <span className="text-sm">
                    {formatLabel(item)}
                  </span>

                  <button
                    className="text-xs text-red-500 hover:underline"
                    onClick={() => {
                      if (!props.multiple)
                        return

                      const current =
                        normalizedValue as string[]

                      props.onValueChange(
                        current.filter(
                          (v) =>
                            v !== item.code
                        )
                      )
                    }}
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