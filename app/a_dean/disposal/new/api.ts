import { db } from "@/lib/Supabase/supabaseClient"
import { ChickGradingInventory } from "@/lib/types"

export async function get_chick_grading_inventory(batchcode: string) {
  try {
    const { data, error } = await db.rpc(
      "get_chick_disposal_balance3", // list of item with batch -> LINE items
      { p_batchcode: batchcode }
    )

    if (error) throw error

    return {
      success: true,
      data: data as ChickGradingInventory[]
    }
  } catch (error: any) {
    console.error("Error fetching chick grading inventory:", error.message)
    return { success: false, error: error.message }
  }
}
// 

export async function get_available_chick_grading_batch_refs(farmcode: string) {
  try {
    const { data, error } = await db.rpc(
      "fndmf_get_available_chick_grading_batch_refs" // list of batch base on inventory posting
    )

    if (error) throw error

    return {
      success: true,
      data: data as { batch_ref: string }[]
    }
  } catch (error: any) {
    console.error(
      "Error fetching available chick grading batch refs:",
      error.message
    )
    return { success: false, error: error.message }
  }
}

const { data } = await db.rpc('get_next_ds_preview')



export async function create_disposal(
  header: Record<string, any>,
  pickedRows: Record<string, any>[]
) {
  try {
    const {
      data: { user },
      error: userError,
    } = await db.auth.getUser()

    if (userError || !user) throw userError || new Error("No user")

    const { data: headerInsert, error: headerError } = await db
      .from("disposal")
      .insert({
        created_by: user.id,
        created_at: header.created_at || new Date(),
        cardname: header.cardname,
        contact_no: header.contact_no,
        customer_address: header.customer_address,
        mode_of_release: Number(header.mode_of_release) || null,
        batch_code: header.batch_code,
        sku_class: header.sku_class,
        farm_id: header.farm_id,
      })
      .select()
      .single()

    if (headerError) throw headerError

    const disposalId = headerInsert.id

    if (pickedRows.length > 0) {
      const items = pickedRows.map((r) => ({
        disposal_id: disposalId,
        created_by: user.id,
        ref: r.ref,
        sku: r.SKU,
        uom: r.UoM,
        from_whs: r.warehouse_code,
        qty: Number(r.qty) || 0,
      }))

      const { error: itemError } = await db
        .from("disposal_item")
        .insert(items)
      console.log({ itemError })
      if (itemError) throw itemError
    }

    return { success: true, data: headerInsert }
  } catch (error) {
    return { success: false, error }
  }
}