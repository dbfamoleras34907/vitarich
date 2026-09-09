import writeXlsxFile from 'write-excel-file/browser'

type TemplateCell = {
  value: string
  align?: 'left' | 'center'
  alignVertical?: 'center'
  backgroundColor?: string
  borderColor?: string
  borderStyle?: 'thin'
  columnSpan?: number
  fontWeight?: 'bold'
  height?: number
  textColor?: string
  wrap?: boolean
}

const TEMPLATE_HEADERS = [
  'Date Receive',
  'Time Receive',
  'Production Date',
  'DOC Source',
  'Building',
  'Hatchery Ref',
  'Average DOC Weight',
  'Total Received',
  'DOA Count',
  'Reject Count',
  'Short Count',
  'Short Count Remarks',
  'DOA Count Remarks',
  'Reject Count Remarks',
]

const INSTRUCTIONS = [
  ['Date Receive', 'Optional', 'Use YYYY-MM-DD. When blank, the DOC Receiving header date will be used. Future dates are not allowed.'],
  ['Time Receive', 'Optional', 'Use 24-hour HH:MM format.'],
  ['Production Date', 'Required', 'Use YYYY-MM-DD.'],
  ['DOC Source', 'Required', 'Enter the hatchery or other DOC source exactly as it should appear.'],
  ['Building', 'Required', 'Enter the Building code or the exact visible Code - Name under the Farm selected in DOC Receiving.'],
  ['Hatchery Ref', 'Optional', 'Enter the hatchery reference or transfer slip number.'],
  ['Average DOC Weight', 'Optional', 'Enter the average DOC weight in grams. Use numbers only.'],
  ['Total Received', 'Optional', 'Enter the total received quantity in pieces. Use a non-negative whole number.'],
  ['DOA Count', 'Optional', 'Enter the dead-on-arrival quantity in pieces. Use a non-negative whole number.'],
  ['Reject Count', 'Optional', 'Enter the rejected quantity in pieces. Use a non-negative whole number.'],
  ['Short Count', 'Optional', 'Enter the short quantity in pieces. Use a non-negative whole number.'],
  ['Short Count Remarks', 'Optional', 'Enter remarks when a short count needs explanation.'],
  ['DOA Count Remarks', 'Optional', 'Enter remarks when a DOA count needs explanation.'],
  ['Reject Count Remarks', 'Optional', 'Enter remarks when a reject count needs explanation.'],
]

const thinBorder = {
  borderColor: '#D6D3D1',
  borderStyle: 'thin' as const,
}

const headerCell = (value: string): TemplateCell => ({
  value,
  align: 'center',
  alignVertical: 'center',
  backgroundColor: '#1C1917',
  fontWeight: 'bold',
  textColor: '#FFFFFF',
  wrap: true,
  height: 32,
  ...thinBorder,
})

const instructionHeaderCell = (value: string): TemplateCell => ({
  value,
  backgroundColor: '#E7E5E4',
  fontWeight: 'bold',
  wrap: true,
  ...thinBorder,
})

export function getDocDetailsTemplateSheets() {
  const docDetailsData: TemplateCell[][] = [TEMPLATE_HEADERS.map(headerCell)]
  const instructionsData: TemplateCell[][] = [
    [
      {
        value: 'DOC Details Import Template Instructions',
        backgroundColor: '#1C1917',
        columnSpan: 3,
        fontWeight: 'bold',
        textColor: '#FFFFFF',
        height: 30,
      },
    ],
    [
      {
        value: 'Complete the DOC Details worksheet without changing its column names or order. The later import will populate the current DOC Details table only; it will not post the document. Actual Received is calculated automatically as Total Received minus DOA Count, Reject Count, and Short Count. If a Building has no active cycle, create the cycle in DOC Receiving after importing.',
        columnSpan: 3,
        wrap: true,
        height: 62,
      },
    ],
    ['Field', 'Requirement', 'Entry rules'].map(instructionHeaderCell),
    ...INSTRUCTIONS.map(row => row.map(value => ({
      value,
      alignVertical: 'center' as const,
      wrap: true,
      ...thinBorder,
    }))),
  ]

  return [
    {
      data: docDetailsData,
      sheet: 'DOC Details',
      columns: TEMPLATE_HEADERS.map((header, index) => ({
        width: index >= 11 ? 26 : Math.max(14, Math.min(header.length + 4, 22)),
      })),
      stickyRowsCount: 1,
      showGridLines: false,
      orientation: 'landscape' as const,
      zoomScale: 0.85,
    },
    {
      data: instructionsData,
      sheet: 'Instructions',
      columns: [{ width: 24 }, { width: 14 }, { width: 86 }],
      stickyRowsCount: 3,
      showGridLines: false,
      zoomScale: 0.95,
    },
  ]
}

export async function exportDocDetailsTemplate() {
  await writeXlsxFile(getDocDetailsTemplateSheets(), {
    fontFamily: 'Arial',
    fontSize: 10,
  }).toFile('doc-details-import-template.xlsx')
}
