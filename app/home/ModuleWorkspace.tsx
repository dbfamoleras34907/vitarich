'use client'

import Link from 'next/link'
import { Boxes } from 'lucide-react'

import { NavFolders } from '@/lib/Defaults/DefaultValues'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { filterNavFolders } from '@/lib/sidebar/AppSidebar'
import { getModuleIcon } from '@/lib/sidebar/moduleIcons'

type Permission = {
  group_name: string
  title: string
  is_visible: boolean
}

function parsePermissions(value: unknown): Permission[] | null {
  if (Array.isArray(value)) return value as Permission[]
  if (typeof value !== 'string') return null

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed as Permission[] : []
  } catch {
    return []
  }
}

export default function ModuleWorkspace() {
  const { getValue, setValue } = useGlobalContext()
  const profile = getValue('UserInfoAuthSession')?.[0]
  const permissions = parsePermissions(getValue('UserPermission'))

  if (!profile || permissions === null) {
    return (
      <main className="mx-auto w-full max-w-[1500px] px-2 py-6 sm:px-4 lg:px-6">
        <div className="animate-pulse space-y-6" role="status" aria-label="Loading modules">
          <div className="space-y-2">
            <div className="h-7 w-48 rounded bg-muted" />
            <div className="h-4 w-80 max-w-full rounded bg-muted" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map(item => <div key={item} className="h-52 rounded-xl border bg-muted/35" />)}
          </div>
        </div>
      </main>
    )
  }

  const folders = filterNavFolders(NavFolders, permissions, profile)
    .map(folder => ({
      ...folder,
      items: folder.items
        .map(group => ({
          ...group,
          children: group.children.filter(child =>
            child.url &&
            child.url !== '#' &&
            child.url !== '/home' &&
            !child.hideFromNavigation,
          ),
        }))
        .filter(group => group.children.length > 0),
    }))
    .filter(folder => folder.items.length > 0)

  const fmsType = String(profile.fms_type ?? '').trim()
  const moduleCount = folders.reduce(
    (total, folder) => total + folder.items.reduce((folderTotal, group) => folderTotal + group.children.length, 0),
    0,
  )

  return (
    <main className="mx-auto w-full max-w-[1500px] px-2 py-6 sm:px-4 lg:px-6">
      <header className="mb-6 flex flex-col gap-2 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {fmsType ? `${fmsType} FMS` : 'Vita FMS'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Open any module assigned to your account.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {moduleCount} {moduleCount === 1 ? 'module' : 'modules'} available
        </p>
      </header>

      {folders.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Boxes className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-medium">No modules assigned</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Your account does not have any modules assigned yet. Please contact your administrator to add modules to your account.
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {folders.map(folder => {
            const FolderIcon = folder.icon
            return (
              <section key={folder.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderIcon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-semibold leading-tight">{folder.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {folder.items.reduce((count, group) => count + group.children.length, 0)} available
                    </p>
                  </div>
                </div>

                <div className="space-y-5 p-3">
                  {folder.items.map(group => (
                    <div key={`${folder.id}-${group.group}`}>
                      {folder.items.length > 1 && (
                        <h3 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {group.group}
                        </h3>
                      )}
                      <div className="grid gap-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                        {group.children.map(child => {
                          const ModuleIcon = getModuleIcon(child.title, child.type)
                          return (
                            <Link
                              key={`${folder.id}-${group.group}-${child.id}`}
                              href={child.url}
                              onClick={() => setValue('loading_s', true)}
                              className="group flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <ModuleIcon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
                              <span className="min-w-0 leading-5">{child.title}</span>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}
