export const QUANTITY_TOLERANCE = 0.000001

export function quantityExceeds(usedQuantity: number, availableQuantity: number) {
  return usedQuantity - availableQuantity > QUANTITY_TOLERANCE
}

