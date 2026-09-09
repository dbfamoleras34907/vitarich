'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

import { encryptData } from '@/app/utils/supabase/url-encryption'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import UserFarmSearchCombobox, {
  getAllowedUserFarms,
  type UserFarm,
} from '@/components/ui/UserFarmSearchCombobox'
import { usePermission } from '@/hooks/usePermission'
import Breadcrumb from '@/lib/Breadcrumb'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { getFarmCycleMasterRows, type FarmCycleMasterRow } from './api'

const formatDate = (value: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Unable to load Cycle Master.')
  }
  return 'Unable to load Cycle Master.'
}

export default function CycleMasterLayout() {
  const router = useRouter()
  const { getValue } = useGlobalContext()
  const viewBlocked = usePermission('/brd/cycle-master/view')
  const session = getValue('UserInfoAuthSession')
  const rawFarmDB = getValue('getFarmDB')
  const rawUserFarms = session?.[0]?.users_farms
  const [selectedFarmId, setSelectedFarmId] = useState('')
  const [rows, setRows] = useState<FarmCycleMasterRow[]>([])
  const [loading, setLoading] = useState(false)

  const allowedFarms = useMemo(
    () => getAllowedUserFarms((rawFarmDB || []) as UserFarm[], (rawUserFarms || []) as unknown[]),
    [rawFarmDB, rawUserFarms],
  )
  const singleFarm = allowedFarms.length === 1 ? allowedFarms[0] : null
  const activeFarmId = selectedFarmId || (singleFarm ? String(singleFarm.id) : '')

  const loadRows = useCallback(async () => {
    const farmId = Number(activeFarmId)
    if (!farmId) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      setRows(await getFarmCycleMasterRows(farmId))
    } catch (error) {
      setRows([])
      toast.error(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [activeFarmId])

  useEffect(() => { void loadRows() }, [loadRows])

  if (viewBlocked) {
    return (
      <main className="p-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="size-4" />
            You do not have permission to view Cycle Master.
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-3 sm:p-4">
      <Breadcrumb FirstPreviewsPageName="Broiler" CurrentPageName="Cycle Master" />

      <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Cycle Master</h1>
            <p className="mt-1 text-sm text-stone-500">Farm cycles are created automatically from DOC Placement and close after all participating buildings complete Clean up.</p>
          </div>
          <Button type="button" variant="outline" disabled={loading || !activeFarmId} onClick={() => void loadRows()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </Button>
        </div>

        <div className="border-b border-stone-200 p-4">
          <div className="max-w-md">
            <UserFarmSearchCombobox label="Farm" required value={activeFarmId} onValueChange={farmId => setSelectedFarmId(farmId)} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cycle Count</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Participating Buildings</TableHead>
                <TableHead className="text-right">Open Buildings</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Closed</TableHead>
                <TableHead className="w-10"><span className="sr-only">Open report</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="h-28 text-center text-stone-500"><Loader2 className="mx-auto size-5 animate-spin" /></TableCell></TableRow>
              ) : !activeFarmId ? (
                <TableRow><TableCell colSpan={7} className="h-28 text-center text-stone-500">Select a farm to view its cycles.</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-28 text-center text-stone-500">No farm cycles found.</TableCell></TableRow>
              ) : rows.map(row => (
                <TableRow
                  key={row.id}
                  role="link"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => router.push(`/brd/cycle-master/${encryptData({ cycleId: row.id })}`)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      router.push(`/brd/cycle-master/${encryptData({ cycleId: row.id })}`)
                    }
                  }}
                >
                  <TableCell className="font-medium">{row.cycleNumber}</TableCell>
                  <TableCell><Badge variant={row.status === 'Saved' ? 'default' : 'secondary'}>{row.status === 'Saved' ? 'Active' : row.status}</Badge></TableCell>
                  <TableCell className="text-right">{row.participatingBuildings}</TableCell>
                  <TableCell className="text-right">{row.openBuildings}</TableCell>
                  <TableCell>{formatDate(row.createdAt)}</TableCell>
                  <TableCell>{formatDate(row.closedAt)}</TableCell>
                  <TableCell><ChevronRight className="size-4 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  )
}
