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
import { ChevronDown, Search } from 'lucide-react'

type Props<T> = {
  list: T[] | ((row: unknown) => T[])
  row?: unknown
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
  T extends object
>({
  list,
  row,
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
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  // resolve list
  const resolvedList = useMemo<T[]>(() => {
    if (typeof list === 'function') {
      return list(row) || []
    }

    return list || []
  }, [list, row])

  const displayText = (() => {
    const found = resolvedList.find(
      i => String(i[codeLabel]) === value
    )

    if (!found) return value || placeholder

    if (!nameLabel) return String(found[codeLabel])

    return showNameOnly
      ? String(found[nameLabel])
      : `${found[codeLabel]} — ${found[nameLabel]}`
  })()

  const filtered = useMemo(() => {
    if (!search) return resolvedList

    const q = search.toLowerCase()

    return resolvedList.filter(item => {
      const code = String(item[codeLabel]).toLowerCase()

      const name = nameLabel
        ? String(item[nameLabel]).toLowerCase()
        : ''

      return code.includes(q) || name.includes(q)
    })
  }, [resolvedList, search, codeLabel, nameLabel])

  const safeHighlightedIndex = Math.min(
    highlightedIndex,
    Math.max(0, filtered.length - 1),
  )

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
    if (e.key === 'ArrowDown' && filtered.length > 0) {
      e.preventDefault()
      setHighlightedIndex(current => (current + 1) % filtered.length)
      return
    }

    if (e.key === 'ArrowUp' && filtered.length > 0) {
      e.preventDefault()
      setHighlightedIndex(current => (current - 1 + filtered.length) % filtered.length)
      return
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()

      if (filtered.length > 0) {
        selectItem(filtered[safeHighlightedIndex] ?? filtered[0])
      } else if (allowFreeText && search) {
        selectFreeText()
      }
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (disabled) return
        setOpen(o)
        setHighlightedIndex(0)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          disabled={disabled}
          title={displayText}
          className="h-9 w-full justify-start overflow-hidden whitespace-nowrap border border-input bg-white text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-muted-foreground disabled:opacity-100 dark:bg-input/30 dark:hover:bg-input/50 dark:disabled:bg-input/20"
          onKeyDown={(event) => {
            if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !open) {
              event.preventDefault()
              setOpen(true)
              setHighlightedIndex(0)
            }
          }}
        >
          <span className="truncate flex items-center gap-2">
            {!displayText ? (
              <>
                <Search size={16} /> Search...
              </>
            ) : (
              displayText
            )}
          </span>
          <ChevronDown className='ml-auto'/>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="p-0 max-h-[min(50vh,calc(100vh-120px))] overflow-auto"
        style={{ width }}
      >
        <Command onKeyDown={handleKeyDown}>
          <CommandInput
            placeholder="Search..."
            value={search}
            onValueChange={(value) => {
              setSearch(value)
              setHighlightedIndex(0)
            }}
          />

          <CommandEmpty>
            {allowFreeText && search ? (
              <CommandItem onSelect={selectFreeText}>
                Use: &quot;{search}&quot;
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
                onMouseMove={() => setHighlightedIndex(idx)}
                className={`w-full whitespace-nowrap px-4 ${
                  idx === safeHighlightedIndex ? 'bg-accent text-accent-foreground' : ''
                }`}
              >
                {nameLabel
                  ? showNameOnly
                    ? String(item[nameLabel])
                    : `${item[codeLabel]} — ${item[nameLabel]}`
                  : String(item[codeLabel])}
              </CommandItem>
            ))}

            {allowFreeText && (
              <CommandItem onSelect={selectFreeText}>
                Use: &quot;{search}&quot;
              </CommandItem>
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
