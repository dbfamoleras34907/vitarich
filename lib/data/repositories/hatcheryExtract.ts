import { db } from '@/lib/Supabase/supabaseClient'
import type { HatcheryExtractData, HatcheryExtractModuleKey } from './hatcheryExtract.shared'

export {
  HATCHERY_EXTRACT_MODULES,
  type HatcheryExtractData,
  type HatcheryExtractModuleData,
  type HatcheryExtractModuleKey,
  type HatcheryExtractRow,
} from './hatcheryExtract.shared'

export async function getHatcheryExtractData(params: {
  dateFrom: string
  dateTo: string
  moduleKeys: HatcheryExtractModuleKey[]
}): Promise<HatcheryExtractData> {
  const { data: sessionData, error: sessionError } = await db.auth.getSession()
  if (sessionError) throw sessionError
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Your session has expired. Sign in again to extract Hatchery data.')

  const response = await fetch('/api/a_dean/hatchery/extract-data', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })
  const result = await response.json() as HatcheryExtractData & { error?: string }
  if (!response.ok) throw new Error(result.error || 'Unable to extract Hatchery data.')
  return result
}
