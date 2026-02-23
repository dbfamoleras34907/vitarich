"use client"

import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"
import { useRouter } from "next/navigation"

type EditActionButtonProps = {
  id?: string | number | null
  href: (id: string | number) => string
  label?: string
  title?: string
  disabled?: boolean
}

export default function EditActionButton({
  id,
  href,
  label = "Edit",
  title = "Edit",
  disabled = false,
}: EditActionButtonProps) {
  const router = useRouter()
  const isDisabled = disabled || id == null || id === ""

  return (
    <Button
      type="button"
      size="sm"
      title={title}
      disabled={isDisabled}
      onClick={() => {
        if (isDisabled) return
        router.push(href(id as string | number))
      }}
      className="h-8 px-3 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 hover:text-blue-700"
    >
      <Pencil className="mr-1 h-4 w-4" />
      {label}
    </Button>
  )
}