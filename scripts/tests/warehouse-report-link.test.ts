import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildBatchWarehouseReportHref,
  getCanonicalBatchFarmId,
  isDateInput,
} from '../../lib/reports/warehouseReportLink'

test('builds a Warehouse Report link from the earliest batch movement', () => {
  const href = buildBatchWarehouseReportHref(
    'DOC:F158:B721:1',
    [
      { createdAt: '2026-09-26T09:00:00+08:00', warehouseCode: 'WH-0000216' },
      { createdAt: '2026-09-25T08:40:00+08:00', warehouseCode: 'BD-0000204' },
    ],
    new Date('2026-10-28T14:00:00+08:00'),
  )

  assert.equal(
    href,
    '/inv/whse-report?source=batchTrail&farmId=158&warehouse=BD-0000204&from=2026-09-25&to=2026-10-28',
  )
})

test('requires a canonical batch farm and a dated warehouse movement', () => {
  assert.equal(getCanonicalBatchFarmId('DOC:F158:B721:1'), 158)
  assert.equal(getCanonicalBatchFarmId('SOURCE-BATCH-1'), null)
  assert.equal(buildBatchWarehouseReportHref('SOURCE-BATCH-1', []), '')
})

test('accepts only valid date input values', () => {
  assert.equal(isDateInput('2026-10-28'), true)
  assert.equal(isDateInput('2026-02-31'), false)
  assert.equal(isDateInput('2026-10'), false)
  assert.equal(isDateInput('not-a-date'), false)
})
