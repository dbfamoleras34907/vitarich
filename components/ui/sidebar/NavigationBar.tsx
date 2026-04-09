'use client'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import { ReactNode, useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "../avatar"
import { Button } from "../button"
import { Sun } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "../dropdown-menu"
// import GlobalDefaults from "@/lib/GlobalDefaults"
import { useTheme } from "next-themes"
import GlobalSearch from "../GlobalSearch"
import GlobalDefaults from "@/lib/Defaults/GlobalDefaults"
import UserAccountMenu from "@/lib/UserAccountMenu"
import ThemeSwitch from "@/lib/ThemeSwitch"
import { Session } from "@supabase/supabase-js"

import { db } from "@/lib/Supabase/supabaseClient"
// import DefaultBranch from "@/components/DefaultBranch"

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
    const { setTheme, theme } = useTheme()
    const [session, setSession] = useState<Session | null>()

    useEffect(() => {
        const getUser = async () => {
            const { data: { session } } = await db.auth.getSession()
            setSession(session)
        }
        getUser()
    }, [])
    return (
        <SidebarProvider >
            <SidebarInset>
                <header className="
                        fixed top-0 left-0
                        w-full z-5
                        bg-white shadow
                        h-15    
                        flex items-center gap-2 px-4
                        ">
                    <div className="w-10 sm:w-0"></div>

                    <div className="ml-auto flex gap-4 items-center">
                        {/* <GlobalSearch />
                        {/* <DefaultBranch /> */}
                        {/* <GlobalDefaults /> */}
                        {/* <Button onClick={() => theme == "light" ? setTheme("dark") : setTheme("light")}>
                            <Sun />
                        </Button> */}
                        {/* <DropdownMenu>
                            <DropdownMenuTrigger>
                                <Avatar className="cursor-pointer" >
                                    <AvatarImage src="htxtps://avatars.githubusercontent.com/u/14121234?v=4&size=64" />
                                    <AvatarFallback>VI</AvatarFallback>
                                </Avatar>
                            </DropdownMenuTrigger> 
                            <DropdownMenuTrigger>
                                <UserAccountMenu session={session} collapsed={false} />
                            </DropdownMenuTrigger>

                            {/* <ThemeSwitch collapsed={false} />
                            <DropdownMenuContent>
                                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                                <DropdownMenuItem>Profile</DropdownMenuItem>
                                <Separator className="border border-secondary" />
                                <DropdownMenuItem ><a href="/logout">Logout</a></DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu> */}

                        <UserAccountMenu session={session} collapsed={false} />
                    </div>
                </header>
                {/* <Separator className=""/> */}
                <div className="overflow-auto pt-15   mx-auto w-full p-3">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
