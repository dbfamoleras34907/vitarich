import { db } from '@/lib/Supabase/supabaseClient'
import { DocumentApproval, Farms } from '@/lib/types'






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

      items,
    } = payload

    const { data, error } = await db.rpc('fndmf_create_manual_recieving', {
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

// dmf_trg_post_inventory_from_recieving_items
