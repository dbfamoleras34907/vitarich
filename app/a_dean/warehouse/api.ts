// app/a_dean/warehouse/api.ts
import { db } from "@/lib/Supabase/supabaseClient"
import { WarehouseData } from "@/lib/types"

export type WarehouseListResult = {
    rows: WarehouseData[]
    totalCount: number
}

export async function getWarehouses(id?: string) {
    try {
        const query = db.from('i_warehouse').select('*');

        if (id) {
            const { data, error } = await query
                .eq('id', id)
                .single();

            if (error) throw error;
            return { success: true, data: data as WarehouseData };
        }
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data: data as WarehouseData[] };

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unable to fetch warehouse';
        console.error('Error fetching warehouse:', message);
        return { success: false, error: message };
    }
}

export async function getWarehousePage(page = 1, limit = 10) {
    try {
        const safePage = Math.max(1, page)
        const safeLimit = Math.max(1, limit)
        const from = (safePage - 1) * safeLimit
        const to = from + safeLimit - 1

        const { data, error, count } = await db
            .from('i_warehouse')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to)

        if (error) throw error

        return {
            success: true,
            data: {
                rows: (data ?? []) as WarehouseData[],
                totalCount: count ?? 0,
            } satisfies WarehouseListResult,
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unable to fetch warehouses'
        console.error('Error fetching warehouse page:', message)
        return { success: false, error: message }
    }
}

export async function updateWarehouse(id: string | number, data: WarehouseData) {
    try {
        const { data: result, error } = await db
            .from('i_warehouse')
            .update(data)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error

        return { success: true, data: result as WarehouseData }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unable to update warehouse'
        console.error('Error updating warehouse:', message)
        return { success: false, error: message }
    }
}
