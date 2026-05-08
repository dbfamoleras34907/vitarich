
import { db } from "@/lib/Supabase/supabaseClient"


export const getReceivingView = async (receivingItemId: number) => {
    const { data: line, error: lineError } = await db
        .from('recieving_items')
        .select('*')
        .eq('id', receivingItemId)
        .single()

    console.log({ line, lineError })
    if (lineError) {
        console.log(lineError)
        return null
    }
    console.log({ line })
    const { data: header, error: headerError } = await db
        .from('recieving')
        .select('*')
        .eq('id', line.docentry)
        .single()

    if (headerError) {
        console.log(headerError)
        return null
    }

    // get all lines
    const { data: items, error: itemsError } = await db
        .from('recieving_items')
        .select('*')
        .eq('docentry', line.docentry)
        .order('id')

    if (itemsError) {
        console.log(itemsError)
        return null
    }

    return {
        header,
        items,
    }
}