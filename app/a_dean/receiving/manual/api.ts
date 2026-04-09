import { db } from '@/lib/Supabase/supabaseClient'
import { DefaultFarm, DocumentApproval, Farms, Users } from '@/lib/types'


//Add proper JSDoc documentation
/**
 * Retrieves the list of farms for a specific breeder.
 * @returns {Promise<Farms[]>} A promise resolving to an array of farm objects.
 */
export async function getFarmDB_breeder() {
  const { data, error } = await db
    .from('vwdmf_get_farmlist_breeder_code_name')
    .select('*')
  // .order('posting_date', { ascending: false })

  if (error) {
    throw error
  }

  return data as Farms[]
}




export async function getFarmDB() {
  const { data, error } = await db
    .from('vwdmf_get_farmlist')
    .select('*')
  // .order('posting_date', { ascending: false })

  if (error) {
    throw error
  }

  return data as Farms[]
}



export async function getDefaultFarm(id: string) {
  const { data, error } = await db
    .from('vwdmf_getuserdefaultfarm')
    .select('*')
    .eq('users_id', id)
  // .order('posting_date', { ascending: false })

  if (error) {
    throw error
  }

  return data as Farms[]
}



/**
 * Retrieves the user information for the currently authenticated user.
 * @returns {Promise<DefaultFarm[]>} A promise resolving to an array of default farm objects associated with the user.
 */
export async function getUserInfo() {
  const { data: { session } } = await db.auth.getSession()
  console.log(session?.user.id)
  const { data, error } = await db
    .from('vwdmf_user_default_farm')
    .select('*')
    .eq('auth_id', session?.user.id)

  console.log({ data, error })
  if (error) {
    throw error
  }

  return data as DefaultFarm[]
}



/**
 * Creates a new receiving document in the database using the provided payload.
 * @param {Object} payload - The data for the receiving document, including details such as document date, temperature, humidity, supplier information, and item details.
 * @returns {Promise<Object>} An object containing the success status and either the document entry ID or an error message.
 */

export async function createReceiving(payload: any) {
  try {
    const {
      doc_date,
      temperature,
      humidity,

      soldTo,
      Attention,
      po_no,
      voyage_no,
      shipped_via,
      dr_num,

      no_of_crates,
      no_of_tray,
      plate_no,
      driver,
      serial_no,
      delivered_to,
      brdr_ref_no,

      items,
    } = payload
    console.log({ payload, items })
    const { data, error } = await db.rpc('insert_receiving', {
      p_doc_date: doc_date,
      p_temperature: temperature,
      p_humidity: humidity,
      p_soldto: soldTo,
      p_attention: Attention,
      p_po_no: po_no,
      p_voyage_no: voyage_no,
      p_shipped_via: shipped_via,
      p_dr_num: dr_num,

      p_no_of_crates: no_of_crates,
      p_no_of_tray: no_of_tray,
      p_plate_no: plate_no,
      p_driver: driver,
      p_serial_no: serial_no,

      p_delivered_to: delivered_to,
      p_brdr_ref_no: brdr_ref_no,

      p_items: items,
    })

    if (error) throw error

    return {
      success: true,
      docentry: data,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message ?? 'Failed to create receiving document.',
    }
  }
}
// export async function createReceiving(payload: any) {
//   try {
//     const {
//       doc_date,
//       temperature,
//       humidity,

//       soldTo,
//       Attention,
//       po_no,
//       voyage_no,
//       shipped_via,
//       dr_num,

//       no_of_crates,
//       no_of_tray,
//       plate_no,
//       driver,
//       serial_no,

//       items,
//     } = payload

//     const { data, error } = await db.rpc('fndmf_create_manual_recieving', {
//       p_doc_date: doc_date,
//       p_temperature: temperature,
//       p_humidity: humidity,

//       p_soldto: soldTo,
//       p_attention: Attention,
//       p_po_no: po_no,
//       p_voyage_no: voyage_no,
//       p_shipped_via: shipped_via,
//       p_dr_num: dr_num,

//       p_no_of_crates: no_of_crates,
//       p_no_of_tray: no_of_tray,
//       p_plate_no: plate_no,
//       p_driver: driver,
//       p_serial_no: serial_no,

//       p_items: items,
//     })

//     if (error) throw error

//     return {
//       success: true,
//       docentry: data,
//     }
//   } catch (error: any) {
//     return {
//       success: false,
//       error: error.message ?? 'Failed to create receiving document.',
//     }
//   }
// }

// dmf_trg_post_inventory_from_recieving_items


