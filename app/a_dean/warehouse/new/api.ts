import { db } from "@/lib/Supabase/supabaseClient"
import { WarehouseData } from "@/lib/types"

const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : 'Unexpected warehouse request error'

export type WarehouseFarmOption = {
    id: number
    code: string
    name: string | null
    farm_type: string | null
}

export async function createWarehouse(data: WarehouseData) {
    try {
        const { data: result, error } = await db
            .from('i_warehouse')
            .insert(data)
            .select()
        console.log({ result, error, data })
        if (error) throw error
        return { success: true, data: result }
    } catch (error: unknown) {
        const message = getErrorMessage(error)
        console.error('Error inserting warehouse:', message)
        return { success: false, error: message }
    }
}

export async function getWarehouseFarmOptions() {
    try {
        const { data, error } = await db
            .from('farms')
            .select('id, code, name, farm_type')
            .eq('void', 1)
            .order('code')

        if (error) throw error

        return { success: true, data: (data ?? []) as WarehouseFarmOption[] }
    } catch (error: unknown) {
        const message = getErrorMessage(error)
        console.error('Error fetching farms:', message)
        return { success: false, error: message }
    }
}
