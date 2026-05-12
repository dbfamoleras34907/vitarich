import { toast } from "sonner"

export const copyRow = async (row: any) => {
    try {
        await navigator.clipboard.writeText(
            JSON.stringify(row, null, 2)
        )

        toast.success("Row copied to clipboard")
    } catch {
        toast.error("Failed to copy row")
    }
}

export const copyTable = async (rows: any[]) => {
    try {
        await navigator.clipboard.writeText(
            JSON.stringify(rows, null, 2)
        )

        toast.success("Table copied to clipboard")
    } catch {
        toast.error("Failed to copy table")
    }
}

export const toggleFullscreen = (
    element?: HTMLElement
) => {
    const elem = element || document.documentElement

    if (!document.fullscreenElement) {
        elem.requestFullscreen()
    } else {
        document.exitFullscreen()
    }
}