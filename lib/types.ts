import { ColumnDef } from '@tanstack/react-table';
import { UUID } from 'crypto';
import React from "react"

export type HatchClassification = {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  daterec: string | null;
  br_no: string | null;
  good_egg: number | null;
  trans_crack: number | null;
  hatc_crack: number | null;
  trans_condemn: number | null;
  hatc_condemn: number | null;
  thin_shell: number | null;
  pee_wee: number | null;
  small: number | null;
  jumbo: number | null;
  d_yolk: number | null;
  ttl_count: number | null;
  is_active: boolean | null;
};

export type Customer = {
  id: number;
  created_at: string;
  created_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  docStatus?: string | null;
  email?: string | null;
  firstname?: string | null;
  middlename?: string | null;
  lastname?: string | null;
  gender?: string | null;
  phone?: string | null;
  mobile?: string | null;
  birthdate?: string | null; // ISO date string
  location?: string | null;
  remarks?: string | null;
  auth_id: UUID | null;
};
export type EggStorageMngt = {
  id: number
  created_at: string
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
  room_temp: string | null
  egg_sto_humi: string | null
  egg_stemp_start: string | null
  egg_stemp_end: string | null
  egg_shell_temp: string | null
  egg_shell_temp_date: string | null
  duration: number | null
  remarks: string | null
  is_active: boolean | null
}





export const usersColumn: ColumnDef<Customer>[] = [
  // { accessorKey: "id", header: "ID" },
  // { accessorKey: "id", header: "ID" },
  // { accessorKey: "firstname", header: "First Name" },
  // { accessorKey: "lastname", header: "Last Name" },
  { accessorKey: "email", header: "Email" },
  // { accessorKey: "gender", header: "ID" },
  // { accessorKey: "docType", header: "User Type" },
  // { accessorKey: "docStatus", header: "Status", meta: { css: "status" } },
]




export interface UserInsert {
  auth_id: string;
  created_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  docStatus?: string | null;
  email?: string | null;
  firstname?: string | null;
  middlename?: string | null;
  lastname?: string | null;
  gender?: string | null;
  phone?: string | null;
  mobile?: string | null;
  birthdate?: string | null;
  location?: string | null;
  remarks?: string | null;
  supervisor?: string | null;
  default_farm?: string | null;
}


export interface SuperUsers {
  code: string | null;
  name: string | null;
}
export interface UserRow {
  id: number;
  created_at: string; // ISO timestamp string
  created_by: UUID | null;
  updated_at: string | null;
  updated_by: UUID | null;
  docStatus: string | null;
  email: string | null;
  firstname: string | null;
  middlename: string | null;
  lastname: string | null;
  gender: string | null;
  phone: string | null;
  mobile: string | null;
  birthdate: string | null;
  location: string | null;
  remarks: string | null;
  auth_id: UUID | null;
  issuper: string | null;
  supervisor?: string | null;
  isactive?: string | null;

}
export type DraftStatus = 'pending' | 'approved' | 'rejected';



export interface DataRecordApproval {
  uid: number;
  id: string;
  posting_date: string;
  email: string;
  soldTo: string;
  doc_date: string;
  address: string;
  tin: string;
  shipped_via: string;
  shipped_to: string;
  dr_num: string;
  po_no: string;
  Attention: string;
  voyage_no: string;
  status: DraftStatus
  checked: boolean;
  docentry: number;
  delivered_to: number | null;

}

export interface DocumentApproval {
  id: number;
  docentry: number;
  status: DraftStatus;
  decided_by_email: string | null;
  decided_at: string | null; // ISO timestamp
  remarks: string | null;
  created_at: string; // ISO timestamp
}


export interface Warehouse {
  id: number
  whse_code: string | null
  whse_name: string | null
  full_location_code: string | null
  warehouse_type: string | null
  subinventory_code: string | null
  subinventory_desc: string | null
  bin_activated: boolean
  is_active: boolean
  created_at: string
}



export interface WarehouseData {
  id?: number;
  created_at?: string;
  created_by?: string | null;
  whse_code?: string | null;
  whse_name?: string | null;
  full_location_code?: string | null;
  warehouse_type?: string | null;
  subinventory_code?: string | null;
  subinventory_desc?: string | null;
  is_active?: boolean | null;
  bin_activated?: boolean | null;
  address?: string | null;
  remarks?: string | null;
  phone?: string | null;
  mobile?: string | null;
  addr1?: string | null;
  addr2?: string | null;
  city?: string | null;
  province?: string | null;
}


export interface StorageLocationData {
  id: number
  warehouse_id: number
  parent_id: number | null
  level_no: number
  location_code: string
  location_name: string | null
  full_location_code: string
  is_lowest_level: boolean
  void: boolean
  is_active: boolean
  created_at: string
}



export type ColumnConfig<T> = {
  key: keyof T
  label: string
  sortable?: boolean
  render?: (row: T) => React.ReactNode
}

export type DataTableAction<T> = {
  label: string
  variant?: 'default' | 'destructive'
  onClick: (row: T) => void
}



export type ApproveHatcheryDraftPayload = {
  docentry: number
  posting_date: string
  temperature: string
  humidity: string

  soldTo: string
  Attention: string
  po_no: string
  voyage_no: string
  shipped_via: string
  dr_num: string

  no_of_crates: string
  no_of_tray: string
  plate_no: string
  driver: string
  serial_no: string

  items: {
    brdr_ref_no: string
    sku: string
    UoM: string
    lot_no: string
    prod_date: string
    age: string
    house_no: string
    jr: number | string
    he: number | string
    expected_count: number
    actual_count: number
  }[]
}


export type Farms = {
  id: number
  code: string
  name: string
  tin: string
  tel: string
  contact_person: string
  contact_number: string
  void: number
  created_at: string
  updated_at: string | null
  address: string
  barangay: string
  city: string
  province: string
  ref: string | null
  ref_type: string | null
}

// DMF - 27022026

export type DataTableColumn = {
  code: string
  name: string


  type:
  | "text"
  | "input"
  | "number"
  | "date"
  | "checkbox"
  | "search"
  | "button"


  disabled?: boolean
  list?: any[]

  // 🔥 Custom renderer
  render?: (
    row: Record<string, any>,
    rowIndex: number
  ) => React.ReactNode
}


export type ChickGradingInventory = {
  SKU: string
  qty: number
  ref: string
  UoM: string
  warehouse_code: string
}


export type ReceivingListRow = {
  id: number
  created_at: string
  created_by: string
  updated_at: string | null
  doc_date: string | null
  dr_num: string | null
  status: 'pending' | 'approved' | 'rejected'
  temperature: string | null
  humidity: string | null
  draft_id: number | null
  soldTo: string | null
  Attention: string | null
  po_no: string | null
  voyage_no: string | null
  shipped_via: string | null
  no_of_crates: string | null
  no_of_tray: string | null
  plate_no: string | null
  driver: string | null
  serial_no: string | null

  // item fields
  item_id: number | null
  brdr_ref_no: string | null
  sku: string | null
  UoM: string | null
  expected_count: number | null
  actual_count: number | null
  lot_no: string | null
  prod_date: string | null
  age: string | null
  house_no: string | null
  jr: string | null
  he: string | null
  farm_id: number | null
  farm_name: string | null
}


export type DisposalPrintRow = {
  ds_no: string | null
  created_at: string | null   // timestamptz → string in Supabase
  cardname: string | null
  contact_no: string | null
  customer_address: string | null
  ifrom: string | null
  sku: string | null
  description: string | null
  qty: number | null
  unit: string | null
  firstname: string | null
  middlename: string | null
  lastname: string | null
}

export type DraftItem = {
  id: number
  brdr_ref_no: string
  sku: string
  UoM: string
  lot_no?: string
  breed?: string
  prod_date?: string
  age?: string
  house_no?: string
  prod_date_to?: string
  total?: number        // from API
  actual_total?: number // user input

  isNew?: boolean
}


export const machineObj = [
  { code: "code", name: "Machine Code", type: "text" },
  { code: "name", name: "Machine Name", type: "text" },
  { code: "type", name: "Type", type: "text" },
  { code: "capacity", name: "Capacity", type: "number" },
  { code: "remarks", name: "Remarks", type: "text", isLong: true },
]

export type Users = {
  id: number
  created_at: string
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
  docStatus: string | null
  email: string | null
  firstname: string | null
  middlename: string | null
  lastname: string | null
  gender: string | null
  phone: string | null
  mobile: string | null
  birthdate: string | null
  location: string | null
  remarks: string | null
  auth_id: string | null
  issuper: string
  default_farm: string | null
}

export type DefaultFarm = {
  id: number;
  code: string;
  name: string;

}
export interface ApprovalRequestCreate {
  created_by: string
  user_email: string
  request_type: string
  value_encrypted: string
  remarks?: string
}

export interface ApprovalRequest {
  id: number
  created_at: string
  created_by: string
  user_email: string
  request_type: string
  value_encrypted: string
  remarks: string
  status: string
  approved_by?: string
  approved_at?: string
}


export interface UserProfileSafe {
  id: number | null
  created_at: string | null
  created_by: string | null
  updated_at: string | null
  updated_by: string | null

  docStatus: string | null

  email: string | null
  firstname: string | null
  middlename: string | null
  lastname: string | null
  gender: string | null

  phone: string | null
  mobile: string | null
  birthdate: string | null

  location: string | null
  remarks: string | null

  auth_id: string | null
  issuper: boolean
  default_farm: string | null

  supervisor: number

  isactive: boolean

  users_farms: string[]
}

export type ReceivingItemRow = {
  id: number
  created_at: string
  docentry: number
  brdr_ref_no: string
  sku: string
  UoM: string
  expected_count: string
  actual_count: string
  lot_no: string
  prod_date: string
  age: string
  house_no: string
  jr: string | null
  he: string | null
  total_api: string | null
  prod_date_to: string | null
}

export type ReceivingListRow2 = {
  id: number
  recieving_items: ReceivingItemRow[]
}