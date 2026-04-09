'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Search } from 'lucide-react'

type Props<T> = {
  list: T[]
  codeLabel: keyof T
  nameLabel?: keyof T
  value?: string
  showNameOnly?: boolean
  placeholder?: string
  width?: number
  disabled?: boolean
  allowFreeText?: boolean
  onChange: (value: string, item: T) => void
}

export default function SearchableDropdown<
  T extends Record<string, any>
>({
  list,
  codeLabel,
  nameLabel,
  value,
  placeholder = '',
  showNameOnly = false,
  width = 400,
  disabled = false,
  allowFreeText = false,
  onChange,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const displayText = (() => {
    const found = list.find(
      i => String(i[codeLabel]) === value
    )

    if (!found) return value || placeholder

    if (!nameLabel) return String(found[codeLabel])

    return showNameOnly
      ? String(found[nameLabel])
      : `${found[codeLabel]} — ${found[nameLabel]}`
  })()

  const filtered = useMemo(() => {
    if (!search) return list

    const q = search.toLowerCase()

    return list.filter(item => {
      const code = String(item[codeLabel]).toLowerCase()

      const name = nameLabel
        ? String(item[nameLabel]).toLowerCase()
        : ''

      return code.includes(q) || name.includes(q)
    })
  }, [list, search, codeLabel, nameLabel])

  const selectItem = (item: T) => {
    onChange(String(item[codeLabel]), item)
    setOpen(false)
    setSearch('')
  }

  const selectFreeText = () => {
    const newItem: T = {
      [codeLabel]: search,
      ...(nameLabel
        ? { [nameLabel]: search }
        : {}),
    } as T

    onChange(search, newItem)
    setOpen(false)
    setSearch('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      if (filtered.length > 0) {
        selectItem(filtered[0])
      } else if (allowFreeText && search) {
        selectFreeText()
      }
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => !disabled && setOpen(o)}
    >
      <Tooltip>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <Button
              disabled={disabled}
              className="bg-background text-foreground hover:bg-white/50 h-8 w-full justify-start overflow-hidden whitespace-nowrap border border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="truncate flex items-center gap-2">
                {!displayText ? (
                  <>
                    <Search /> Search...
                  </>
                ) : (
                  displayText
                )}
              </span>
            </Button>
          </TooltipTrigger>
        </PopoverTrigger>

        <TooltipContent>
          {displayText}
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        className="p-0 max-h-[min(50vh,calc(100vh-120px))] overflow-auto"
        style={{ width }}
      >
        <Command onKeyDown={handleKeyDown}>
          <CommandInput
            placeholder="Search..."
            value={search}
            onValueChange={setSearch}
          />

          <CommandEmpty>
            {allowFreeText && search ? (
              <CommandItem onSelect={selectFreeText}>
                Use: "{search}"
              </CommandItem>
            ) : (
              'No results found.'
            )}
          </CommandEmpty>

          <CommandGroup>
            {filtered.map((item, idx) => (
              <CommandItem
                key={idx}
                onSelect={() => selectItem(item)}
                className="w-full whitespace-nowrap px-4"
              >
                {nameLabel
                  ? showNameOnly
                    ? String(item[nameLabel])
                    : `${item[codeLabel]} — ${item[nameLabel]}`
                  : String(item[codeLabel])}
              </CommandItem>
            ))}

            {allowFreeText  &&
              // filtered.length === 0 && (
                <CommandItem onSelect={selectFreeText}>
                  Use: "{search}"
                </CommandItem>
              // )
              }
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}