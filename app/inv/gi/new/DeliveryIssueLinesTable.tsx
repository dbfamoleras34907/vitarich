import { type Dispatch, type SetStateAction } from 'react'
import { Loader2, PackageCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

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
  getAvailableOnHandForLine: (line: GoodsIssueLine) => number
  canOpenBatchSelector: (line: Pick<GoodsIssueLine, 'id' | 'itemCode' | 'fromWarehouseCode'>) => boolean
  selectLineWarehouse: (line: GoodsIssueLine, value: string) => Promise<void>
  selectItem: (line: GoodsIssueLine, value: string) => Promise<void>
  openBatchSelector: (line: GoodsIssueLine) => void
  updateLine: (id: GoodsIssueLine['id'], changes: Partial<GoodsIssueLine>) => void
  setIssue: Dispatch<SetStateAction<GoodsIssue | null>>
  newLine: () => GoodsIssueLine
  calculateBaseQty: (altQty: number, altUom: string, groupCode: string) => number
  getGroupUoms: (groupCode: string) => UomConversionOption[]
  getSelectedGroup: (groupCode: string) => UomGroupOption | undefined
  numberValue: (value: string) => number
  formatQuantity: (value: number) => string
  formatDateValue: (value: string) => string
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
  getAvailableOnHandForLine,
  canOpenBatchSelector,
  selectLineWarehouse,
  selectItem,
  openBatchSelector,
  updateLine,
  setIssue,
  newLine,
  calculateBaseQty,
  getGroupUoms,
  getSelectedGroup,
  numberValue,
  formatQuantity,
  formatDateValue,
}: DeliveryIssueLinesTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1520px] w-full table-fixed border-collapse text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="w-[44px] border-r px-2 py-2 text-center">#</th>
            <th className="w-[20%] border-r px-3 py-2">{warehouseLabel}</th>
            <th className="w-[13%] border-r px-3 py-2">Flock Card</th>
            <th className="w-[10%] border-r px-3 py-2">Flock Code</th>
            <th className="w-[7%] border-r px-3 py-2">Age</th>
            <th className="w-[10%] border-r px-3 py-2">Birds</th>
            <th className="w-[8%] border-r px-3 py-2">Weight g</th>
            <th className="w-[16%] border-r px-3 py-2">Item</th>
            <th className="w-[16%] border-r px-3 py-2">Batch</th>
            <th className="w-[10%] border-r px-3 py-2">MFG Date</th>
            <th className="w-[10%] border-r px-3 py-2">UOM</th>
            <th className="w-[11%] border-r px-3 py-2">{activeDocumentIsPosted ? 'Used Qty' : 'On Hand Qty'}</th>
            <th className="w-[11%] border-r px-3 py-2">To Transfer Qty</th>
            <th className="w-[54px] px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {issue.lines.map((line, index) => {
            const needsBatch = itemNeedsBatch(line) || lineHasPlacementBatchOptions(line)
            const batchKey = batchOptionKey(line)
            const batches = getBatchOptionsForLine(line)
            const isLoadingBatches = Boolean(loadingBatchOptions[batchKey])
            const hasSearchedBatches = Object.prototype.hasOwnProperty.call(batchOptions, batchKey)
            const canSearchBatches = canOpenBatchSelector(line)
            const flockState = lineFlockCardInfo[String(line.id)]
            const loadingPlacementItems = Boolean(loadingLinePlacementBatches[String(line.id)])
            const lineItems = getItemsForLine(line)
            const availableOnHandQty = getAvailableOnHandForLine(line)
            const isOver = Boolean(line.itemCode && line.batchNumber && line.baseQty > availableOnHandQty)
            const onHandClass = isOver ? 'text-red-600' : 'text-stone-800'
            const baseQtyPerAltQty = calculateBaseQty(1, line.altUom, line.baseUom)
            const maxAltQty = availableOnHandQty > 0 && baseQtyPerAltQty > 0
              ? availableOnHandQty / baseQtyPerAltQty
              : undefined
            const clampTransferQuantity = () => {
              if (!line.itemCode || !line.altUom || !line.baseUom || !maxAltQty) return

              if (line.altQty <= 0) {
                updateLine(line.id, {
                  altQty: 0,
                  baseQty: 0,
                })
                toast('To Transfer Qty must be greater than 0.')
                return
              }

              if (line.baseQty > availableOnHandQty) {
                updateLine(line.id, {
                  altQty: maxAltQty,
                  baseQty: availableOnHandQty,
                })
                toast(`To Transfer Qty cannot exceed the selected batch remaining on-hand quantity of ${formatQuantity(availableOnHandQty)} ${getSelectedGroup(line.baseUom)?.baseUomCode ?? ''}.`.trim())
              }
            }

            return (
              <tr key={line.id} className="border-t odd:bg-white even:bg-stone-50/70 hover:bg-stone-50">
                <td className="border-r p-0 text-center align-middle text-stone-500">
                  {index + 1}
                </td>
                <td className="border-r p-1 align-middle">
                  <SearchableDropdown
                    list={farmWarehouses}
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
                    value={flockState?.info?.flockCode || ''}
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
                    value={flockState?.info ? formatQuantity(flockState.info.animalQty) : ''}
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
                  {needsBatch ? (
                    <div className="space-y-1">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canSearchBatches}
                        onClick={() => openBatchSelector(line)}
                        className={`h-8 w-full justify-between rounded-sm px-2 font-normal ${
                          line.batchNumber
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                            : 'bg-white text-stone-800'
                        }`}
                      >
                        <span className={line.batchNumber ? 'truncate font-medium' : 'truncate text-muted-foreground'}>
                          {line.batchNumber || (canSearchBatches ? 'Select batch' : 'Select item/building')}
                        </span>
                        {isLoadingBatches ? (
                          <Loader2 className="ml-2 size-3.5 shrink-0 animate-spin text-stone-500" />
                        ) : (
                          <PackageCheck className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
                        )}
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
                  <Input
                    value={formatDateValue(line.manufacturingDate)}
                    readOnly
                    className="h-8 rounded-sm border-0 bg-transparent shadow-none focus-visible:ring-1"
                  />
                </td>
                <td className="border-r p-1 align-middle">
                  <select
                    value={line.altUom}
                    disabled={!line.baseUom}
                    onChange={event => {
                      const altUom = event.target.value
                      updateLine(line.id, {
                        altUom,
                        baseQty: calculateBaseQty(line.altQty, altUom, line.baseUom),
                      })
                    }}
                    className="h-8 w-full rounded-sm border-0 bg-transparent px-2 text-sm outline-none transition focus:ring-1 focus:ring-ring/30 disabled:cursor-not-allowed disabled:text-muted-foreground"
                  >
                    <option value="">{line.baseUom ? 'Select UOM' : 'Select item first'}</option>
                    {getGroupUoms(line.baseUom).map(conversion => (
                      <option key={`${conversion.groupId}-${conversion.uomCode}`} value={conversion.uomCode}>
                        {conversion.uomCode}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border-r p-1 align-middle">
                  <Input
                    value={
                      isLoadingBatches
                        ? 'Loading...'
                        : `${formatQuantity(activeDocumentIsPosted ? line.baseQty : availableOnHandQty)} ${getSelectedGroup(line.baseUom)?.baseUomCode ?? ''}`.trim()
                    }
                    readOnly
                    className={`h-8 rounded-sm border-0 bg-transparent text-right shadow-none focus-visible:ring-1 ${onHandClass}`}
                  />
                  {isOver && (
                    <div className="truncate px-2 text-[11px] font-medium text-red-600">Exceeds on-hand</div>
                  )}
                </td>
                <td className="border-r p-1 align-middle">
                  <Input
                    type="number"
                    min="0"
                    max={maxAltQty}
                    step="any"
                    value={line.altQty}
                    onChange={event => {
                      const altQty = numberValue(event.target.value)
                      updateLine(line.id, {
                        altQty,
                        baseQty: calculateBaseQty(altQty, line.altUom, line.baseUom),
                      })
                    }}
                    onBlur={clampTransferQuantity}
                    className={`h-8 rounded-sm border-0 bg-transparent text-right shadow-none focus-visible:ring-1 ${isOver ? 'text-red-600 focus-visible:ring-red-200' : ''}`}
                  />
                  {isOver && (
                    <div className="truncate px-2 text-[11px] font-medium text-red-600">
                      Qty must be &lt;= on hand.
                    </div>
                  )}
                </td>
                <td className="p-1 text-center align-middle">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setIssue(current => {
                      if (!current) return current
                      const nextLines = current.lines.filter(candidate => candidate.id !== line.id)
                      return { ...current, lines: nextLines.length > 0 ? nextLines : [newLine()] }
                    })}
                    aria-label={`Delete line ${index + 1}`}
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
