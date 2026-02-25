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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GlassWater, Search } from 'lucide-react'

type Props<T> = {
  list: T[]
  codeLabel: keyof T
  nameLabel?: keyof T
  value?: string
  showNameOnly?: boolean
  placeholder?: string
  width?: number
  onChange: (value: string, item: T) => void

}

export default function SearchableDropdown<T extends Record<string, any>>({
  list,
  codeLabel,
  nameLabel,
  value,
  placeholder = '',
  showNameOnly = false,
  width = 260,
  onChange,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const displayText = (() => {
    const found = list.find(i => String(i[codeLabel]) === value)
    if (!found) return placeholder

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && filtered.length > 0) {
      selectItem(filtered[0])
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        {/* PopoverTrigger wraps TooltipTrigger OR vice-versa — both asChild */}
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <Button
              className=" bg-background text-foreground hover:bg-white/50 h-9 w-full justify-start overflow-hidden whitespace-nowrap border border-primary"
            >
              <span className="truncate flex items-center gap-2">
                {displayText === "" || undefined ? <><Search /> Search... </> : displayText}
              </span>
            </Button>
          </TooltipTrigger>
        </PopoverTrigger>

        <TooltipContent>
          {displayText}
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        className="p-0"
        style={{ width }}
      >
        <Command onKeyDown={handleKeyDown}>
          <CommandInput
            placeholder="Search..."
            value={search}
            onValueChange={setSearch}
          />

          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup>
            {filtered.map((item, idx) => (
              <CommandItem
                key={idx}
                onSelect={() => selectItem(item)}
              >
                {/* {nameLabel
                  ? `${item[codeLabel]} — ${item[nameLabel]}`
                  : item[codeLabel]} */}

                {nameLabel
                  ? showNameOnly
                    ? String(item[nameLabel])
                    : `${item[codeLabel]} — ${item[nameLabel]}`
                  : String(item[codeLabel])}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>

  )
}
