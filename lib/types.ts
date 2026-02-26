import { ColumnDef } from '@tanstack/react-table';
import { UUID } from 'crypto';

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
}
export type DraftStatus = 'pending' | 'approved' | 'rejected';



export interface DataRecordApproval {
  uid: number;
  id: string;
  posting_date: string;
  email: string;
  soldTo: string;
  doc_date : string;
  address : string;
  tin : string;
  shipped_via : string;
  shipped_to  : string;
  dr_num  : string;
  po_no  : string;
  Attention  : string;
  voyage_no  : string;
  status: DraftStatus
  checked: boolean;
  docentry: number;
  

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
}