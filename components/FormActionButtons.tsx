"use client"

import { Button } from "@/components/ui/button"
import { Save, Pencil, Loader2, X } from "lucide-react"
import { useRouter } from "next/navigation"

type Props = {
  saving?: boolean
  isEdit?: boolean
  disabled?: boolean
  cancelPath: string
  onSave: () => void
}

export default function FormActionButtons({
  saving = false,
  isEdit = false,
  disabled = false,
  cancelPath,
  onSave,
}: Props) {
  const router = useRouter()

  return (
    <div className="flex items-center justify-end gap-2 pt-2 ">
      <Button type="button" onClick={onSave} disabled={disabled} className="w-full md:w-auto h-full md:h-auto">
        {saving ? (
          <>
            <Loader2 className="mr-4 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : isEdit ? (
          <>
            <Pencil className="mr-2 h-4 w-4" />
            Update
          </>
        ) : (
          <>
            <Save className="mr-2 " />
            Save
          </>
        )}
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={() => router.push(cancelPath)}
        disabled={disabled}
        className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700 w-full md:w-auto h-full md:h-auto"
      >
        <X className="mr-2 h-4 w-4" />
        Cancel
      </Button>
    </div>
  )
}