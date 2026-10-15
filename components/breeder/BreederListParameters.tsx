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
  ...parameters
}: BreederListParameterState & {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <FarmDateRangeParameters {...parameters} farmType="BE" className={className}>
      {children}
    </FarmDateRangeParameters>
  );
}
