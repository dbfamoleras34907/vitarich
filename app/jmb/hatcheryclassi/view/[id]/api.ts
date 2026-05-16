import { db } from "@/lib/Supabase/supabaseClient"
import { HatchClassificationRow } from "../../new/api"

export type HatchClassification = {
    created_at: string
    br_no: string | null
    good_egg: number | null
    trans_crack: number | null
    hatc_crack: number | null
    trans_condemn: number | null
    hatc_condemn: number | null
    thin_shell: number | null
    pee_wee: number | null
    small: number | null
    jumbo: number | null
    d_yolk: number | null
    ttl_count: number | null
    is_active: boolean | null
    classi_ref_no: string | null
    date_classify: string | null
    misshapen: number | null
    leakers: number | null
    dirties: number | null
    hairline: number | null
    farm_id: number | null
    farm_code: string | null
}

export type HatchClassificationInsert = {
    created_at?: string
    br_no: string | null
    good_egg: number | null
    trans_crack: number | null
    hatc_crack: number | null
    trans_condemn: number | null
    hatc_condemn: number | null
    thin_shell: number | null
    pee_wee: number | null
    small: number | null
    jumbo: number | null
    d_yolk: number | null
    ttl_count: number | null
    is_active: boolean | null
    classi_ref_no: string | null
    date_classify: string | null
    misshapen: number | null
    leakers: number | null
    dirties: number | null
    hairline: number | null
    farm_id: number | null
    farm_code: string | null
}

 

export async function getHatchClassificationById(id: number) {
    const { data, error } = await db
        .from('hatch_classification')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw new Error(error.message)

    return data as HatchClassificationRow
}