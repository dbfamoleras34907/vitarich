export const HATCHERY_EXTRACT_MODULES = [
  { key: 'receiving', label: 'Receiving', headerTable: 'recieving', lineTable: 'recieving_items', lineForeignKey: 'docentry' },
  { key: 'egg_classification', label: 'Egg Classification', headerTable: 'hatch_classification' },
  { key: 'egg_storage', label: 'Egg Storage', headerTable: 'egg_storage_mngt' },
  { key: 'egg_pre_warming', label: 'Egg Pre-Warming Process', headerTable: 'egg_pre_warming' },
  { key: 'egg_setter', label: 'Egg Setter', headerTable: 'setter_incubation_process' },
  { key: 'egg_transfer', label: 'Egg Transfer Process', headerTable: 'egg_transfer_process' },
  { key: 'egg_hatcher', label: 'Egg Hatcher Process', headerTable: 'egg_hatchery_process' },
  { key: 'chick_pullout', label: 'Chick Pullout Process', headerTable: 'chick_pullout_process' },
  { key: 'doc_classification', label: 'DOC Classification', headerTable: 'chick_grading_process' },
  { key: 'doc_dispatch', label: 'DOC Dispatch', headerTable: 'dispatch_doc', lineTable: 'dispatch_doc_item', lineForeignKey: 'dispatch_doc_id' },
] as const

export type HatcheryExtractModuleKey = typeof HATCHERY_EXTRACT_MODULES[number]['key']
export type HatcheryExtractRow = Record<string, unknown>

export type HatcheryExtractModuleData = {
  key: HatcheryExtractModuleKey
  label: string
  headerTable: string
  lineTable?: string
  headerRows: HatcheryExtractRow[]
  lineRows: HatcheryExtractRow[]
}

export type HatcheryExtractData = {
  modules: HatcheryExtractModuleData[]
  warnings: string[]
}

export function isHatcheryExtractModuleKey(value: unknown): value is HatcheryExtractModuleKey {
  return typeof value === 'string' && HATCHERY_EXTRACT_MODULES.some(module => module.key === value)
}
