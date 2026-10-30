import { db } from '@/lib/Supabase/supabaseClient'
import type { WarehouseData } from '@/lib/types'

const WAREHOUSE_FETCH_PAGE_SIZE = 500

type WarehouseRowOptions = {
  activeOnly?: boolean
}

export async function getWarehouseRows(
  options: WarehouseRowOptions = {},
): Promise<WarehouseData[]> {
  const warehouses: WarehouseData[] = []

  for (let from = 0; ; from += WAREHOUSE_FETCH_PAGE_SIZE) {
    let query = db
      .from('i_warehouse')
      .select('*')
      .order('id')
      .range(from, from + WAREHOUSE_FETCH_PAGE_SIZE - 1)

    if (options.activeOnly) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw error

    const page = (data ?? []) as WarehouseData[]
    warehouses.push(...page)

    if (page.length < WAREHOUSE_FETCH_PAGE_SIZE) break
  }

  return warehouses
}
