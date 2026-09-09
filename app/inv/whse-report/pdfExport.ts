import type { WarehouseReportRow } from './api'

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const quantity = (value: number) => Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 6 })

export function printWarehouseReport(
  rows: WarehouseReportRow[],
  options: { from: string; to: string; includeBatch: boolean },
) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) throw new Error('Allow pop-ups to print or save the report as PDF.')

  const batchHeader = options.includeBatch ? '<th>Batch</th>' : ''
  const body = rows.map(row => `<tr>
    <td>${escapeHtml(new Date(row.createdAt).toLocaleString('en-PH'))}</td>
    <td>${escapeHtml(`${row.warehouseCode} - ${row.warehouseName}`)}</td>
    <td>${escapeHtml(row.sourceDocType)}</td>
    <td>${escapeHtml(row.documentNo)}</td>
    <td>${escapeHtml(row.reference)}</td>
    <td>${escapeHtml(`${row.itemCode} - ${row.itemName}`)}</td>
    ${options.includeBatch ? `<td>${escapeHtml(row.batchNumber || '-')}</td>` : ''}
    <td>${escapeHtml(row.transferType)}</td>
    <td class="number">${quantity(row.beginningBalance)}</td>
    <td class="number">${quantity(row.inQty)}</td>
    <td class="number">${quantity(row.outQty)}</td>
    <td class="number">${quantity(row.runningBalance)}</td>
  </tr>`).join('')

  printWindow.document.write(`<!doctype html><html><head><title>Warehouse Report</title>
    <style>
      @page { size: landscape; margin: 10mm; }
      body { font-family: Arial, sans-serif; color: #1c1917; font-size: 10px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      p { margin: 0 0 12px; color: #57534e; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #a8a29e; padding: 5px; text-align: left; vertical-align: top; }
      th { background: #e7e5e4; white-space: nowrap; }
      .number { text-align: right; white-space: nowrap; }
    </style></head><body>
    <h1>Warehouse Report</h1>
    <p>${escapeHtml(options.from || 'Beginning')} to ${escapeHtml(options.to || 'Today')}</p>
    <table><thead><tr>
      <th>Date/Time</th><th>Warehouse</th><th>Document Type</th><th>Document No.</th>
      <th>Reference</th><th>Item</th>${batchHeader}<th>Type</th>
      <th>Beginning Balance</th><th>IN</th><th>OUT</th><th>Running Total</th>
    </tr></thead><tbody>${body}</tbody></table>
    <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`)
  printWindow.document.close()
}
