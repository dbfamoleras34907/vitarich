import { findExistingItemBatch } from './goodsReceiptReferences'

export function findFirstExistingItemBatch(
  itemCode: string,
  manufacturingDate: string,
  expiryDate: string,
) {
  return findExistingItemBatch(itemCode, manufacturingDate, expiryDate, 'first')
}
