import { db } from "@/lib/Supabase/supabaseClient"
import { activeApprovedFarmsQuery } from "@/lib/data/repositories/farms"
import { WarehouseData } from "@/lib/types"

type SupabaseErrorLike = {
    message?: string
    details?: string
    hint?: string
    code?: string
}

const getErrorMessage = (error: unknown) => {
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

    return 'Unexpected warehouse request error'
}

export type WarehouseFarmOption = {
    id: number
    code: string
    name: string | null
    farm_type: string | null
}

export async function createWarehouse(data: WarehouseData) {
    try {
        const warehouseType = String(data.warehouse_type ?? '').trim()
        const capacity = data.capacity == null ? null : Number(data.capacity)

        if ((warehouseType === 'Building' || warehouseType === 'Pen') && capacity != null && (!Number.isFinite(capacity) || capacity < 0)) {
            return { success: false, error: 'Capacity must be a valid non-negative number.' }
        }

        if (warehouseType === 'Pen') {
            if (!data.father_id) {
                return { success: false, error: 'A Pen must have a father Building.' }
            }

            const [{ data: father, error: fatherError }, { data: existingPens, error: pensError }] = await Promise.all([
                db.from('i_warehouse').select('warehouse_type, capacity').eq('id', data.father_id).single(),
                db.from('i_warehouse').select('capacity').eq('warehouse_type', 'Pen').eq('father_id', data.father_id),
            ])

            if (fatherError) throw fatherError
            if (pensError) throw pensError
            if (father?.warehouse_type !== 'Building') {
                return { success: false, error: 'The selected father must be a Building.' }
            }

            const fatherCapacity = father.capacity == null ? null : Number(father.capacity)
            const penCapacities = [...(existingPens ?? []).map(pen => pen.capacity == null ? null : Number(pen.capacity)), capacity]

            if (capacity == null || fatherCapacity == null || penCapacities.some(value => value == null || !Number.isFinite(value) || value < 0)) {
                return { success: false, error: 'The Building and all of its Pens must have valid capacities.' }
            }

            const penTotal = penCapacities.reduce<number>((total, value) => total + (value ?? 0), 0)
            if (Math.abs(penTotal - fatherCapacity) > 0.000001) {
                return { success: false, error: `Pen capacity total (${penTotal}) must equal Building capacity (${fatherCapacity}).` }
            }
        }

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
        const farmQuery = db.from('farms').select('id, code, name, farm_type')
        const { data, error } = await activeApprovedFarmsQuery(farmQuery)
            .order('code')

        if (error) throw error

        return { success: true, data: (data ?? []) as WarehouseFarmOption[] }
    } catch (error: unknown) {
        const message = getErrorMessage(error)
        console.error('Error fetching farms:', message)
        return { success: false, error: message }
    }
}
