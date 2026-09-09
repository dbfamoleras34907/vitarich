// app/a_dean/warehouse/api.ts
import { db } from "@/lib/Supabase/supabaseClient"
import { WarehouseData } from "@/lib/types"

type SupabaseErrorLike = {
    message?: string
    details?: string
    hint?: string
    code?: string
}

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error) return error.message

    if (error && typeof error === 'object') {
        const dbError = error as SupabaseErrorLike
        const parts = [dbError.message, dbError.details, dbError.hint]
            .map(part => String(part ?? '').trim())
            .filter(Boolean)

        if (parts.length > 0) {
            return dbError.code ? `${parts.join(' ')} (${dbError.code})` : parts.join(' ')
        }
    }

    return fallback
}

export type WarehouseListResult = {
    rows: WarehouseData[]
    totalCount: number
}

export type WarehouseBuildingOption = Pick<
    WarehouseData,
    'id' | 'whse_code' | 'whse_name' | 'farm_id' | 'fms_type' | 'capacity'
>

export async function getWarehousePens(buildingId: string | number) {
    try {
        const { data, error } = await db
            .from('i_warehouse')
            .select('*')
            .eq('warehouse_type', 'Pen')
            .eq('father_id', buildingId)
            .order('whse_code')

        if (error) throw error
        return { success: true, data: (data ?? []) as WarehouseData[] }
    } catch (error: unknown) {
        const message = getErrorMessage(error, 'Unable to fetch building pens')
        console.error('Error fetching building pens:', message)
        return { success: false, error: message }
    }
}

export async function getWarehouseBuildings(excludeId?: string | number) {
    try {
        let query = db
            .from('i_warehouse')
            .select('id, whse_code, whse_name, farm_id, fms_type, capacity')
            .eq('warehouse_type', 'Building')
            .order('whse_code')

        if (excludeId) query = query.neq('id', excludeId)

        const { data, error } = await query
        if (error) throw error

        return { success: true, data: (data ?? []) as WarehouseBuildingOption[] }
    } catch (error: unknown) {
        const message = getErrorMessage(error, 'Unable to fetch buildings')
        console.error('Error fetching buildings:', message)
        return { success: false, error: message }
    }
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
        const message = getErrorMessage(error, 'Unable to fetch warehouse');
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
        const message = getErrorMessage(error, 'Unable to fetch warehouses')
        console.error('Error fetching warehouse page:', message)
        return { success: false, error: message }
    }
}

export async function updateWarehouse(id: string | number, data: WarehouseData) {
    try {
        const { data: existingWarehouse, error: existingError } = await db
            .from('i_warehouse')
            .select('warehouse_type, father_id')
            .eq('id', id)
            .single()

        if (existingError) throw existingError

        const warehouseType = String(data.warehouse_type ?? '').trim()
        const capacity = data.capacity == null ? null : Number(data.capacity)

        if (warehouseType !== String(existingWarehouse.warehouse_type ?? '').trim()) {
            return { success: false, error: 'Warehouse type cannot be changed after creation.' }
        }

        if ((warehouseType === 'Building' || warehouseType === 'Pen') && capacity != null && (!Number.isFinite(capacity) || capacity < 0)) {
            return { success: false, error: 'Capacity must be a valid non-negative number.' }
        }

        if (warehouseType === 'Building') {
            const { data: pens, error: pensError } = await db
                .from('i_warehouse')
                .select('capacity')
                .eq('warehouse_type', 'Pen')
                .eq('father_id', id)

            if (pensError) throw pensError

            if ((pens ?? []).length > 0) {
                const penCapacities = (pens ?? []).map(pen => pen.capacity == null ? null : Number(pen.capacity))
                if (capacity == null || penCapacities.some(value => value == null || !Number.isFinite(value) || value < 0)) {
                    return { success: false, error: 'The building and all of its pens must have valid capacities.' }
                }

                const penTotal = penCapacities.reduce<number>((total, value) => total + (value ?? 0), 0)
                if (Math.abs(penTotal - capacity) > 0.000001) {
                    return { success: false, error: `Pen capacity total (${penTotal}) must equal building capacity (${capacity}).` }
                }
            }
        }

        if (warehouseType === 'Pen') {
            if (!data.father_id) {
                return { success: false, error: 'A Pen must have a father Building.' }
            }

            const [{ data: father, error: fatherError }, { data: siblingPens, error: siblingsError }] = await Promise.all([
                db.from('i_warehouse').select('id, warehouse_type, capacity').eq('id', data.father_id).single(),
                db.from('i_warehouse').select('id, capacity').eq('warehouse_type', 'Pen').eq('father_id', data.father_id),
            ])

            if (fatherError) throw fatherError
            if (siblingsError) throw siblingsError
            if (father?.warehouse_type !== 'Building') {
                return { success: false, error: 'The selected father must be a Building.' }
            }

            const fatherCapacity = father.capacity == null ? null : Number(father.capacity)
            const currentPenIsInSelectedBuilding = (siblingPens ?? []).some(pen => String(pen.id) === String(id))
            const penCapacities = (siblingPens ?? []).map(pen =>
                String(pen.id) === String(id) ? capacity : (pen.capacity == null ? null : Number(pen.capacity))
            )
            if (!currentPenIsInSelectedBuilding) penCapacities.push(capacity)

            if (capacity == null || fatherCapacity == null || penCapacities.some(value => value == null || !Number.isFinite(value) || value < 0)) {
                return { success: false, error: 'The building and all of its pens must have valid capacities.' }
            }

            const penTotal = penCapacities.reduce<number>((total, value) => total + (value ?? 0), 0)
            if (Math.abs(penTotal - fatherCapacity) > 0.000001) {
                return { success: false, error: `Pen capacity total (${penTotal}) must equal building capacity (${fatherCapacity}).` }
            }

            if (existingWarehouse.father_id && String(existingWarehouse.father_id) !== String(data.father_id)) {
                const [{ data: oldFather, error: oldFatherError }, { data: oldSiblings, error: oldSiblingsError }] = await Promise.all([
                    db.from('i_warehouse').select('capacity').eq('id', existingWarehouse.father_id).single(),
                    db.from('i_warehouse').select('id, capacity').eq('warehouse_type', 'Pen').eq('father_id', existingWarehouse.father_id).neq('id', id),
                ])

                if (oldFatherError) throw oldFatherError
                if (oldSiblingsError) throw oldSiblingsError

                if ((oldSiblings ?? []).length > 0) {
                    const oldFatherCapacity = oldFather.capacity == null ? null : Number(oldFather.capacity)
                    const oldPenCapacities = (oldSiblings ?? []).map(pen => pen.capacity == null ? null : Number(pen.capacity))

                    if (oldFatherCapacity == null || oldPenCapacities.some(value => value == null || !Number.isFinite(value) || value < 0)) {
                        return { success: false, error: 'The previous building and its remaining pens must have valid capacities.' }
                    }

                    const oldPenTotal = oldPenCapacities.reduce<number>((total, value) => total + (value ?? 0), 0)
                    if (Math.abs(oldPenTotal - oldFatherCapacity) > 0.000001) {
                        return { success: false, error: `The previous building capacity (${oldFatherCapacity}) must equal its remaining pen capacity total (${oldPenTotal}).` }
                    }
                }
            }
        }

        const { error, count } = await db
            .from('i_warehouse')
            .update(data, { count: 'exact' })
            .eq('id', id)

        if (error) throw error

        if (count === 0) {
            return {
                success: false,
                error: 'Warehouse was not updated. It may no longer exist, or your account may not have permission to update it.',
            }
        }

        return { success: true, data: { ...data, id: Number(id) } as WarehouseData }
    } catch (error: unknown) {
        const message = getErrorMessage(error, 'Unable to update warehouse')
        console.error('Error updating warehouse:', message)
        return { success: false, error: message }
    }
}
