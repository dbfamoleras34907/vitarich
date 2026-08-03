import { type Dispatch, type SetStateAction } from 'react'
import { PackageCheck, Trash2 } from 'lucide-react'

import SearchableDropdown from '@/lib/SearchableDropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Items, WarehouseData } from '@/lib/types'
import { GoodsIssue, GoodsIssueLine, GoodsIssueOnHandBatch } from '../api'
import { GoodsIssueFlockCardInfo } from './api'
import { UomConversionOption, UomGroupOption } from '@/app/inv/gr/new/api'

type LineFlockCardState = {
  loading: boolean
  info: GoodsIssueFlockCardInfo | null
}

type DeliveryIssueLinesTableProps = {
  issue: GoodsIssue
  warehouseLabel: string
  farmWarehouses: WarehouseData[]
  loadingBatchOptions: Record<string, boolean>
  batchOptions: Record<string, GoodsIssueOnHandBatch[]>
  lineFlockCardInfo: Record<string, LineFlockCardState>
  loadingLinePlacementBatches: Record<string, boolean>
  activeDocumentIsPosted: boolean
  getItemsForLine: (line: GoodsIssueLine) => Items[]
  itemNeedsBatch: (line: GoodsIssueLine) => boolean
  lineHasPlacementBatchOptions: (line: GoodsIssueLine) => boolean
  batchOptionKey: (line: Pick<GoodsIssueLine, 'itemCode' | 'fromWarehouseCode'>) => string
  getBatchOptionsForLine: (line: GoodsIssueLine) => GoodsIssueOnHandBatch[]
  getTotalBatchOnHandForLine: (line: GoodsIssueLine) => number
  canOpenBatchSelector: (line: Pick<GoodsIssueLine, 'id' | 'itemCode' | 'fromWarehouseCode'>) => boolean
  selectLineWarehouse: (line: GoodsIssueLine, value: string) => Promise<void>
  selectItem: (line: GoodsIssueLine, value: string) => Promise<void>
  openBatchSelector: (line: GoodsIssueLine) => void
  updateLine: (id: GoodsIssueLine['id'], changes: Partial<GoodsIssueLine>) => void
  onTransferQuantityChange: (line: GoodsIssueLine, requestedAltQty: number) => void
  setIssue: Dispatch<SetStateAction<GoodsIssue | null>>
  newLine: () => GoodsIssueLine
  calculateBaseQty: (altQty: number, altUom: string, groupCode: string) => number
  getGroupUoms: (groupCode: string) => UomConversionOption[]
  getSelectedGroup: (groupCode: string) => UomGroupOption | undefined
  numberValue: (value: string) => number
  formatQuantity: (value: number) => string
}

export default function DeliveryIssueLinesTable({
  issue,
  warehouseLabel,
  farmWarehouses,
  loadingBatchOptions,
  batchOptions,
  lineFlockCardInfo,
  loadingLinePlacementBatches,
  activeDocumentIsPosted,
  getItemsForLine,
  itemNeedsBatch,
  lineHasPlacementBatchOptions,
  batchOptionKey,
  getBatchOptionsForLine,
  getTotalBatchOnHandForLine,
  canOpenBatchSelector,
  selectLineWarehouse,
  selectItem,
  openBatchSelector,
  updateLine,
  onTransferQuantityChange,
  setIssue,
  newLine,
  calculateBaseQty,
  getGroupUoms,
  getSelectedGroup,
  numberValue,
  formatQuantity,
}: DeliveryIssueLinesTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1520px] w-full table-fixed border-collapse text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="w-[44px] border-r px-2 py-2 text-center">#</th>
            <th className="w-[20%] border-r px-3 py-2">{warehouseLabel}</th>
            <th className="w-[13%] border-r px-3 py-2">Flock Card</th>
            <th className="w-[10%] border-r px-3 py-2">Cycle Count</th>
            <th className="w-[7%] border-r px-3 py-2">Age</th>
            <th className="w-[8%] border-r px-3 py-2">Weight g</th>
            <th className="w-[16%] border-r px-3 py-2">Item</th>
            <th className="w-[11%] border-r px-3 py-2">To Transfer</th>
            <th className="w-[16%] border-r px-3 py-2">Batch</th>
            <th className="w-[10%] border-r px-3 py-2">UOM</th>
            <th className="w-[11%] border-r px-3 py-2">{activeDocumentIsPosted ? 'Used Qty' : 'On Hand Qty'}</th>
            <th className="w-[54px] px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {Array.from(issue.lines.reduce((groups, candidate) => {
            const groupKey = candidate.fromWarehouseCode && candidate.itemCode
              ? `${candidate.fromWarehouseCode.trim().toUpperCase()}::${candidate.itemCode.trim().toUpperCase()}`
              : `line::${String(candidate.id)}`
            const group = groups.get(groupKey) ?? []
            group.push(candidate)
            groups.set(groupKey, group)
            return groups
          }, new Map<string, GoodsIssueLine[]>()).values()).map((allocationLines, index) => {
            const line = allocationLines[0]
            const allocationLineIds = new Set(allocationLines.map(allocation => allocation.id))
            const selectedBuildingCodes = new Set(
              issue.lines
                .filter(candidate => !allocationLineIds.has(candidate.id) && candidate.fromWarehouseCode)
                .map(candidate => candidate.fromWarehouseCode),
            )
            const availableBuildings = farmWarehouses.filter(warehouse => {
              const warehouseCode = warehouse.whse_code ?? ''
              return warehouseCode === line.fromWarehouseCode || !selectedBuildingCodes.has(warehouseCode)
            })
            const needsBatch = itemNeedsBatch(line) || lineHasPlacementBatchOptions(line)
            const batchKey = batchOptionKey(line)
            const batches = getBatchOptionsForLine(line)
            const isLoadingBatches = Boolean(loadingBatchOptions[batchKey])
            const hasSearchedBatches = Object.prototype.hasOwnProperty.call(batchOptions, batchKey)
            const canSearchBatches = canOpenBatchSelector(line)
            const flockState = lineFlockCardInfo[String(line.id)]
            const loadingPlacementItems = Boolean(flockState?.loading || loadingLinePlacementBatches[String(line.id)])
            const lineItems = getItemsForLine(line)
            const allocatedTransferQty = allocationLines
              .filter(allocation => allocation.batchNumber)
              .reduce((total, allocation) => total + Number(allocation.altQty || 0), 0)
            const totalTransferQty = line.requestedAltQty ?? allocationLines.reduce((total, allocation) => total + Number(allocation.altQty || 0), 0)
            const allocationDifference = totalTransferQty - allocatedTransferQty
            const hasAllocationMismatch = Boolean(line.batchNumber && Math.abs(allocationDifference) > 0.000001)
            const totalAvailableQty = getTotalBatchOnHandForLine(line)
            const batchSummary = allocationLines
              .filter(allocation => allocation.batchNumber)
              .map(allocation => `${allocation.batchNumber} (${formatQuantity(allocation.altQty)})`)
              .join(', ')

            return (
              <tr key={line.id} className="border-t odd:bg-white even:bg-stone-50/70 hover:bg-stone-50">
                <td className="border-r p-0 text-center align-middle text-stone-500">
                  {index + 1}
                </td>
                <td className="border-r p-1 align-middle">
                  <SearchableDropdown
                    list={availableBuildings}
                    codeLabel="whse_code"
                    nameLabel="whse_name"
                    value={line.fromWarehouseCode}
                    placeholder={issue.farmId ? `Select ${warehouseLabel.toLowerCase()}...` : 'Select farm first'}
                    width={300}
                    onChange={(value) => {
                      selectLineWarehouse(line, value).catch(console.error)
                    }}
                  />
                </td>
                <td className="border-r p-1 align-middle">
                  <Input
                    value={
                      flockState?.loading
                        ? 'Loading...'
                        : flockState?.info
                          ? flockState.info.cardNo || '-'
                          : line.fromWarehouseCode
                            ? 'No saved flock card'
                            : ''
                    }
                    readOnly
                    className="h-8 rounded-sm border-0 bg-transparent shadow-none focus-visible:ring-1"
                  />
                </td>
                <td className="border-r p-1 align-middle">
                  <Input
                    value={flockState?.info?.cycleNumber || ''}
                    readOnly
                    className="h-8 rounded-sm border-0 bg-transparent shadow-none focus-visible:ring-1"
                  />
                </td>
                <td className="border-r p-1 align-middle">
                  <Input
                    value={flockState?.info ? String(flockState.info.age) : ''}
                    readOnly
                    className="h-8 rounded-sm border-0 bg-transparent text-right shadow-none focus-visible:ring-1"
                  />
                </td>
                <td className="border-r p-1 align-middle">
                  <Input
                    value={flockState?.info?.bodyWeight ? formatQuantity(flockState.info.bodyWeight) : ''}
                    readOnly
                    className="h-8 rounded-sm border-0 bg-transparent text-right shadow-none focus-visible:ring-1"
                  />
                </td>
                <td className="border-r p-1 align-middle">
                  <SearchableDropdown
                    list={lineItems}
                    codeLabel="item_code"
                    nameLabel="item_name"
                    value={line.itemCode}
                    placeholder={
                      !line.fromWarehouseCode
                        ? `Select ${warehouseLabel.toLowerCase()} first`
                        : loadingPlacementItems
                          ? 'Loading placement items...'
                          : lineItems.length > 0
                            ? 'Select placement item...'
                            : 'No placement items'
                    }
                    width={300}
                    onChange={(value) => selectItem(line, value)}
                  />
                </td>
                <td className="border-r p-1 align-middle">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={totalTransferQty}
                    onChange={event => {
                      const requestedTotal = Math.max(numberValue(event.target.value), 0)
                      updateLine(line.id, {
                        requestedAltQty: requestedTotal,
                        ...(!line.batchNumber ? {
                          altQty: requestedTotal,
                          baseQty: calculateBaseQty(requestedTotal, line.altUom, line.baseUom),
                        } : {}),
                      })
                    }}
                    onBlur={() => onTransferQuantityChange(line, totalTransferQty)}
                    className={`h-8 rounded-sm text-right shadow-none focus-visible:ring-1 ${hasAllocationMismatch ? 'border-red-300 bg-red-50/70 font-semibold text-red-700 focus-visible:border-red-400 focus-visible:ring-red-200' : 'border-0 bg-transparent'}`}
                    title={line.batchNumber ? `${formatQuantity(allocatedTransferQty)} allocated` : undefined}
                  />
                  {hasAllocationMismatch && (
                    <div className="mt-0.5 truncate px-2 text-right text-[11px] font-medium text-red-600">
                      {allocationDifference > 0
                        ? `${formatQuantity(allocationDifference)} remaining to allocate`
                        : `${formatQuantity(Math.abs(allocationDifference))} over-allocated`}
                    </div>
                  )}
                </td>
                <td className="border-r p-1 align-middle">
                  {needsBatch ? (
                    <div className="space-y-1">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canSearchBatches}
                        onClick={() => openBatchSelector(line)}
                        className={`h-8 w-full justify-between rounded-sm px-2 font-normal ${batchSummary ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100' : 'bg-white text-stone-800'}`}
                      >
                        <span className={batchSummary ? 'truncate font-medium' : 'truncate text-muted-foreground'}>
                          {batchSummary || (canSearchBatches ? 'Select batches' : 'Select item/building')}
                        </span>
                        <PackageCheck className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
                      </Button>
                      {!isLoadingBatches && hasSearchedBatches && canSearchBatches && batches.length === 0 && (
                        <div className="truncate text-[11px] text-amber-700">No on-hand batches found.</div>
                      )}
                    </div>
                  ) : (
                    <Input value="Not required" readOnly className="h-8 rounded-sm border-0 bg-transparent text-muted-foreground shadow-none focus-visible:ring-1" />
                  )}
                </td>
                <td className="border-r p-1 align-middle">
                  <select
                    value={line.altUom}
                    disabled={!line.baseUom || allocationLines.length > 1}
                    onChange={event => {
                      const altUom = event.target.value
                      updateLine(line.id, { altUom, baseQty: calculateBaseQty(line.altQty, altUom, line.baseUom) })
                    }}
                    className="h-8 w-full rounded-sm border-0 bg-transparent px-2 text-sm outline-none transition focus:ring-1 focus:ring-ring/30 disabled:cursor-not-allowed disabled:text-muted-foreground"
                  >
                    <option value="">{line.baseUom ? 'Select UOM' : 'Select item first'}</option>
                    {getGroupUoms(line.baseUom).map(conversion => (
                      <option key={`${conversion.groupId}-${conversion.uomCode}`} value={conversion.uomCode}>{conversion.uomCode}</option>
                    ))}
                  </select>
                </td>
                <td className="border-r p-1 align-middle">
                  <Input
                    value={`${formatQuantity(activeDocumentIsPosted ? allocationLines.reduce((total, allocation) => total + allocation.baseQty, 0) : totalAvailableQty)} ${getSelectedGroup(line.baseUom)?.baseUomCode ?? ''}`.trim()}
                    readOnly
                    className="h-8 rounded-sm border-0 bg-transparent text-right text-stone-800 shadow-none focus-visible:ring-1"
                  />
                </td>
                <td className="p-1 text-center align-middle">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setIssue(current => {
                      if (!current) return current
                      const ids = new Set(allocationLines.map(allocation => allocation.id))
                      const nextLines = current.lines.filter(candidate => !ids.has(candidate.id))
                      return { ...current, lines: nextLines.length > 0 ? nextLines : [newLine()] }
                    })}
                    aria-label={`Delete row ${index + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
