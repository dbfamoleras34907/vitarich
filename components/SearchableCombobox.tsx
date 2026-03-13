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
import { Input } from "./ui/input"

type ComboboxItemType = {
  code: string
  name: string
}

type MultiProps = {
  multiple: true
  items: ComboboxItemType[]
  value: string[]
  onValueChange: (value: string[]) => void
  autoHighlight?: boolean
  className?: string
  showCode?: boolean
}

type SingleProps = {
  multiple?: false
  items: ComboboxItemType[]
  value: string
  onValueChange: (value: string) => void
  autoHighlight?: boolean
  className?: string
  showCode?: boolean
}

type Props = MultiProps | SingleProps

export default function SearchableCombobox(props: Props) {
  const anchor = useComboboxAnchor()
  const searchRef = React.useRef<HTMLInputElement>(null)

  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const {
    items,
    autoHighlight = true,
    className = "w-full max-w-xs",
    showCode = false,
  } = props

  const filteredItems = React.useMemo(() => {
    if (!search) return items

    return items.filter((item) =>
      `${item.code} ${item.name}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  }, [items, search])

  const formatLabel = (item?: ComboboxItemType) => {
    if (!item) return ""
    return showCode ? `${item.code} - ${item.name}` : item.name
  }

  const selectItem = (code: string) => {
    if (props.multiple) {
      const current = Array.isArray(props.value) ? props.value : []

      if (!current.includes(code)) {
        props.onValueChange([...current, code])
      }

      // keep dropdown open for multiple select
    } else {
      props.onValueChange(code)

      // close only for single select
      setOpen(false)
    }
  }

  return (
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
      value={props.value as any}
      onValueChange={(val) => {
        if (props.multiple) {
          if (!val) props.onValueChange([])
          else if (Array.isArray(val)) props.onValueChange(val)
          else props.onValueChange([val])
        } else {
          if (!val) props.onValueChange("")
          else if (Array.isArray(val)) props.onValueChange(val[0] ?? "")
          else props.onValueChange(val)
        }

        if (!props.multiple) {
          setOpen(false)
        }
      }}
    >
      <ComboboxChips ref={anchor} className={`${className} w-full border`}>
        <ComboboxValue>
          {(values) => {
            const normalized = Array.isArray(values)
              ? values
              : values
                ? [values]
                : []

            if (props.multiple) {
              return (
                <>
                  {normalized.map((val) => {
                    const item = items.find((f) => f.code === val)

                    return (
                      <ComboboxChip key={val} className="bg-black/75 rounded-2xl text-white">
                        {formatLabel(item)}
                      </ComboboxChip>
                    )
                  })}
                  <ComboboxChipsInput />
                </>
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

      <ComboboxContent anchor={anchor}>
        <div className="p-2">
          <Input
            ref={searchRef}
            className="w-full"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab" && filteredItems.length > 0) {
                e.preventDefault()
                selectItem(filteredItems[0].code)
              }
            }}
          />
        </div>

        {filteredItems.length === 0 && (
          <ComboboxEmpty>No items found.</ComboboxEmpty>
        )}

        <ComboboxList>
          {(item: ComboboxItemType) => (
            <ComboboxItem key={item.code} value={item.code}>
              {formatLabel(item)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}