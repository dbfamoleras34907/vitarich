// // /* eslint-disable @typescript-eslint/no-explicit-any */

// // "use client"

// // import React, { useEffect, useState } from "react"
// // import { Button } from "@/components/ui/button"
// // import { Menu, RefreshCw, Sun } from "lucide-react"
// // import { useSidebar } from "./SidebarProvider"
// // import { VersionSwitcher } from "@/components/ui/sidebar/version-switcher"
// // import { SearchForm } from "@/components/ui/sidebar/search-form"
// // import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
// // import { usePathname, useRouter } from "next/navigation"
// // import { useGlobalContext } from "../context/GlobalContext"
// // import { NavFolders } from "../Defaults/DefaultValues"
// // import GlobalSearch from "@/components/ui/GlobalSearch"
// // import GlobalDefaults from "../Defaults/GlobalDefaults"
// // import { useTheme } from "next-themes"
// // import ThemeSwitch from "../ThemeSwitch"
// // import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
// // import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
// // import { Separator } from "@/components/ui/separator"
// // import { UserProfileCard } from "../DefaultFunctions"
// // import { db } from "../Supabase/supabaseClient"
// // import { Session } from "@supabase/supabase-js"
// // import UserAccountMenu from "../UserAccountMenu"

// // const versions = ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"]

// // export function AppSidebar() {
// //   const [Loading, setLoading] = useState(false)
// //   const { collapsed, toggle } = useSidebar()
// //   const [isMobile, setIsMobile] = useState(false)
// //   const [initial, setInitial] = useState(true)
// //   const [mobileOpen, setMobileOpen] = useState(false)
// //   const router = useRouter()
// //   const { getValue, setValue } = useGlobalContext()

// //   const pathname = usePathname();
// //   const { setTheme, theme } = useTheme()

// //   useEffect(() => {

// //     setValue("loading_s", false)
// //   }, [pathname]);

// //   const filteredNavFolders = filterNavFolders(NavFolders, getValue("UserPermission") || [])

// //   useEffect(() => {
// //     const handleResize = () => setIsMobile(window.innerWidth <= 768)
// //     handleResize()
// //     window.addEventListener("resize", handleResize)
// //     return () => window.removeEventListener("resize", handleResize)
// //   }, [])

// //   useEffect(() => {
// //     const t = setTimeout(() => setInitial(false), 150)
// //     return () => clearTimeout(t)
// //   }, [])

// //   // useEffect(() => {
// //   //   filteredNavFolders.forEach(item => {

// //   //     item.map((e: any) => {
// //   //       router.prefetch(e.url)
// //   //       console.log("Prefetched routes:", { e })

// //   //     })

// //   //   })
// //   // }, [router, filteredNavFolders])
// //   const [session, setsession] = useState<Session | null>()
// //   const getUser = async () => {

// //     const { data: { session } } = await db.auth.getSession()
// //     setsession(session)
// //   }

// //   useEffect(() => {
// //     getUser()
// //     if (!filteredNavFolders) return;

// //     filteredNavFolders.forEach((folder) => {
// //       if (folder.url && folder.url !== "#") {
// //         router.prefetch(folder.url);
// //       }
// //       folder.items?.forEach((group: any) => {
// //         group.children?.forEach((child: any) => {
// //           if (child.url && child.url !== "#") {
// //             router.prefetch(child.url);
// //             // console.log("Prefetched child route:", child.url);
// //           }
// //         });
// //       });
// //     });
// //   }, [router, filteredNavFolders]);

// //   if (isMobile) {
// //     return (
// //       <>
// //         {!mobileOpen &&
// //           <Button
// //             variant="ghost"
// //             aria-label="Open menu"
// //             onClick={() => setMobileOpen(true)}
// //             className="fixed z-50 left-3 top-3 inline-flex items-center justify-center rounded-md p-2 mt-0.5"
// //           >
// //             <Menu className="size-5 m-1" />
// //           </Button>
// //         }
// //         {mobileOpen && (
// //           <div className="fixed inset-0 z-40">
// //             <div
// //               className="absolute inset-0 bg-black/40"
// //               onClick={() => setMobileOpen(false)}
// //             />
// //             <aside className="relative left-0 top-0 h-full w-64 bg-sidebar border-r shadow-lg">
// //               <div className="px-3 py-2 border-b">
// //                 <div className="flex items-center justify-between">
// //                   <VersionSwitcher versions={versions} defaultVersion={versions[0]} />
// //                   <Button
// //                     variant="ghost"
// //                     size="icon"
// //                     onClick={() => setMobileOpen(false)}
// //                   >
// //                     <Menu className="size-5 m-1 cursor-pointer" />
// //                   </Button>
// //                 </div>
// //                 {/* <SearchForm /> */}
// //               </div>
// //               <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">


// //                 <GlobalSearch collapsed={collapsed} />
// //                 {/* <DefaultBranch /> */}
// //                 {/* <GlobalDefaults collapsed={collapsed} />
// //                 <ThemeSwitch collapsed={collapsed} /> */}

// //                 <div className="mt-4"></div>

// //                 {filteredNavFolders.map((item, i) => (
// //                   <a
// //                     key={i}
// //                     href={item.url}
// //                     onClick={() => setMobileOpen(false)}
// //                     className=" font-normal flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent  transition"
// //                   >
// //                     <item.icon className="size-5" />
// //                     <span className="">{item.title}</span>
// //                   </a>
// //                 ))}

// //                 <div className="fixed bottom-4 left-4">
// //                   <ThemeSwitch collapsed={collapsed} />
// //                   <div className="my-2"></div>
// //                   <UserAccountMenu
// //                     session={session}
// //                     collapsed={false}
// //                   />
// //                 </div>
// //               </nav>
// //             </aside>
// //           </div>
// //         )}
// //       </>
// //     )
// //   }

// //   return (
// //     <aside
// //       className={`flex flex-col h-screen border-r bg-sidebar transition-all ${collapsed ? "w-16" : "w-64"} ${initial ? "transition-none" : "duration-300"}`}
// //     >
// //       {!collapsed ? (
// //         <div className="px-3 border-b pb-2">
// //           <div className="flex items-center justify-between">
// //             <VersionSwitcher versions={versions} defaultVersion={versions[0]} />
// //             <Button
// //               variant="ghost" size="icon" className="h-6.25" onClick={toggle}>
// //               <Menu className="size-5 m-1 cursor-pointer" />
// //             </Button>
// //           </div>
// //           {/* <SearchForm /> */}
// //         </div>
// //       ) : (
// //         <div className="px-3 border-b pb-2 mt-2 flex justify-center">
// //           <Button
// //             variant="ghost" size="icon" onClick={toggle}>
// //             <Menu className="size-5 m-1 cursor-pointer" />
// //           </Button>
// //         </div>
// //       )}
// //       <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1 relative">

// //         <GlobalSearch collapsed={collapsed} />
// //         {/* <DefaultBranch /> */}

// //         <div className="mt-4"></div>

// //         <div className="overflow-y-auto">
// //           {filteredNavFolders.map((item, i) => (
// //             collapsed ? (
// //               <Tooltip key={i}>
// //                 <TooltipTrigger asChild>
// //                   <Button
// //                     variant="ghost"
// //                     type="button"
// //                     // disabled={}
// //                     onClick={() => {
// //                       // if (getValue("CurrentNavUrl") != item.url) {
// //                       setLoading(true)
// //                       setValue("CurrentNavUrl", item.url)
// //                       setValue("loading_s", true)

// //                       router.push(item.url)

// //                       // }
// //                     }}
// //                     className={`font-normal flex w-full items-center justify-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition }`}
// //                   >
// //                     <item.icon className="size-5" />
// //                   </Button>
// //                 </TooltipTrigger>
// //                 <TooltipContent side="right" align="center">
// //                   <p>{item.title}</p>
// //                 </TooltipContent>
// //               </Tooltip>
// //             ) : (
// //               <Button
// //                 variant="ghost"
// //                 key={i}
// //                 type="button"
// //                 // onClick={() => router.push(item.url)}
// //                 onClick={() => {
// //                   // if (getValue("CurrentNavUrl") != item.url) {
// //                   setLoading(true)
// //                   setValue("CurrentNavUrl", item.url)

// //                   setValue("loading_s", true)
// //                   router.push(item.url)
// //                   // }
// //                 }}
// //                 className={`flex w-full items-center justify-start gap-2 px-3 py-2 rounded-md hover:bg-accent transition }`}
// //               >
// //                 <item.icon className="size-5" />
// //                 <span className="">{item.title}</span>

// //               </Button>
// //             )
// //           ))}
// //         </div>

// //         {getValue("loading_s")
// //           &&
// //           <RefreshCw className="animate-spin size-4 absolute right-1 bottom-1" />}
// //         <div className="fixed bottom-4 left-4">
// //           <ThemeSwitch collapsed={collapsed} />
// //                   <div className="my-2"></div>
// //           <UserAccountMenu
// //             session={session}
// //             collapsed={false}
// //           />
// //           {/*   <DropdownMenu>
// //             <DropdownMenuTrigger>



// //               <UserProfileCard
// //                 email={session?.user.email ?? ""}
// //                 description="Software Engineer & UI Designer"
// //               />

// //             </DropdownMenuTrigger>
// //             <DropdownMenuContent>
// //               <DropdownMenuLabel>My Account</DropdownMenuLabel>
// //               <DropdownMenuItem>Profile</DropdownMenuItem> 
// //               <Separator className="border border-secondary" />
// //               <GlobalDefaults collapsed={collapsed} />
// //                <ThemeSwitch collapsed={collapsed} />
// //             </DropdownMenuContent>
// //           </DropdownMenu> */}
// //         </div>


// //       </nav>
// //     </aside>
// //   )
// // }


// // interface Permission {
// //   group_name: string;
// //   title: string;
// //   is_visible: boolean;
// // }

// // export function filterNavFolders(navFolders: any[], permissions: Permission[]) {
// //   return navFolders
// //     .map((folder) => ({
// //       ...folder,
// //       items: folder.items
// //         ?.map((group: any) => {
// //           const filteredChildren = group.children?.filter((child: any) =>
// //             permissions.some(
// //               (p) =>
// //                 p.is_visible &&
// //                 p.group_name === group.group &&
// //                 p.title === child.title
// //             )
// //           );

// //           return filteredChildren && filteredChildren.length > 0
// //             ? { ...group, children: filteredChildren }
// //             : null;
// //         })
// //         .filter(Boolean),
// //     }))
// //     .filter((folder) => folder.items && folder.items.length > 0);
// // }
// // // rebuild


// /* eslint-disable @typescript-eslint/no-explicit-any */
// "use client"

// import React, { useEffect, useState } from "react"
// import { Button } from "@/components/ui/button"
// import { Menu, RefreshCw, ChevronDown } from "lucide-react"
// import { useSidebar } from "./SidebarProvider"
// import { VersionSwitcher } from "@/components/ui/sidebar/version-switcher"
// import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
// import { usePathname, useRouter } from "next/navigation"
// import { useGlobalContext } from "../context/GlobalContext"
// import { NavFolders } from "../Defaults/DefaultValues"
// import GlobalSearch from "@/components/ui/GlobalSearch"
// import ThemeSwitch from "../ThemeSwitch"
// import { db } from "../Supabase/supabaseClient"
// import { Session } from "@supabase/supabase-js"
// import UserAccountMenu from "../UserAccountMenu"

// const versions = ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"]

// export function AppSidebar() {
//   const { collapsed, toggle } = useSidebar()
//   const [isMobile, setIsMobile] = useState(false)
//   const [initial, setInitial] = useState(true)
//   const [mobileOpen, setMobileOpen] = useState(false)
//   const router = useRouter()
//   const { getValue, setValue } = useGlobalContext()
//   const pathname = usePathname()

//   const [session, setsession] = useState<Session | null>()

//   // ⭐ NEW — Track opened folders
//   const [openFolders, setOpenFolders] = useState<number[]>([])

//   const filteredNavFolders = filterNavFolders(
//     NavFolders,
//     getValue("UserPermission") || []
//   )

//   useEffect(() => {
//     setValue("loading_s", false)
//   }, [pathname])

//   useEffect(() => {
//     const handleResize = () => setIsMobile(window.innerWidth <= 768)
//     handleResize()
//     window.addEventListener("resize", handleResize)
//     return () => window.removeEventListener("resize", handleResize)
//   }, [])

//   useEffect(() => {
//     const t = setTimeout(() => setInitial(false), 150)
//     return () => clearTimeout(t)
//   }, [])

//   const getUser = async () => {
//     const { data: { session } } = await db.auth.getSession()
//     setsession(session)
//   }

//   useEffect(() => {
//     getUser()
//   }, [])

//   // ⭐ Toggle folder open/close
//   const toggleFolder = (id: number) => {
//     setOpenFolders(prev =>
//       prev.includes(id)
//         ? prev.filter(x => x !== id)
//         : [...prev, id]
//     )
//   }

//   // ⭐ Navigate to child page
//   const goTo = (url: string) => {
//     setValue("loading_s", true)
//     router.push(url)
//   }

//   // =========================
//   // MOBILE
//   // =========================

//   if (isMobile) {
//     return (
//       <>
//         {!mobileOpen && (
//           <Button
//             variant="ghost"
//             onClick={() => setMobileOpen(true)}
//             className="fixed z-50 left-3 top-3 p-2"
//           >
//             <Menu className="size-5" />
//           </Button>
//         )}

//         {mobileOpen && (
//           <div className="fixed inset-0 z-40">
//             <div
//               className="absolute inset-0 bg-black/40"
//               onClick={() => setMobileOpen(false)}
//             />

//             <aside className="relative h-full w-72 bg-sidebar border-r shadow-lg p-3 overflow-y-auto">

//               <VersionSwitcher versions={versions} defaultVersion={versions[0]} />

//               <GlobalSearch collapsed={false} />

//               <div className="space-y-2 mt-4">

//                 {filteredNavFolders.map(folder => (
//                   <div key={folder.id}>

//                     <Button
//                       variant="ghost"
//                       className="w-full justify-between"
//                       // onClick={() => toggleFolder(folder.id)}
//                       onClick={() => {
//                         if (collapsed) {
//                           toggle()
//                         } else {
//                           toggleFolder(folder.id)
//                         }
//                       }}

//                     >
//                       <div className="flex items-center gap-2">
//                         <folder.icon className="size-5" />
//                         {folder.title}
//                       </div>

//                       <ChevronDown
//                         className={`size-4 transition ${openFolders.includes(folder.id) ? "rotate-180" : ""}`}
//                       />
//                     </Button>

//                     {openFolders.includes(folder.id) && (
//                       <div className="ml-6 mt-2 space-y-3">

//                         {folder.items?.map((group: any, gi: number) => (
//                           <div key={gi}>

//                             {/* Group label */}
//                             <div className="text-xs text-muted-foreground uppercase px-2">
//                               {group.group}
//                             </div>

//                             {/* Children */}
//                             {group.children
//                               .filter((child: any) => child.url && child.url !== "#")
//                               .map((child: any, ci: number) => (
//                                 <Button
//                                   key={ci}
//                                   variant="ghost"
//                                   className="w-full justify-start pl-4"
//                                   onClick={() => goTo(child.url)}
//                                 >
//                                   {child.title}
//                                 </Button>
//                               ))}
//                           </div>
//                         ))}

//                       </div>
//                     )}
//                   </div>
//                 ))}

//                 <div className="mt-6">
//                   {/* <ThemeSwitch collapsed={false} /> */}
//                   {/* <UserAccountMenu session={session} collapsed={false} /> */}
//                 </div>

//               </div>
//             </aside>
//           </div>
//         )}
//       </>
//     )
//   }

//   // =========================
//   // DESKTOP
//   // =========================

//   return (
//     <aside
//       className={`flex flex-col h-screen border-r bg-sidebar transition-all ${collapsed ? "w-16" : "w-72"
//         } ${initial ? "transition-none" : "duration-300"}`}
//     >
//       <div className="px-3 border-b pb-2">
//         <div className="flex items-center justify-between">
//           <VersionSwitcher versions={versions} defaultVersion={versions[0]} />
//           <Button variant="ghost" size="icon" onClick={toggle}>
//             <Menu className="size-5" />
//           </Button>
//         </div>
//       </div>

//       <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-2">

//         <GlobalSearch collapsed={collapsed} />

//         {filteredNavFolders.map(folder => (
//           <div key={folder.id}>

//             {/* Folder Header */}
//             {/* {collapsed ? (
//               <Tooltip>
//                 <TooltipTrigger asChild>
//                   <Button
//                     variant="ghost"
//                     onClick={() => toggleFolder(folder.id)}
//                     className="w-full justify-center"
//                   >
//                     <folder.icon className="size-5" />
//                   </Button>
//                 </TooltipTrigger>
//                 <TooltipContent>{folder.title}</TooltipContent>
//               </Tooltip>
//             ) : ( */}
//             {collapsed ? (
//               <Tooltip>
//                 <TooltipTrigger asChild>
//                   <Button
//                     variant="ghost"
//                     onClick={() => {
//                       if (collapsed) {
//                         toggle() // ⭐ expand sidebar instead of opening folder
//                       } else {
//                         toggleFolder(folder.id)
//                       }
//                     }}
//                     className="w-full justify-center"
//                   >
//                     <folder.icon className="size-5" />
//                   </Button>
//                 </TooltipTrigger>
//                 <TooltipContent>{folder.title}</TooltipContent>
//               </Tooltip>
//             ) : (

//               <Button
//                 variant="ghost"
//                 className="w-full justify-between"
//                 onClick={() => toggleFolder(folder.id)}
//               >
//                 <div className="flex items-center gap-2">
//                   <folder.icon className="size-5" />
//                   {folder.title}
//                 </div>

//                 <ChevronDown
//                   className={`size-4 transition ${openFolders.includes(folder.id) ? "rotate-180" : ""
//                     }`}
//                 />
//               </Button>
//             )}

//             {/* Folder Content */}
//             {!collapsed && openFolders.includes(folder.id) && (
//               <div className="ml-6 mt-2 space-y-3">

//                 {folder.items?.map((group: any, gi: number) => (
//                   <div key={gi}>

//                     {/* Group Label */}
//                     <div className="text-xs text-muted-foreground uppercase px-2">
//                       {group.group}
//                     </div>

//                     {/* Children */}
//                     {group.children.map((child: any, ci: number) => (
//                       <Button
//                         key={ci}
//                         variant="ghost"
//                         className="w-full justify-start pl-4"
//                         onClick={() => goTo(child.url)}
//                       >
//                         {child.title}
//                       </Button>
//                     ))}
//                   </div>
//                 ))}

//               </div>
//             )}
//           </div>
//         ))}

//         {getValue("loading_s") && (
//           <RefreshCw className="animate-spin size-4 fixed bottom-3 right-3" />
//         )}

//         {/* <div className="mt-6">
//           <ThemeSwitch collapsed={collapsed} />
//           <UserAccountMenu session={session} collapsed={false} />
//         </div> */}

//       </nav>
//     </aside>
//   )
// }

// // =======================
// // PERMISSION FILTER (unchanged)
// // =======================

// interface Permission {
//   group_name: string
//   title: string
//   is_visible: boolean
// }

// export function filterNavFolders(navFolders: any[], permissions: Permission[]) {
//   return navFolders
//     .map(folder => ({
//       ...folder,
//       items: folder.items
//         ?.map((group: any) => {
//           const filteredChildren = group.children?.filter((child: any) =>
//             permissions.some(
//               p =>
//                 p.is_visible &&
//                 p.group_name === group.group &&
//                 p.title === child.title
//             )
//           )

//           return filteredChildren?.length
//             ? { ...group, children: filteredChildren }
//             : null
//         })
//         .filter(Boolean),
//     }))
//     .filter(folder => folder.items?.length)
// }



/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Menu, RefreshCw, ChevronDown } from "lucide-react"
import { useSidebar } from "./SidebarProvider"
import { VersionSwitcher } from "@/components/ui/sidebar/version-switcher"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { usePathname, useRouter } from "next/navigation"
import { useGlobalContext } from "../context/GlobalContext"
import { NavFolders } from "../Defaults/DefaultValues"
import GlobalSearch from "@/components/ui/GlobalSearch"
import ThemeSwitch from "../ThemeSwitch"
import { db } from "../Supabase/supabaseClient"
import { Session } from "@supabase/supabase-js"
import UserAccountMenu from "../UserAccountMenu"

const versions = ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"]

export function AppSidebar() {
  const { collapsed, toggle } = useSidebar()
  const router = useRouter()
  const pathname = usePathname()
  const { getValue, setValue } = useGlobalContext()

  const [session, setSession] = useState<Session | null>()
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // ⭐ ENTERPRISE: persistent open folders
  const [openFolders, setOpenFolders] = useState<number[]>([])

  const filteredNavFolders = filterNavFolders(
    NavFolders,
    getValue("UserPermission") || []
  )

  // ===============================
  // INIT
  // ===============================

  useEffect(() => {
    const saved = localStorage.getItem("sidebar_open_folders")
    if (saved) setOpenFolders(JSON.parse(saved))
  }, [])

  useEffect(() => {
    localStorage.setItem("sidebar_open_folders", JSON.stringify(openFolders))
  }, [openFolders])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await db.auth.getSession()
      setSession(session)
    }
    getUser()
  }, [])

  // ===============================
  // AUTO-OPEN FOLDER BASED ON ROUTE
  // ===============================

  useEffect(() => {
    filteredNavFolders.forEach(folder => {
      folder.items?.forEach((group: any) => {
        group.children?.forEach((child: any) => {
          if (child.url && child.url !== "#" && pathname.startsWith(child.url)) {
            setOpenFolders(prev =>
              prev.includes(folder.id) ? prev : [...prev, folder.id]
            )
          }
        })
      })
    })
  }, [pathname])

  // ===============================
  // ACTIONS
  // ===============================

  const toggleFolder = (id: number) => {
    setOpenFolders(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    )
  }

  const goTo = (url: string) => {
    setValue("loading_s", true)
    router.push(url)
  }

  // ===============================
  // MOBILE VIEW
  // ===============================

  if (isMobile) {
    return (
      <>
        {!mobileOpen && (
          <Button
            variant="ghost"
            onClick={() => setMobileOpen(true)}
            className="fixed z-50 left-3 top-3 p-2"
          >
            <Menu className="size-5" />
          </Button>
        )}

        {mobileOpen && (
          <div className="fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />

            <aside className="relative h-full w-72 bg-sidebar  shadow-lg p-3 overflow-y-auto">

              {/* <VersionSwitcher versions={versions} defaultVersion={versions[0]} /> */}
              <GlobalSearch collapsed={false} />

              <div className="space-y-2 mt-4">

                {filteredNavFolders.map(folder => (
                  <div key={folder.id}>

                    <Button
                      variant="ghost"
                      className="w-full justify-between"
                      onClick={() => toggleFolder(folder.id)}
                    >
                      <div className="flex items-center gap-2">
                        <folder.icon className="size-5" />
                        {folder.title}
                      </div>

                      <ChevronDown
                        className={`size-4 transition ${openFolders.includes(folder.id) ? "rotate-180" : ""
                          }`}
                      />
                    </Button>

                    {openFolders.includes(folder.id) && (
                      <div className="ml-6 mt-2 space-y-3">

                        {folder.items?.map((group: any, gi: number) => (
                          <div key={gi}>

                            <div className="text-xs text-muted-foreground  px-2">
                              {group.group}
                            </div>

                            {group.children
                              .filter((c: any) => c.url && c.url !== "#")
                              .map((child: any, ci: number) => (
                                <Button
                                  key={ci}
                                  variant="ghost"
                                  className={`w-full justify-start pl-4 ${pathname.startsWith(child.url)
                                    ? "bg-accent"
                                    : ""
                                    }`}
                                  onClick={() => goTo(child.url)}
                                >
                                  {child.title}
                                </Button>
                              ))}
                          </div>
                        ))}

                      </div>
                    )}
                  </div>
                ))}

                {/* <ThemeSwitch collapsed={false} />
                <UserAccountMenu session={session} collapsed={false} /> */}

              </div>
            </aside>
          </div>
        )}
      </>
    )
  }

  // ===============================
  // DESKTOP VIEW
  // ===============================

  return (
    <aside
      className={`flex flex-col h-screen    bg-background transition-all ${collapsed ? "w-16" : "w-72"
        } duration-300`}
    >
      <div className="px-3   h-13.5  mt-1  z-50">
        <div className="flex items-center justify-between">
          {/* <VersionSwitcher versions={versions} defaultVersion={versions[0]} /> */}
          <Button className="m-3 text-foreground" variant="ghost" size="icon" onClick={toggle} >
            <Menu className="size-5" />
          </Button>
          {!collapsed &&
            <div className="mt-2">

              <GlobalSearch collapsed={collapsed} />
            </div>
          }
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto   mt-9 space-y-2  ">

        <div className="bg-white shadow rounded-r-2xl h-[calc(100vh-6rem)] ">
          <div className="text-sm px-3 text-muted-foreground py-4">{!collapsed && "Main"} </div>
          {filteredNavFolders.map(folder => (
            <div key={folder.id} className="text-foreground/60">

              {/* HEADER */}
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      onClick={() => toggle()} // ⭐ expand sidebar
                      className="w-full justify-center "
                    >
                      <folder.icon className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{folder.title}</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-between h-6"
                  onClick={() => toggleFolder(folder.id)}
                >
                  <div className="flex items-center gap-2 hover:bg-primary/5 hover:text-primary p-1 w-full">
                    <folder.icon className="size-5" />
                    {folder.title}
                  </div>

                  <ChevronDown
                    className={`size-4 transition ${openFolders.includes(folder.id) ? "rotate-180" : ""
                      }`}
                  />
                </Button>
              )}

              {/* CONTENT */}
              {!collapsed && openFolders.includes(folder.id) && (
                <div className="ml-6 mt- space-y-3">

                  {folder.items?.map((group: any, gi: number) => (
                    <div key={gi}>

                      {/* <div className="text-xs text-muted-foreground  px-2">
                        {group.group}
                      </div> */}

                      {group.children
                        .filter((c: any) => c.url && c.url !== "#")
                        .map((child: any, ci: number) => (
                          <Button
                            key={ci}
                            variant="ghost"
                            className={`h-7 w-full rounded-none justify-start hover:bg-primary/5 hover:text-primary   pl-4 ${pathname.startsWith(child.url)
                              ? "bg-accent"
                              : ""
                              }`}
                            onClick={() => goTo(child.url)}
                          >
                            {child.title}
                          </Button>
                        ))}
                    </div>
                  ))}

                </div>
              )}
            </div>
          ))}
        </div>

        {/* {getValue("loading_s") && (
          <RefreshCw className="animate-spin size-4 fixed bottom-3 right-3" />
        )} */}

        {/* <ThemeSwitch collapsed={collapsed} />
        <UserAccountMenu session={session} collapsed={false} /> */}

      </nav>
    </aside>
  )
}

// ===============================
// PERMISSION FILTER
// ===============================

interface Permission {
  group_name: string
  title: string
  is_visible: boolean
}

export function filterNavFolders(navFolders: any[], permissions: Permission[]) {
  return navFolders
    .map(folder => ({
      ...folder,
      items: folder.items
        ?.map((group: any) => {
          const filteredChildren = group.children?.filter((child: any) =>
            permissions.some(
              p =>
                p.is_visible &&
                p.group_name === group.group &&
                p.title === child.title
            )
          )

          return filteredChildren?.length
            ? { ...group, children: filteredChildren }
            : null
        })
        .filter(Boolean),
    }))
    .filter(folder => folder.items?.length)
}
