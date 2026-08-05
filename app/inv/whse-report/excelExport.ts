import type { WarehouseReportRow } from './api'

const xmlEscape = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

export function exportWarehouseReportExcel(rows: WarehouseReportRow[], includeBatch: boolean) {
  const headers = [
    'Date/Time', 'Warehouse Code', 'Warehouse Name', 'Document Type', 'Document No.',
    'Reference', 'Item Code', 'Item Name',
    ...(includeBatch ? ['Batch'] : []),
    'Transfer Type', 'Beginning Balance', 'IN Qty', 'OUT Qty', 'Running Total',
  ]

  const values = rows.map(row => [
    row.createdAt, row.warehouseCode, row.warehouseName, row.sourceDocType, row.documentNo,
    row.reference, row.itemCode, row.itemName,
    ...(includeBatch ? [row.batchNumber] : []),
    row.transferType, row.beginningBalance, row.inQty, row.outQty, row.runningBalance,
  ])

  const worksheetRows = [headers, ...values]
    .map((row, rowIndex) => `<Row>${row.map(value => {
      const numeric = typeof value === 'number'
      return `<Cell${rowIndex === 0 ? ' ss:StyleID="Header"' : ''}><Data ss:Type="${numeric ? 'Number' : 'String'}">${xmlEscape(value)}</Data></Cell>`
    }).join('')}</Row>`)
    .join('')

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#E7E5E4" ss:Pattern="Solid"/></Style></Styles>
 <Worksheet ss:Name="Warehouse Report"><Table>${worksheetRows}</Table></Worksheet>
</Workbook>`

  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `warehouse-report-${new Date().toISOString().slice(0, 10)}.xls`
  link.click()
  URL.revokeObjectURL(url)
}
