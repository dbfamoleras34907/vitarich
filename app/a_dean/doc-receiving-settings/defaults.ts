import type { DocItemOption, DocReceivingSettings } from './api'

export type DocPlacementDefaults = {
  good_doc_item_code: string
  dao_doc_item_code: string
  reject_doc_item_code: string
}

/**
 * Initial DOC Placement values shown for a farm that does not have saved
 * settings yet. Edit these item codes when the Farm Setup defaults change.
 */
export const DOC_PLACEMENT_DEFAULTS: DocPlacementDefaults = {
  good_doc_item_code: 'DOC00002',
  dao_doc_item_code: 'DOC00003',
  reject_doc_item_code: 'DOC00004',
}

export function resolveDocPlacementDefaults(
  farmId: number,
  items: DocItemOption[],
): DocReceivingSettings {
  const itemIdByCode = new Map(items.map(item => [item.item_code, item.id]))
  const configuredCodes = [
    DOC_PLACEMENT_DEFAULTS.good_doc_item_code,
    DOC_PLACEMENT_DEFAULTS.dao_doc_item_code,
    DOC_PLACEMENT_DEFAULTS.reject_doc_item_code,
  ]
  const missingCodes = configuredCodes.filter(code => !itemIdByCode.has(code))

  if (missingCodes.length > 0) {
    throw new Error(
      `Configured DOC Placement default item${missingCodes.length > 1 ? 's were' : ' was'} not found: ${missingCodes.join(', ')}`,
    )
  }

  return {
    farm_id: farmId,
    good_doc: itemIdByCode.get(DOC_PLACEMENT_DEFAULTS.good_doc_item_code) ?? null,
    bad_doc: itemIdByCode.get(DOC_PLACEMENT_DEFAULTS.dao_doc_item_code) ?? null,
    reject_doc: itemIdByCode.get(DOC_PLACEMENT_DEFAULTS.reject_doc_item_code) ?? null,
  }
}
