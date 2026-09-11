import CycleDashboard from './CycleDashboard'
import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import { decryptData } from '@/app/utils/supabase/url-encryption'

export default async function Page({ searchParams }: { searchParams: Promise<{ cycle?: string | string[] }> }) {
  const { cycle } = await searchParams
  const selection = typeof cycle === 'string' ? decryptData(cycle) : null
  const farmId = Number(selection?.farmId)
  const cycleId = Number(selection?.cycleId)
  const cycleKind = selection?.cycleKind ?? 'farm'
  if (cycle !== undefined && (!Number.isSafeInteger(farmId) || farmId <= 0 || !Number.isSafeInteger(cycleId) || cycleId <= 0 || (cycleKind !== 'farm' && cycleKind !== 'building'))) {
    return <div className="p-4 text-sm" role="alert">The cycle reference is invalid.</div>
  }
  return <NavigationBar currentLabel="" fatherLabel=""><CycleDashboard key={typeof cycle === 'string' ? cycle : 'default'} initialFarmId={cycle ? farmId : undefined} initialCycleId={cycle ? cycleId : undefined} initialCycleKind={cycleKind} /></NavigationBar>
}
