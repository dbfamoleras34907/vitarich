"use client"

import React from "react"
import SearchableCombobox from "@/components/SearchableCombobox"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

const numbers = [
    { code: "1", name: "one" },
    { code: "2", name: "two" },
    { code: "3", name: "three" },
    { code: "4", name: "four" },
    { code: "5", name: "five" },
    { code: "6", name: "six" },
    { code: "7", name: "seven" },
    { code: "8", name: "eight" },
    { code: "9", name: "nine" },
    { code: "10", name: "ten" },
]

export default function page() {
    const [singleValue, setSingleValue] = React.useState("")
    const [multipleValue, setMultipleValue] = React.useState<string[]>([])

    return (
        <div className="p-8 space-y-8 max-w-xl">

            <h1 className="text-2xl font-bold">
                Combobox Demo
            </h1>

            {/* SINGLE SELECT */}
            <div className="space-y-2">
                <label className="font-medium">
                    Single Select
                </label>

                <SearchableCombobox
                    items={numbers}
                    value={singleValue}
                    onValueChange={setSingleValue}

                    showCode
                    className="w-full border shadow bg-white"
                />

                <div className="text-sm text-muted-foreground">
                    Selected value: {singleValue || "none"}
                </div>
            </div>


            {/* MULTIPLE SELECT */}
            <div className="space-y-2">
                <label className="font-medium">
                    Multiple Select
                </label>

                <SearchableCombobox
                    multiple
                    items={numbers}
                    value={multipleValue}
                    onValueChange={setMultipleValue}
                    showCode
                    className="w-full border shadow bg-white"

                />

                <div className="text-sm text-muted-foreground">
                    Selected values: {multipleValue.length
                        ? multipleValue.map((code) => {
                            const item = numbers.find((n) => n.code === code)
                            return (
                                <p key={code}>
                                    {item?.code} - {item?.name}
                                </p>
                            )
                        })
                        : "none"}
                </div>
            </div>
      <Button onClick={()=> toast("test")} >Toast test</Button>
      // toast example
        </div>
    )
}
