"use server"

import { db } from "@/lib/Supabase/supabaseClient"


export interface PermissionTemplate {
    id: number
    template_name: string
    remarks: string
    void: number
    created_at: string
}

export async function listPermissionTemplates() {

    const { data, error } = await db
        .from("permission_templates")
        .select("*")
        .order("template_name")

    console.log({ data, error })

    if (error) {
        console.error(error)
        return []
    }

    return data as PermissionTemplate[]
}

export async function voidPermissionTemplate(
    id: number,
    value: number
) {

    console.log({
        updating_id: id,
        updating_value: value,
    })

    const { data, error } = await db
        .from("permission_templates")
        .update({
            ["void"]: value
        })
        .eq("id", Number(id))
        .select()

    console.log({
        id,
        value,
        data,
        error,
    })

    if (error) {
        console.error(error)
        throw error
    }

    return data
}