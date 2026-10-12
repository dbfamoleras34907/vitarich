// Run: node scripts/tests/doc-placement-window.cjs
// Verifies that the seven-day DOC placement anchor ignores reversed documents.
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')

function loadApi(rows) {
  const filters = []
  const query = {
    select(columns) {
      assert.match(columns, /goods_receipt!inner\(status\)/)
      return query
    },
    in(field, values) {
      filters.push([field, values])
      return query
    },
    eq(field, value) {
      filters.push([field, [value]])
      return query
    },
    not() {
      return query
    },
    order(field, { ascending }) {
      assert.equal(field, 'receive_date')
      assert.equal(ascending, true)
      return query
    },
    then(resolve, reject) {
      const filtered = rows
        .filter(row => filters.every(([field, values]) => {
          const actual = field === 'goods_receipt.status'
            ? row.goods_receipt.status
            : row[field]
          return values.some(value => String(value) === String(actual))
        }))
        .sort((left, right) => left.receive_date.localeCompare(right.receive_date))
      return Promise.resolve({ data: filtered, error: null }).then(resolve, reject)
    },
  }
  const db = {
    from(table) {
      assert.equal(table, 'goods_receipt_doc')
      return query
    },
  }
  const source = fs.readFileSync(path.join(root, 'app/inv/doc-receiving/api.ts'), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const mod = { exports: {} }
  const localRequire = specifier => {
    if (specifier === '@/lib/Supabase/supabaseClient') return { db }
    if (specifier === '@/lib/data/repositories/receivingSources') return {}
    return require(specifier)
  }
  new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports)
  return mod.exports
}

async function run() {
  const rows = [
    { flock_card_id: 10, receive_date: '2026-08-01', void: '1', goods_receipt: { status: 'Reversed' } },
    { flock_card_id: 10, receive_date: '2026-08-03', void: '1', goods_receipt: { status: 'Posted' } },
    { flock_card_id: 10, receive_date: '2026-08-04', void: '1', goods_receipt: { status: 'Draft' } },
    { flock_card_id: 20, receive_date: '2026-08-02', void: '1', goods_receipt: { status: 'Reversed' } },
    { flock_card_id: 30, receive_date: '2026-08-05', void: '0', goods_receipt: { status: 'Posted' } },
  ]
  const { getFirstDocPlacementDates } = loadApi(rows)
  assert.deepEqual(await getFirstDocPlacementDates([10, 20, 30]), { 10: '2026-08-03' })
  assert.deepEqual(await getFirstDocPlacementDates([20]), {})
  assert.deepEqual(await getFirstDocPlacementDates([]), {})
  console.log('DOC placement window tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
