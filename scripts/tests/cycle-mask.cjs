const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const source = fs.readFileSync(path.resolve(__dirname, '../../lib/broiler/cycleMask.ts'), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const mod = { exports: {} }
new Function('module', 'exports', code)(mod, mod.exports)
const { formatCycleMask } = mod.exports
assert.equal(formatCycleMask(1003, '2026-09-15'), '09261003')
assert.equal(formatCycleMask(3, '2026-01-01'), '01260003')
assert.equal(formatCycleMask(10000, '2027-12-31'), '122710000')
assert.equal(formatCycleMask('001003', '2026-09-15'), '09261003')
assert.equal(formatCycleMask(1003, '2026-02-30'), '')
assert.equal(formatCycleMask(1003, null), '')
assert.equal(formatCycleMask('legacy', '2026-09-15'), '')
const { getBroilerCycleDisplay } = mod.exports
assert.equal(getBroilerCycleDisplay({ cycle_mask: '09261003', doc_farm_cycles: { cycle_mask: '08261003' } }), '08261003')
assert.equal(getBroilerCycleDisplay({ cycle_mask: '09261003', doc_farm_cycles: [{ cycle_mask: '08261003' }] }), '08261003')
assert.equal(getBroilerCycleDisplay({ cycle_mask: '09261003' }), '09261003')
assert.equal(getBroilerCycleDisplay({}), '')
console.log('Cycle mask tests passed')
