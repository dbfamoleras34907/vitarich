import type { BrDeliverySettings } from "./api";

export type HarvestDeliveryDefaults = Pick<
  BrDeliverySettings,
  "batch_auto_selection" | "target_delivery_age"
>;

/**
 * Initial Harvest & Delivery values shown for a farm that does not have saved
 * settings yet. Edit these values when the Farm Setup defaults change.
 */
export const HARVEST_DELIVERY_DEFAULTS: HarvestDeliveryDefaults = {
  target_delivery_age: 28,
  batch_auto_selection: true,
};
