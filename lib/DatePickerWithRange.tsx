"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { type DateRange, type DayButton } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar, CalendarDayButton } from "@/components/ui/calendar"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type DatePickerWithRangeProps = {
  label?: string
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
  dayAnnotation?: (date: Date) => string | undefined
  annotationHelp?: string
}

const DayAnnotationContext = React.createContext<DatePickerWithRangeProps["dayAnnotation"]>(undefined)

function AnnotatedDayButton(props: React.ComponentProps<typeof DayButton>) {
  const annotation = React.useContext(DayAnnotationContext)?.(props.day.date)
  return (
    <CalendarDayButton {...props}>
      {props.children}
      {annotation ? <small className="text-xs font-semibold text-blue-600 dark:text-blue-400">{annotation}</small> : null}
    </CalendarDayButton>
  )
}

export function DatePickerWithRange({
  label = "Date Picker Range",
  date,
  setDate,
  dayAnnotation,
  annotationHelp,
}: DatePickerWithRangeProps) {
  return (
    <Field className=" w-60">
      <FieldLabel htmlFor="date-picker-range">
        {label}
      </FieldLabel>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id="date-picker-range"
            className="justify-start px-2.5 font-normal w-full"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />

            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="start">
          <DayAnnotationContext.Provider value={dayAnnotation}>
          <Calendar
            mode="range"
            defaultMonth={date?.from ?? new Date()}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            className={dayAnnotation ? "[--cell-size:--spacing(11)] [&_button[data-day]]:whitespace-pre-line [&_button[data-day]]:leading-5" : undefined}
            components={dayAnnotation ? { DayButton: AnnotatedDayButton } : undefined}
            classNames={dayAnnotation ? { day: "relative w-full h-full p-0 text-center whitespace-pre-line" } : undefined}
          />
          </DayAnnotationContext.Provider>
          {annotationHelp ? <p className="max-w-xl px-4 pb-3 text-xs text-muted-foreground">{annotationHelp}</p> : null}
        </PopoverContent>
      </Popover>
    </Field>
  )
}
