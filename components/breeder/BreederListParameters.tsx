"use client";

import FarmDateRangeParameters, {
  type FarmDateRangeParameterState,
  useFarmDateRangeParameters,
} from "@/components/filters/FarmDateRangeParameters";

export { isWithinDateRange } from "@/lib/filters/dateRange";
export type BreederListParameterState = FarmDateRangeParameterState;

export function useBreederListParameters(): BreederListParameterState {
  return useFarmDateRangeParameters();
}

export default function BreederListParameters({
  children,
  className,
  showDateRange,
  ...parameters
}: BreederListParameterState & {
  children?: React.ReactNode;
  className?: string;
  showDateRange?: boolean;
}) {
  return (
    <FarmDateRangeParameters
      {...parameters}
      farmType="BE"
      className={className}
      showDateRange={showDateRange}
    >
      {children}
    </FarmDateRangeParameters>
  );
}
