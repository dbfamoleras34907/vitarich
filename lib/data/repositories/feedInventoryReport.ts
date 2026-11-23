import { getItems } from '@/app/a_dean/items/api'
import { getFlockCardSettings } from '@/app/brd/fc/settings/api'
import { getItemGroupById, getItemGroupDescendants, getSubItemGroups } from '@/lib/data/repositories/itemGroups'
import {
  getWarehouseReport,
  getWarehouseReportFarms,
  getWarehouseReportWarehouses,
  type WarehouseReportFilters,
} from '@/lib/data/repositories/warehouseReport'
import { buildFeedInventorySummaries, type FeedInventorySummary } from '@/lib/reports/feedInventoryReport'

export { getWarehouseReportFarms as getFeedInventoryReportFarms }
export { getWarehouseReportWarehouses as getFeedInventoryReportWarehouses }

export type FeedInventoryReportFilters = Omit<WarehouseReportFilters, 'separateByBatch'>

export type FeedInventoryReportResult = {
  summaries: FeedInventorySummary[]
  warning: string
}

type FeedItemRow = {
  item_code?: string | null
  item_group?: string | null
  sub_item_group_id?: number | null
  sub_item_group_level_1_id?: number | null
  sub_item_group_level_2_id?: number | null
  sub_item_group_level_3_id?: number | null
  is_inventory_item?: boolean | null
  void?: string | number | null
}

export async function getConfiguredFeedItemCodes(farmId: number) {
  const settings = await getFlockCardSettings(farmId)
  if (!settings?.feed_group_id) return null

  const [rootGroup, subGroups, items] = await Promise.all([
    getItemGroupById(settings.feed_group_id),
    getSubItemGroups(),
    getItems(),
  ])
  const groups = [rootGroup, ...subGroups]
  const includedGroups = [rootGroup, ...getItemGroupDescendants(groups, settings.feed_group_id)]
  const includedGroupIds = new Set(includedGroups.flatMap(group => group.id == null ? [] : [Number(group.id)]))
  const includedGroupCodes = new Set(includedGroups.map(group => group.code.trim().toUpperCase()).filter(Boolean))

  return new Set((items as FeedItemRow[]).flatMap(item => {
    const code = String(item.item_code ?? '').trim()
    const subgroupIds = [
      item.sub_item_group_id,
      item.sub_item_group_level_1_id,
      item.sub_item_group_level_2_id,
      item.sub_item_group_level_3_id,
    ].filter((id): id is number => id != null).map(Number)
    const belongsToFeedGroup = includedGroupCodes.has(String(item.item_group ?? '').trim().toUpperCase())
      || subgroupIds.some(id => includedGroupIds.has(id))
    const isActive = String(item.void ?? '') === '1'

    return code && isActive && item.is_inventory_item !== false && belongsToFeedGroup
      ? [code.toUpperCase()]
      : []
  }))
}

export async function getFeedInventoryReport(
  filters: FeedInventoryReportFilters,
): Promise<FeedInventoryReportResult> {
  const allRows = await getWarehouseReport({
    ...filters,
    from: '1900-01-01',
    separateByBatch: false,
  })
  const configuredFeedCodes = await getConfiguredFeedItemCodes(filters.farmId)
  const historicallyUsedFeedCodes = new Set(allRows.flatMap(row => {
    const sourceType = row.sourceDocType.trim().toUpperCase()
    return sourceType === 'BRD_FC_FEED_USAGE' || sourceType === 'BRD_FC_FEED_REVERSAL'
      ? [row.itemCode.trim().toUpperCase()]
      : []
  }))
  const feedCodes = configuredFeedCodes ?? historicallyUsedFeedCodes
  const feedRows = allRows.filter(row => feedCodes.has(row.itemCode.trim().toUpperCase()))

  return {
    summaries: buildFeedInventorySummaries(feedRows, filters.from),
    warning: configuredFeedCodes
      ? ''
      : 'This farm has no Feed Group configured. Showing only items already used by Broiler Growing.',
  }
}
