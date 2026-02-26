import { db } from "@/lib/Supabase/supabaseClient"
import { WarehouseData } from "@/lib/types"

export async function createWarehouse(data: WarehouseData) {
    try {
        const { data: result, error } = await db
            .from('i_warehouse')
            .insert(data)
            .select()
        console.log({ result, error, data })
        if (error) throw error
        return { success: true, data: result }
    } catch (error: any) {
        console.error('Error inserting warehouse:', error.message)
        return { success: false, error: error.message }
    }
}

