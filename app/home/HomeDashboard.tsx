'use client'

import CycleDashboard from '@/app/brd/dashboard/CycleDashboard'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import ModuleWorkspace from './ModuleWorkspace'

export default function HomeDashboard() {
  const { getValue } = useGlobalContext()
  const profile = getValue('UserInfoAuthSession')?.[0]

  if (!profile) {
    return <div role="status" className="p-4 text-sm text-muted-foreground">Loading workspace...</div>
  }

  return String(profile.fms_type ?? '').trim().toLowerCase() === 'broiler'
    ? <CycleDashboard key={String(profile.auth_id ?? profile.id)} />
    : <ModuleWorkspace />
}
