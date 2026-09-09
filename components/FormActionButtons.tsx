"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, Save, Pencil, Loader2, X } from "lucide-react"
import { useRouter } from "next/navigation"

type Props = {
  saving?: boolean
  isEdit?: boolean
  disabled?: boolean
  cancelPath: string
  onSave: () => void
  onSaveAndContinue?: () => void
}

export default function FormActionButtons({
  saving = false,
  isEdit = false,
  disabled = false,
  cancelPath,
  onSave,
  onSaveAndContinue,
}: Props) {
  const router = useRouter()

  return (
    <div className="flex items-center justify-baseline gap-2 pt-2">
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
      {onSaveAndContinue ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onSaveAndContinue}
          disabled={disabled}
          className="h-full w-full md:h-auto md:w-auto"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="mr-2 h-4 w-4" />
          )}
          {isEdit ? "Update & Continue" : "Save & Continue"}
        </Button>
      ) : null}
      <div className="mr-8 md:mr-0"> 
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => router.push(cancelPath)}
        disabled={disabled}
        className=" bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700 w-full md:w-auto h-full md:h-auto"
      >
        <X className="mr-2 h-4 w-4" />
        Cancel
      </Button>
    </div>
  )
}
