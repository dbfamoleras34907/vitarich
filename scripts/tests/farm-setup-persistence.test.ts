import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeFarmSetupAddress } from '../../lib/data/farmSetupPersistence'

test('farm setup prefers the structured address saved by the wizard', () => {
  assert.deepEqual(
    normalizeFarmSetupAddress({
      farm: {
        address: 'Sitio Molave, Talus, Malungon, Sarangani',
        region: 'Sarangani',
      },
      address: {
        address: 'Sitio Molave',
        barangay: 'Talus',
        city: 'Malungon',
        province: 'Sarangani',
      },
    }),
    {
      address: 'Sitio Molave',
      barangay: 'Talus',
      city: 'Malungon',
      province: 'Sarangani',
    },
  )
})

test('farm setup retains the legacy combined address when no structured row exists', () => {
  assert.deepEqual(
    normalizeFarmSetupAddress({
      farm: {
        address: 'Legacy combined address',
        region: 'Legacy province',
      },
      address: null,
    }),
    {
      address: 'Legacy combined address',
      barangay: '',
      city: '',
      province: 'Legacy province',
    },
  )
})
