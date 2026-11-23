export const FEED_USAGE_UOM = "SACK";
export const FEED_USAGE_BASE_QTY_PER_BAG = 50;

export function feedBagsToBaseQty(quantity: number | null) {
  return quantity == null ? null : quantity * FEED_USAGE_BASE_QTY_PER_BAG;
}

export function feedBaseQtyToBags(quantity: number) {
  return quantity / FEED_USAGE_BASE_QTY_PER_BAG;
}

export function usesFeedBagQuantity(extra: Record<string, unknown>) {
  return extra.feedUsageUom === FEED_USAGE_UOM
    && Number(extra.feedUsageBaseQtyPerUnit) === FEED_USAGE_BASE_QTY_PER_BAG;
}
