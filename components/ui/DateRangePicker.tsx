"use client"

import * as React from "react"
import { DateRange } from "react-day-picker"
import { format, parse } from "date-fns"

import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
    value?: {
        from?: string
        to?: string
    }
    onChange?: (e: { from?: string; to?: string }) => void
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
    const [date, setDate] = React.useState<DateRange | undefined>()
    const [open, setOpen] = React.useState(false)

    const formatDate = (d?: Date) =>
        d ? format(d, "dd/MM/yyyy") : undefined

    const parseDate = (d?: string) =>
        d ? parse(d, "dd/MM/yyyy", new Date()) : undefined

    /**
     * Sync external value → internal state
     */
    React.useEffect(() => {
        if (!value?.from && !value?.to) {
            setDate(undefined)
            return
        }

        setDate({
            from: parseDate(value?.from),
            to: parseDate(value?.to),
        })
    }, [value?.from, value?.to])

    const handleSelect = (range: DateRange | undefined) => {
        setDate(range)

        if (onChange) {
            onChange({
                from: formatDate(range?.from),
                to: formatDate(range?.to),
            })
        }
    }

    const clearDate = () => {
        setDate(undefined)

        if (onChange) {
            onChange({
                from: undefined,
                to: undefined,
            })
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button className="w-50 hover:bg-primary/10 justify-start text-left border border-primary bg-gray-50 text-black">
                    {date?.from ? (
                        date.to ? (
                            <>
                                {format(date.from, "dd/MM/yyyy")} -{" "}
                                {format(date.to, "dd/MM/yyyy")}
                            </>
                        ) : (
                            format(date.from, "dd/MM/yyyy")
                        )
                    ) : (
                        <span>Select date range</span>
                    )}
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-auto p-3 space-y-2">
                <Calendar
                    autoFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={handleSelect}
                    numberOfMonths={2}
                />

                <div className="flex justify-between">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={clearDate}
                    >
                        Clear
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpen(false)}
                    >
                        Confirm
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}