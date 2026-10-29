'use client'

import CycleDashboard from '@/app/brd/dashboard/CycleDashboard'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import ModuleWorkspace from './ModuleWorkspace'
import { normalizeUserFmsTypes } from '@/lib/auth/fmsAccess'

export default function HomeDashboard() {
  const { getValue } = useGlobalContext()
  const profile = getValue('UserInfoAuthSession')?.[0]

  if (!profile) {
    return <div role="status" className="p-4 text-sm text-muted-foreground">Loading workspace...</div>
  }

  const fmsTypes = normalizeUserFmsTypes(profile.fms_types, profile.fms_type)

  return fmsTypes.length === 1 && fmsTypes[0] === 'Broiler'
    ? <CycleDashboard key={String(profile.auth_id ?? profile.id)} />
    : <ModuleWorkspace />
}
