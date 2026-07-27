// app/a_dean/inventory/api.ts
import { db } from "@/lib/Supabase/supabaseClient"

export interface InventoryPostingData {
  id: number
  source_doc_type: string
  source_docentry: number
  item_code: string
  transfer_type: string
  warehouse_code: string
  bin_code: string
  qty: number
  created_at: string
  created_by: string
  ref: string
  ref2: string
  ref_type: string
  ref_type2: string
  batch_number: string | null
}

interface Filters {
  from?: string
  to?: string
  farm_id?: string
}

export async function getInventoryPostings(filters?: Filters) {
  try {
    let warehouseCodes: string[] | null = null

    if (filters?.farm_id) {
      const { data: warehouses, error: warehouseError } = await db
        .from('i_warehouse')
        .select('whse_code')
        .eq('farm_id', filters.farm_id)

      if (warehouseError) throw warehouseError

      warehouseCodes = (warehouses ?? [])
        .map(warehouse => String(warehouse.whse_code ?? '').trim())
        .filter(Boolean)

      if (warehouseCodes.length === 0) {
        return { success: true, data: [] as InventoryPostingData[] }
      }
    }

    let query = db
      .from('inventory_postings')
      .select('*')
      .order('created_at', { ascending: false })
      .order('transfer_type', { ascending: true })

    if (filters?.from) {
      query = query.gte('created_at', filters.from)
    }

    if (filters?.to) {
      const dayAfter = new Date(`${filters.to}T00:00:00`)
      dayAfter.setDate(dayAfter.getDate() + 1)
      query = query.lt('created_at', dayAfter.toISOString())
    }

    if (warehouseCodes) {
      query = query.in('warehouse_code', warehouseCodes)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, data: data as InventoryPostingData[] }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to fetch inventory postings'
    console.error('Error fetching inventory postings:', message)
    return { success: false, error: message }
  }
}
