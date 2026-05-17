"use server"

import { db } from "@/lib/Supabase/supabaseClient"


export async function getPermissionTemplateById(
    id: number
) {

    const { data, error } = await db
        .from("permission_templates")
        .select("*")
        .eq("id", id)
        .single()

    console.log({ data, error })

    if (error) {
        console.error(error)
        return null
    }

    return data
}

export async function getPermissionTemplateItems(
    template_id: number
) {

    const { data, error } = await db
        .from("permission_template_items")
        .select("*")
        .eq("template_id", template_id)

    console.log({ data, error })

    if (error) {
        console.error(error)
        return []
    }

    return data
}

export async function updatePermissionTemplate(
    id: number,
    payload: {
        template_name: string
        void: number
    }
) {

    const { data, error } = await db
        .from("permission_templates")
        .update({
            template_name: payload.template_name,
            void: payload.void,
        })
        .eq("id", id)

    console.log({ data, error })

    if (error) {
        throw error
    }

    return true
}