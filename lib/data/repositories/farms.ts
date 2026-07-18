export const ACTIVE_FARM_VOID = 1
export const APPROVED_FARM_STATUS = 'approved'

type FarmFilterQuery = {
  eq: (column: string, value: string | number) => FarmFilterQuery
}

export function activeApprovedFarmsQuery<Query>(query: Query): Query {
  return (query as unknown as FarmFilterQuery)
    .eq('void', ACTIVE_FARM_VOID)
    .eq('approval_status', APPROVED_FARM_STATUS) as unknown as Query
}
