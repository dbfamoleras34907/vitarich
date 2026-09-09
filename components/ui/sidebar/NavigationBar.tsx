'use client'
import { ReactNode } from "react"

type SideBarMainProps = {
    children: ReactNode
    fatherLabel?: string
    fatherLink?: string
    currentLabel: string
}
// navigation bar
export default function NavigationBar({
    children,
    fatherLabel = "",
    fatherLink = "#",
    currentLabel,
}: SideBarMainProps) {
    return (
        <div className="min-h-full">
            <div className="mx-auto w-full px-4">
                {children}
            </div>
        </div>
    )
}
