"use client";

import FarmDateRangeParameters, {
  type FarmDateRangeParameterState,
  useFarmDateRangeParameters,
} from "@/components/filters/FarmDateRangeParameters";
export { isWithinHatcheryDateRange } from "@/lib/hatchery/listParameters";

export type HatcheryListParameterState = FarmDateRangeParameterState;

export function useHatcheryListParameters(): HatcheryListParameterState {
  return useFarmDateRangeParameters();
}

export default function HatcheryListParameters(
  parameters: HatcheryListParameterState,
) {
  return (
    <FarmDateRangeParameters {...parameters} farmType="HA" />
  );
}
