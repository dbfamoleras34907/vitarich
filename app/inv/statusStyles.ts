const INVENTORY_STATUS_BADGE_BASE =
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold'

export const getInventoryStatusBadgeClass = (status: string) => {
  if (status === 'Posted') {
    return `${INVENTORY_STATUS_BADGE_BASE} bg-emerald-100 text-emerald-800`
  }

  if (status === 'Cancelled') {
    return `${INVENTORY_STATUS_BADGE_BASE} bg-red-100 text-red-700`
  }

  return `${INVENTORY_STATUS_BADGE_BASE} bg-stone-100 text-stone-700`
}
