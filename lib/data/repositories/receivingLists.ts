import { db } from '@/lib/Supabase/supabaseClient'
import type { RowDataKey } from '@/lib/Defaults/DefaultTypes'
import type { farm_dr_unres, ReceivingListRow2 } from '@/lib/types'

export async function getReceivingList(farmId?: number): Promise<ReceivingListRow2[]> {
  if (farmId !== undefined && (!Number.isInteger(farmId) || farmId <= 0)) return []
  let query = db.from('vwdmf_getreceived').select('*')
  // The existing view exposes the receiving destination farm ID under this alias.
  if (farmId !== undefined) query = query.eq('deliverted_to_id', farmId)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data as ReceivingListRow2[]
}

export async function vwdmf_get_farmdr_unres(): Promise<farm_dr_unres[]> {
  const { data, error } = await db.from('vwdmf_get_farmdr_unres').select('*')
  if (error) throw error
  return data as farm_dr_unres[]
}

export async function getPendingReceivingDispatches(farmRef: string | null): Promise<RowDataKey[]> {
  if (!farmRef?.trim()) return []
  const res = await fetch('/api/dispatch')
  if (!res.ok) throw new Error('Unable to load dispatch data.')
  const [unresolvedJson, dispatchJson] = await Promise.all([
    vwdmf_get_farmdr_unres(), res.json(),
  ])
  // normalize helper (removes spacing differences + case issues)
  const normalize = (v: unknown) =>
      String(v ?? '')
          .replace(/\s+/g, '')
          .toUpperCase()

  // build lookup set of unresolved DR numbers
  const unresolvedDRSet = new Set(
      (unresolvedJson || []).map(x => normalize(x.dr_num))
  )

  const rows: RowDataKey[] = Array.isArray(dispatchJson)
      ? dispatchJson
      : Array.isArray(dispatchJson.data)
          ? dispatchJson.data
          : []

  const filtered = rows
      .map((item): RowDataKey & { dispatchbody: unknown[]; modified_dispatchbody: unknown[] } => {
          let parsedDispatchBody: unknown[] = []
          let parsedModifiedDispatchBody: unknown[] = []

          try {
              if (typeof item.dispatchbody === "string") {
                  parsedDispatchBody = JSON.parse(item.dispatchbody)
              } else if (Array.isArray(item.dispatchbody)) {
                  parsedDispatchBody = item.dispatchbody
              }
          } catch {
              parsedDispatchBody = []
          }

          try {
              if (typeof item.modified_dispatchbody === "string") {
                  parsedModifiedDispatchBody = JSON.parse(item.modified_dispatchbody)
              } else if (Array.isArray(item.modified_dispatchbody)) {
                  parsedModifiedDispatchBody = item.modified_dispatchbody
              }
          } catch {
              parsedModifiedDispatchBody = []
          }

          return {
              ...item,
              dispatchbody: parsedDispatchBody,
              modified_dispatchbody: parsedModifiedDispatchBody
          }
      })
      .filter((item) => {
          // remove rows without dispatch body
          if (!Array.isArray(item.dispatchbody) || item.dispatchbody.length === 0) return false

          // support both dr and dr_num fields
          const drValue = item.dr ?? item.dr_num

          // exclude unresolved DRs
          if (unresolvedDRSet.has(normalize(drValue))) {
              return false
          }

          return String(item.destinationid) === farmRef

      })


  return filtered
}
