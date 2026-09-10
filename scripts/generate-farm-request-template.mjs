import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import ts from 'typescript'
import writeXlsxFile from 'write-excel-file/node'
import { getOrderOfSiblings, insertElementMarkupAccordingToOrderOfSiblings, sanitizeTextContent } from 'write-excel-file/utility'
import readXlsxFile from 'read-excel-file/node'
import assert from 'node:assert/strict'

// Reuse the same profile choices as the first stage of Farm Setup.
const source = await readFile(resolve('lib/farmProfileOptions.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { FARM_PROFILE_FIELDS } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const fields = [
  ['Farm Code', 'Leave blank. Assigned automatically during farm setup.'],
  ['Farm Name', 'Required. Enter the farm site name.'],
  ['Farm Type', 'Required. Select from the dropdown.'],
  ...FARM_PROFILE_FIELDS.map(field => [field.label, 'Optional. Select from the dropdown.']),
  ['TIN No.', 'Required. Enter the registered TIN.'],
  ['Contact Person', 'Required. Enter the primary site contact.'],
  ['Contact Number', 'Required. Enter the mobile or direct line.'],
  ['Telephone No.', 'Required. Enter the site landline.'],
  ['Address', 'Required. Enter the street, sitio, or site address.'],
  ['Barangay', 'Required. Enter the barangay.'],
  ['City / Municipality', 'Required. Enter the city or municipality.'],
  ['Province', 'Required. Enter the province.'],
  ['Number of Buildings', 'Required. Enter a whole number of buildings (0 or more).'],
]

const border = { borderColor: '#D1D5DB', borderStyle: 'thin' }
const cell = (value, extra = {}) => ({ value, wrap: true, alignVertical: 'center', ...border, ...extra })
const heading = value => cell(value, { backgroundColor: '#00754A', textColor: '#FFFFFF', fontWeight: 'bold', height: 28 })
const data = [
  [{ ...heading('Farm Master Addition Request'), columnSpan: 3, height: 34 }, null, null],
  [cell('Complete one form per farm. Enter information in the pale blue cells. Select dropdown fields using the arrow shown when the cell is selected.', { columnSpan: 3, height: 34 }), null, null],
  ['Field', 'Request Details', 'Instructions'].map(heading),
  ...fields.map(([label, hint]) => [
    cell(label, { fontWeight: 'bold', backgroundColor: '#F3F4F6', height: 36 }),
    cell('', { type: String, backgroundColor: label === 'Farm Code' ? '#E5E7EB' : '#EFF6FF', ...(label === 'Number of Buildings' ? {} : { format: '@' }), textColor: '#1D4ED8' }),
    cell(hint),
  ]),
]
const dropdownFields = [
  { label: 'Farm Type', options: ['Breeder Farm', 'Hatcher', 'Broiler'] },
  ...FARM_PROFILE_FIELDS,
]
const choices = [
  ['Field', 'Accepted Value'].map(heading),
  ...dropdownFields.flatMap(field => field.options.map(value => [cell(field.label, { height: 28 }), cell(value)])),
]

// Follow the existing Excel template feature hook. INDIRECT supports a list on
// another worksheet without Excel's inline-list length limit (notably Region).
let nextChoiceRow = 2
const validations = dropdownFields.map(field => {
  const startRow = nextChoiceRow
  nextChoiceRow += field.options.length
  const targetRow = fields.findIndex(([label]) => label === field.label) + 4
  assert.ok(targetRow >= 4, `Missing request field: ${field.label}`)
  const formula = `INDIRECT("'Choices'!$B$${startRow}:$B$${nextChoiceRow - 1}")`
  return `<dataValidation type="list" allowBlank="${field.label === 'Farm Type' ? '0' : '1'}" showDropDown="0" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid selection" error="Select a value from the dropdown list." sqref="B${targetRow}"><formula1>${sanitizeTextContent(formula)}</formula1></dataValidation>`
})
const dropdownFeature = {
  files: {
    transform: {
      'xl/worksheets/sheet{id}.xml': {
        transform: (xml, _sheetOptions, { sheetIndex }) => sheetIndex !== 0 ? xml : insertElementMarkupAccordingToOrderOfSiblings(
          xml,
          `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`,
          getOrderOfSiblings('xl/worksheets/sheet{id}.xml', 'worksheet') ?? [],
          'worksheet',
        ),
      },
    },
  },
}
const output = resolve('public/templates/farm-master-addition.xlsx')
await mkdir(resolve('public/templates'), { recursive: true })
await writeXlsxFile([
  { sheet: 'Farm Master Addition', data, columns: [{ width: 25 }, { width: 44 }, { width: 55 }], stickyRowsCount: 3, showGridLines: false, orientation: 'landscape' },
  { sheet: 'Choices', data: choices, columns: [{ width: 25 }, { width: 76 }], stickyRowsCount: 1, showGridLines: false },
], { fontFamily: 'Arial', fontSize: 10, features: [dropdownFeature] }).toFile(output)

// Read back the delivered file to verify all labels, blank inputs, and choices.
const savedSheets = await readXlsxFile(output)
const { data: rows } = savedSheets.find(sheet => sheet.sheet === 'Farm Master Addition')
assert.deepEqual(rows.slice(3).map(row => row[0]), fields.map(field => field[0]))
assert.ok(rows.slice(3).every(row => row[1] === null))
const { data: choiceRows } = savedSheets.find(sheet => sheet.sheet === 'Choices')
assert.equal(choiceRows.length, choices.length)
assert.deepEqual(choiceRows.slice(1), choices.slice(1).map(row => row.map(entry => entry.value)))
console.log(`Verified ${fields.length} request fields and ${choiceRows.length - 1} choice entries: ${output}`)
