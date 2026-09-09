export type FeedWarehouseAssociation = {
  id?: number | null;
  whse_code?: string | null;
  whse_name?: string | null;
  is_default_feed?: boolean | null;
  is_default_disposal?: boolean | null;
};

export type FlockCardNavigationContext = {
  farmId?: number | string | null;
  buildingKey?: string | null;
  buildingId?: number | string | null;
  brdFcId?: number | string | null;
  dailyFlockCardId?: number | string | null;
  flockCardId?: number | string | null;
  cardNo?: string | null;
  flockCode?: string | null;
  flockAge?: number | string | null;
  flockStartDate?: string | null;
  animalQty?: number | string | null;
  breed?: string | null;
};

export type FeedFarm = {
  id: number;
  code: string;
  name: string | null;
  associated_warehouses?: FeedWarehouseAssociation[] | string[] | null;
  farm_id?: number | null;
  farm_code?: string | null;
  farm_name?: string | null;
};

export type FeedBatchDialogMode = "onHand" | "cell";

export type FeedBatchAllocation = {
  batchId: string;
  batchNumber: string;
  itemCode: string;
  itemName: string;
  warehouseCode: string;
  manufacturingDate: string;
  expiryDate: string;
  availableQty: number;
  selectedQty: number;
  source: "MANUAL" | "FIFO";
};

export type MortalityBatchAllocation = {
  batchId: string;
  batchNumber: string;
  itemCode: string;
  itemName: string;
  warehouseCode: string;
  availableQty: number;
  selectedQty: number;
  source: "MANUAL" | "FIFO";
};

export type FlockCardSettingsState = {
  feed_group_id?: number | null;
  feed_group?: {
    id?: number;
    code?: string;
    name?: string;
    father?: number | null;
  } | null;
  allow_advance_posting?: boolean;
  auto_feed_batch_selection?: boolean;
  auto_feed_batch_selection_mode?: "USER_SELECTED" | "FIFO";
  auto_mortality_rate_batch_selection?: boolean;
};
