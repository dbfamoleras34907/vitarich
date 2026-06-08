import { db } from "@/lib/Supabase/supabaseClient"

export async function reverseDisposal(id: number) {
    try {

        const { data, error } = await db.rpc("reverse_disposal", { p_doc_id: id })

        if (error) throw error

        return data

    } catch (error: any) {
        console.error(error)
        throw error
    }
}


export async function reverseDispatch(
    id: number
) {
    try {

        const { data, error } = await db.rpc("reverse_dispatch", { p_doc_id: id })

        if (error) throw error

        return data

    } catch (error: any) {
        console.error(error)
        throw error
    }
}


export async function reverseChickGrading(
    id: number
) {
    try {

        const { data, error } = await db.rpc("reverse_chick_grading", { p_doc_id: id })

        if (error) throw error

        return data

    } catch (error: any) {
        console.error(error)
        throw error
    }
}


export async function reverseChickPullout(
    id: number
) {
    try {

        const { data, error } = await db.rpc("reverse_chick_pullout", { p_doc_id: id })

        if (error) throw error

        return data

    } catch (error: any) {
        console.error(error)
        throw error
    }
}


export async function reverseHatcher(
    id: number
) {
    try {

        const { data, error } = await db.rpc("reverse_hatcher", { p_doc_id: id })
        if (error) throw error
        return data

    } catch (error: any) {
        console.error(error)
        throw error
    }
}

export async function reverseTransfer(
    id: number
) {
    try {
        const { data, error } = await db.rpc("reverse_transfer", { p_doc_id: id })
        if (error) throw error
        return data
    } catch (error: any) {
        console.error(error)
        throw error
    }
}


export async function reverseSetter(
    id: number
) {
    try {
        const { data, error } = await db.rpc("reverse_setter", { p_doc_id: id })
        if (error) throw error
        return data
    } catch (error: any) {
        console.error(error)
        throw error
    }
}

export async function reversePreWarming(
    id: number
) {
    try {

        const { data, error } = await db.rpc("reverse_pre_warming", { p_doc_id: id })
        if (error) throw error
        return data

    } catch (error: any) {
        console.error(error)
        throw error
    }
}



export async function reverseStorage(
    id: number
) {
    try {

        const { data, error } = await db.rpc("reverse_storage", { p_doc_id: id })
        if (error) throw error
        return data

    } catch (error: any) {
        console.error(error)
        throw error
    }
}


export async function reverseClassification(
    id: number
) {
    try {

        const { data, error } = await db.rpc("reverse_classification", { p_doc_id: id })
        if (error) throw error
        return data

    } catch (error: any) {
        console.error(error)
        throw error
    }
}


// 

export async function reverseReceiving(
    id: number
) {
    try {
        const { data, error } = await db.rpc("reverse_receiving", { p_doc_id: id })
        if (error) throw error
        return data
    } catch (error: any) {
        console.error(error)
        throw error
    }
}