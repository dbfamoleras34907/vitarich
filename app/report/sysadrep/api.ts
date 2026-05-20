import { db } from "@/lib/Supabase/supabaseClient"

export const loadData = async (dateFrom?: string, dateTo?: string, region?: string, archipelago?: string) => {
    let query = db.from("disposal").select("*")

    if (dateFrom) {
        query = query.gte("date", dateFrom)
    }
    if (dateTo) {
        query = query.lte("date", dateTo)
    }
    if (region) {
        query = query.eq("region", region)
    }
    if (archipelago) {
        query = query.eq("archipelago", archipelago)
    }

    const { data, error } = await query

    return { data, error }

}




// lib/api/traceability.ts

type TraceabilityParams = {
    dateFrom?: string
    dateTo?: string
    region?: string
    archipelago?: string
}

export async function getInventoryTraceabilitySummary({
    dateFrom,
    dateTo,
    region,
    archipelago,
}: TraceabilityParams) {
    const { data, error } =
        await db.rpc(
            'get_traceability_dashboard',
            {
                p_date_from: dateFrom
                    ? new Date(dateFrom)
                        .toISOString()
                        .split('T')[0]
                    : null,

                p_date_to: dateTo
                    ? new Date(dateTo)
                        .toISOString()
                        .split('T')[0]
                    : null,

                p_region:
                    region?.trim() || null,

                p_archipelago:
                    archipelago?.trim() ||
                    null,
            }
        )

    if (error) {
        console.error(
            'Traceability Dashboard Error:',
            error
        )
    }
    return data ?? []
}