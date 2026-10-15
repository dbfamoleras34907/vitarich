export const DOC_PLACEMENT_WINDOW_LAST_DAY_OFFSET = 6

export function isOutsideDocPlacementWindow(
  age: number,
  suppressCondition = false,
) {
  return !suppressCondition && (
    age < 0 || age > DOC_PLACEMENT_WINDOW_LAST_DAY_OFFSET
  )
}
