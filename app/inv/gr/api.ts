'use client'

export type GoodsReceiptStatus = 'Draft' | 'Received'

export type GoodsReceiptLine = {
  id: string
  itemId: number | null
  itemCode: string
  description: string
  altQty: number
  altUom: string
  baseQty: number
  baseUom: string
  warehouseId: number | null
  warehouseCode: string
  warehouseName: string
  returnedQty: number
}

export type GoodsReceipt = {
  id: string
  grNo: string
  vendor: string
  receiveDate: string
  farmId: number | null
  farmCode: string
  farmName: string
  defaultWarehouseId: number | null
  status: GoodsReceiptStatus
  lines: GoodsReceiptLine[]
  createdAt: string
}

const STORAGE_KEY = 'vita_goods_receipts'

const canUseStorage = () => typeof window !== 'undefined'

export function getGoodsReceipts(): GoodsReceipt[] {
  if (!canUseStorage()) return []

  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    const receipts = value ? JSON.parse(value) : []
    return Array.isArray(receipts) ? receipts : []
  } catch (error) {
    console.error('Unable to read goods receipts:', error)
    return []
  }
}

export function saveGoodsReceipt(receipt: GoodsReceipt) {
  const receipts = getGoodsReceipts()
  const existingIndex = receipts.findIndex(row => row.id === receipt.id)

  if (existingIndex >= 0) {
    receipts[existingIndex] = receipt
  } else {
    receipts.unshift(receipt)
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts))
  return receipt
}

export function createGoodsReceiptNumber(receipts = getGoodsReceipts()) {
  const year = new Date().getFullYear()
  const sequence = receipts.reduce((highest, receipt) => {
    const match = receipt.grNo.match(/(\d+)$/)
    return Math.max(highest, Number(match?.[1] ?? 0))
  }, 0) + 1

  return `GR-VAL-${String(year).slice(-2)}-${String(sequence).padStart(6, '0')}`
}

export function getReceiptItemSummary(receipt: GoodsReceipt) {
  const descriptions = receipt.lines
    .filter(line => line.itemCode)
    .map(line => line.description || line.itemCode)

  if (descriptions.length === 0) return '-'
  if (descriptions.length === 1) return descriptions[0]
  return `${descriptions[0]} +${descriptions.length - 1} more`
}
