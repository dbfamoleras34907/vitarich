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
}

interface Filters {
  from?: string
  to?: string
  warehouse_code?: string
  item_code?: string
}

export async function getInventoryPostings(filters?: Filters) {
  try {
    let query = db
      .from('inventory_postings')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.from) {
      query = query.gte('created_at', filters.from)
    }

    if (filters?.to) {
      query = query.lte('created_at', filters.to)
    }

    if (filters?.warehouse_code) {
      query = query.eq('warehouse_code', filters.warehouse_code)
    }

    if (filters?.item_code) {
      query = query.ilike('item_code', `%${filters.item_code}%`)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, data: data as InventoryPostingData[] }

  } catch (error: any) {
    console.error('Error fetching inventory postings:', error.message)
    return { success: false, error: error.message }
  }
}
