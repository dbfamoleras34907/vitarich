import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'
import writeXlsxFile from 'write-excel-file/node'
import readXlsxFile from 'read-excel-file/node'
import { getOrderOfSiblings, insertElementMarkupAccordingToOrderOfSiblings, sanitizeTextContent } from 'write-excel-file/utility'

const require = createRequire(import.meta.url)
const { unzipSync, strFromU8 } = require('fflate')
const verifyFixture = process.argv.includes('--verify-fixture')
require('@next/env').loadEnvConfig(process.cwd(), false, { info() {}, error() {} })
const catalogKey = process.argv.includes('--catalog-admin')
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
assert.ok(catalogKey, 'The requested catalog credential is not configured.')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, catalogKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Execute existing catalog reads unchanged. --catalog-admin is only for this
// offline build when RLS requires authentication. No credential is exported,
// and no runtime/public data API or business mutation is added.
async function loadReferenceModule(path) {
  const source = await readFile(resolve(path), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const loaded = { exports: {} }
  const referenceRequire = name => {
    if (name === '@/lib/Supabase/supabaseClient') return { db }
    if (name === '@/lib/network/http') return {}
    throw new Error(`Unexpected reference module dependency: ${name}`)
  }
  new Function('require', 'module', 'exports', compiled)(referenceRequire, loaded, loaded.exports)
  return loaded.exports
}
const groupRepository = await loadReferenceModule('lib/data/repositories/itemGroups.ts')
const itemRepository = await loadReferenceModule('app/a_dean/items/api.ts')
const [roots, subGroups, uomGroups] = verifyFixture ? [
  [{ id: 1, code: 'TEST-A', name: 'Example A' }, { id: 2, code: 'TEST-B', name: 'Example B' }],
  [1, 2, 3].flatMap(level => [1, 2].map(root => ({ id: root * 10 + level, code: `TEST-${root}-${level}`, name: `Example level ${level}`, root_item_group_id: root, subgroup_level: level }))),
  [{ id: 1, code: 'TEST-UOM', name: 'Example UoM', baseUomCode: 'EA' }],
] : await Promise.all([
  groupRepository.getRootItemGroups(), groupRepository.getSubItemGroups(), itemRepository.getItemUomGroups(),
])
assert.ok(roots.length && uomGroups.length, 'Reference lists are empty or inaccessible; do not publish an incomplete template.')

const fields = [
  ['Item Code', 'Leave blank. Generated from Item Group when the item is created.'],
  ['Item Name', 'Required. Enter the item name.'],
  ['Barcode', 'Optional. Enter as text to preserve leading zeroes.'],
  ['Item Group', 'Required. Select from the dropdown.'],
  ...[1, 2, 3].map(level => [`Sub Group Level ${level}`, 'Optional. Select Item Group first, then complete levels in order. Clear lower levels when changing a selection.']),
  ['FMS Group', 'Required. Select from the dropdown.'],
  ['UoM Group', 'Required. Select from the dropdown. The group determines the base UoM.'],
  ['Description', 'Optional. Enter the item description.'],
  ...['Inventory', 'Sales', 'Purchase', 'Delivery', 'Manage by Batch'].map(label => [label, 'Select Yes or No.']),
  ['Min On Hand', 'Optional. Enter a number greater than or equal to 0.'],
  ['Max On Hand', 'Optional. Enter a number greater than or equal to Min On Hand (and 0).'],
  ['Default Expiration in Months', 'Optional. Enter a whole number greater than or equal to 0.'],
]
const inputCell = label => {
  const index = fields.findIndex(field => field[0] === label)
  assert.ok(index >= 0, `Missing field: ${label}`)
  return `$B$${index + 4}`
}
const border = { borderColor: '#D1D5DB', borderStyle: 'thin' }
const cell = (value, extra = {}) => ({ value, wrap: true, alignVertical: 'center', ...border, ...extra })
const heading = value => cell(value, { backgroundColor: '#00754A', textColor: '#FFFFFF', fontWeight: 'bold', height: 28 })
const choices = [['Field', 'Item Group', 'Accepted Value'].map(heading)]
const groupLookup = [
  ['Item Group', 'Level 1 Range', 'Level 2 Range', 'Level 3 Range'].map(heading),
  ...roots.map(root => [cell(`${root.code} - ${root.name}`), cell('EmptySubgroup'), cell('EmptySubgroup'), cell('EmptySubgroup')]),
]
const definedNames = [
  { name: 'EmptySubgroup', reference: "'Choices'!$Z$1" },
  { name: 'SubgroupMap', reference: `'Group Lookup'!$A$2:$D$${roots.length + 1}` },
]
const validations = []
const xmlRule = (label, formula, required = false, type = 'list', operator = '') => {
  validations.push(`<dataValidation type="${type}"${operator ? ` operator="${operator}"` : ''} allowBlank="${required ? '0' : '1'}" showDropDown="0" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid entry" error="Use the dropdown or follow the field instructions." sqref="${inputCell(label).replaceAll('$', '')}"><formula1>${sanitizeTextContent(formula)}</formula1></dataValidation>`)
}
const range = (column, start, end) => `INDIRECT("'Choices'!$${column}$${start}:$${column}$${end}")`
const groupLabel = group => `${group.code} - ${group.name}`
function addList(label, values, required = false) {
  assert.ok(values.length, `Empty dropdown: ${label}`)
  const start = choices.length + 1
  choices.push(...values.map(value => [cell(label), cell(''), cell(value, { height: 30 })]))
  xmlRule(label, range('C', start, choices.length), required)
}
addList('Item Group', roots.map(groupLabel), true)
for (const level of [1, 2, 3]) {
  const label = `Sub Group Level ${level}`
  for (const [rootIndex, root] of roots.entries()) {
    const start = choices.length + 1
    const matches = subGroups.filter(group => Number(group.root_item_group_id) === Number(root.id) && Number(group.subgroup_level) === level)
    choices.push(...matches.map(group => [cell(label), cell(groupLabel(root)), cell(groupLabel(group), { height: 30 })]))
    if (matches.length) {
      const name = `Subgroup_${rootIndex + 1}_L${level}`
      definedNames.push({ name, reference: `'Choices'!$C$${start}:$C$${choices.length}` })
      groupLookup[rootIndex + 1][level] = cell(name)
    }
  }
  const rootCell = inputCell('Item Group')
  const previousCell = inputCell(level === 1 ? 'Item Group' : `Sub Group Level ${level - 1}`)
  // The outer INDIRECT returns an actual range to Excel's validation engine.
  // IF/IFERROR around OFFSET can instead yield values rather than a range.
  xmlRule(label, `INDIRECT(IF(${previousCell}="","EmptySubgroup",IFERROR(VLOOKUP(${rootCell},SubgroupMap,${level + 1},FALSE),"EmptySubgroup")))`)
}
addList('FMS Group', ['Breeder', 'Hatchery', 'Broiler'], true)
addList('UoM Group', uomGroups.map(groupLabel), true)
for (const label of ['Inventory', 'Sales', 'Purchase', 'Delivery', 'Manage by Batch']) addList(label, ['Yes', 'No'])
xmlRule('Min On Hand', '0', false, 'decimal', 'greaterThanOrEqual')
xmlRule('Max On Hand', `MAX(0,${inputCell('Min On Hand')})`, false, 'decimal', 'greaterThanOrEqual')
xmlRule('Default Expiration in Months', '0', false, 'whole', 'greaterThanOrEqual')
const data = [
  [{ ...heading('Item Master Addition Request'), columnSpan: 3, height: 34 }, null, null],
  [cell('Complete one form per item. Fill the pale blue cells; use dropdown arrows for selections. Choose Sub Group levels in order and clear lower selections if Item Group or an earlier level changes.', { columnSpan: 3, height: 46 }), null, null],
  ['Field', 'Request Details', 'Instructions'].map(heading),
  ...fields.map(([label, hint]) => [
    cell(label, { fontWeight: 'bold', backgroundColor: '#F3F4F6', height: label.startsWith('Sub Group') ? 48 : 36 }),
    cell('', { type: String, backgroundColor: label === 'Item Code' ? '#E5E7EB' : '#EFF6FF', ...(['Barcode', 'Item Name', 'Description'].includes(label) ? { format: '@' } : {}) }),
    cell(hint),
  ]),
]
const feature = { files: { transform: { 'xl/worksheets/sheet{id}.xml': {
  transform: (xml, _options, { sheetIndex }) => sheetIndex !== 0 ? xml : insertElementMarkupAccordingToOrderOfSiblings(
    xml, `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`,
    getOrderOfSiblings('xl/worksheets/sheet{id}.xml', 'worksheet') ?? [], 'worksheet',
  ),
}, 'xl/workbook.xml': {
  transform: xml => {
    const markup = `<definedNames>${definedNames.map(({ name, reference }) => `<definedName name="${name}">${sanitizeTextContent(reference)}</definedName>`).join('')}</definedNames>`
    if (xml.includes('<definedNames/>')) return xml.replace('<definedNames/>', markup)
    return insertElementMarkupAccordingToOrderOfSiblings(
      xml, markup, getOrderOfSiblings('xl/workbook.xml', 'workbook') ?? [], 'workbook',
    )
  },
} } } }
const output = verifyFixture
  ? resolve(tmpdir(), 'vitarich-item-request-template-fixture.xlsx')
  : resolve('public/templates/item-master-addition.xlsx')
if (!verifyFixture) await mkdir(resolve('public/templates'), { recursive: true })
await writeXlsxFile([
  { sheet: 'Item Master Addition', data, columns: [{ width: 32 }, { width: 52 }, { width: 62 }], stickyRowsCount: 3, showGridLines: false, orientation: 'landscape' },
  { sheet: 'Choices', data: choices, columns: [{ width: 28 }, { width: 42 }, { width: 68 }], stickyRowsCount: 1, showGridLines: false },
  { sheet: 'Group Lookup', data: groupLookup, columns: [{ width: 42 }, { width: 28 }, { width: 28 }, { width: 28 }], stickyRowsCount: 1, showGridLines: false },
], { fontFamily: 'Arial', fontSize: 10, features: [feature] }).toFile(output)
const saved = await readXlsxFile(output)
assert.deepEqual(saved[0].data.slice(3).map(row => row[0]), fields.map(field => field[0]))
assert.ok(saved[0].data.slice(3).every(row => row[1] === null))
assert.equal(saved[1].data.length, choices.length)
assert.deepEqual(saved[1].data.slice(1), choices.slice(1).map(row => row.map(entry => entry.value || null)))
const zip = unzipSync(await readFile(output))
const sheetXml = strFromU8(zip['xl/worksheets/sheet1.xml'])
assert.equal((sheetXml.match(/<dataValidation /g) ?? []).length, 14)
assert.equal((sheetXml.match(/type="list"/g) ?? []).length, 11)
for (const rule of validations) assert.ok(sheetXml.includes(rule), 'An exported validation is missing or changed.')
for (const level of [1, 2, 3]) {
  const rule = validations.find(value => value.includes(`sqref="${inputCell(`Sub Group Level ${level}`).replaceAll('$', '')}"`))
  if (verifyFixture) {
    assert.ok(rule.includes(`VLOOKUP($B$7,SubgroupMap,${level + 1},FALSE)`), 'Subgroups must match the selected Item Group.')
    assert.ok(rule.includes(level === 1 ? '$B$7=' : `$B$${level + 6}=`), 'Deeper subgroup selections require the preceding level.')
  }
}
const workbookXml = strFromU8(zip['xl/workbook.xml'])
assert.equal((workbookXml.match(/<definedNames[\s/>]/g) ?? []).length, 1)
for (const { name, reference } of definedNames) {
  assert.ok(workbookXml.includes(`<definedName name="${name}">${sanitizeTextContent(reference)}</definedName>`))
}
for (const [rootIndex, root] of roots.entries()) {
  for (const level of [1, 2, 3]) {
    const rangeName = saved[2].data[rootIndex + 1][level]
    const definition = definedNames.find(entry => entry.name === rangeName)
    assert.ok(definition, `Missing named range for ${groupLabel(root)}, level ${level}`)
    const bounds = definition.reference.match(/\$C\$(\d+):\$C\$(\d+)/)
    const actual = bounds ? saved[1].data.slice(Number(bounds[1]) - 1, Number(bounds[2])).map(row => row[2]) : []
    const expected = subGroups.filter(group => Number(group.root_item_group_id) === Number(root.id) && Number(group.subgroup_level) === level).map(groupLabel)
    assert.deepEqual(actual, expected)
    if (root.code === 'FEED') console.log(`Verified FEED Level ${level}: ${actual.length} choices.`)
  }
}
console.log(`Verified ${fields.length} fields, ${validations.length} validations; ${roots.length} item groups, ${subGroups.length} subgroups, ${uomGroups.length} UoM groups.`)
if (verifyFixture) console.log('Synthetic fixture only; no public workbook was created.')
