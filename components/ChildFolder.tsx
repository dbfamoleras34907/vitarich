'use client'
import React, { useEffect } from 'react'
import Link from 'next/link' // 
import { useRouter } from 'next/navigation' // [cite: 2]
import { ExternalLink } from 'lucide-react'
import { NavFolders } from '@/lib/Defaults/DefaultValues' // [cite: 1]
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { filterNavFolders } from '@/lib/sidebar/AppSidebar'

interface ChildFolderProps {
  id: number;
}

export default function ChildFolder({ id }: ChildFolderProps) {
  const router = useRouter()
  const { getValue } = useGlobalContext()

  const filteredNavFolders = filterNavFolders(
    NavFolders,
    getValue("UserPermission") || []
  )

  const filteredData = filteredNavFolders.find(f => f.id === id)

  useEffect(() => {
    if (!filteredData) return

    filteredData.items?.forEach((group: any) => {
      group.children?.forEach((child: any) => {
        if (child.url && child.url !== "#") {
          router.prefetch(child.url)
        }
      })
    })
  }, [router, filteredData])

  if (!filteredData) return <div className="p-4">No permissions for this section.</div>

  return (
    <div className="mx-4 grid grid-cols-1 gap-8">
      <div className=''>
        {/* <div className="font-bold text-lg mb-2">Masters and Reports</div> */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredData.items.map((group: any, i: number) => (
            <div key={i} className="w-full rounded-md border bg-card p-4 shadow-[var(--starbucks-card-shadow)]">
              <div className="mb-3 border-b pb-2 font-semibold text-[var(--starbucks-green)]">
                {group.group}
              </div>
              <div className="grid gap-2">
                {group.children.map((child: any, ii: number) => (
                  <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent" key={ii}>
                    {/* Use Link to prevent page flicker [cite: 13, 14] */}
                    <Link
                      href={child.url}
                      className={`transition-colors hover:text-primary ${child.url === '#' && "line-through"} `}
                    >
                      {child.title}
                      {child.url == "#"}
                    </Link>

                    {child.url !== "#" && (
                      <a
                        href={child.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <ExternalLink className="size-3 text-muted-foreground" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
