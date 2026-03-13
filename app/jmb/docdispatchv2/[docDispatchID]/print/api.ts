import { db } from "@/lib/Supabase/supabaseClient";

export type DocDispatchPrintHeader = {
  dispatch_doc_id: number;
  dr_no: string;
  doc_date: string;
  farm_name: string | null;
  address: string | null;
  hauler_name: string | null;
  hauler_plate_no: string | null;
  truck_seal_no: string | null;
  chick_van_temp_c: number | null;
  number_of_fans: number | null;
  remarks: string | null;

  created_at: string | null;
  created_by: string | null;

  // from public.users c
  firstname: string | null;
  middlename: string | null;
  lastname: string | null;
  fullname: string | null;

  // fallback display
  created_by_display: string | null;
  farmname: string | null;
};

export type DocDispatchPrintItem = {
  dispatch_doc_item_id: number;
  line_no: number;
  doc_batch_code: string | null;
  sku_name: string | null;
  // classification: string | null;
  uom: string | null;
  qty: number | null;
};

export type DocDispatchPrintRow = DocDispatchPrintHeader & DocDispatchPrintItem;

export type DocDispatchPrintPayload = {
  header: DocDispatchPrintHeader;
  items: DocDispatchPrintItem[];
  items10: DocDispatchPrintItem[];
};

function padTo10(items: DocDispatchPrintItem[]) {
  const padded = [...items];
  while (padded.length < 10) {
    padded.push({
      dispatch_doc_item_id: 0,
      line_no: padded.length + 1,
      doc_batch_code: "",
      sku_name: "",
      // classification: "",
      uom: "",
      qty: null,
    });
  }
  return padded.slice(0, 10);
}

export async function getDocDispatchPrint(
  docDispatchID: number,
): Promise<DocDispatchPrintPayload> {
  const { data, error } = await db
    .from("v_dispatch_dr_print_lines")
    .select("*")
    .eq("dispatch_doc_id", docDispatchID)
    .order("line_no", { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as DocDispatchPrintRow[];

  if (!rows.length) {
    throw new Error(
      "No DR data found for printing (check ID / is_active / items).",
    );
  }

  const r0 = rows[0];

  const header: DocDispatchPrintHeader = {
    dispatch_doc_id: r0.dispatch_doc_id,
    dr_no: r0.dr_no,
    doc_date: r0.doc_date,
    farm_name: r0.farm_name,
    address: r0.address,
    hauler_name: r0.hauler_name,
    hauler_plate_no: r0.hauler_plate_no,
    truck_seal_no: r0.truck_seal_no,
    chick_van_temp_c: r0.chick_van_temp_c,
    number_of_fans: r0.number_of_fans,
    remarks: r0.remarks,

    created_at: r0.created_at,
    created_by: r0.created_by,

    firstname: r0.firstname,
    middlename: r0.middlename,
    lastname: r0.lastname,
    fullname: r0.fullname,

    created_by_display: r0.created_by_display,
    farmname: r0.farmname,
  };

  const items: DocDispatchPrintItem[] = rows.map((r) => ({
    dispatch_doc_item_id: r.dispatch_doc_item_id,
    line_no: r.line_no,
    doc_batch_code: r.doc_batch_code,
    sku_name: r.sku_name,
    // classification: (r.classification as any) ?? null,
    uom: (r.uom as any) ?? null,
    qty: r.qty !== null && r.qty !== undefined ? Number(r.qty) : null,
  }));

  return {
    header,
    items,
    items10: padTo10(items),
  };
}
