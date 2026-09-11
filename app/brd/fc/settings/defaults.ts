import type { AutoFeedBatchSelectionMode } from "./api";

export type GrowingFarmConditionDefaults = {
  feed_group_id: number | null;
  allow_advance_posting: boolean;
  auto_feed_batch_selection: boolean;
  auto_feed_batch_selection_mode: AutoFeedBatchSelectionMode;
  auto_mortality_rate_batch_selection: boolean;
};

/**
 * Initial Growing & Farm Condition values shown for a farm that does not have
 * saved settings yet. Edit these values when the setup defaults change.
 *
 * Feed inventory is selected from the farm feed warehouse.
 */
export const GROWING_FARM_CONDITION_DEFAULTS: GrowingFarmConditionDefaults = {
  feed_group_id: null,
  allow_advance_posting: false,
  auto_feed_batch_selection: true,
  auto_feed_batch_selection_mode: "FIFO",
  auto_mortality_rate_batch_selection: true,
};
