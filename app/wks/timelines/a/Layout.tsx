
// app/wks/tasks/Layout.tsx
'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'


import { Button } from '@/components/ui/button'
import { ColumnConfig } from '@/components/ui/DataTable'
import DynamicTable from '@/components/ui/DataTableV2'
import Breadcrumb from '@/lib/Breadcrumb'
import { RowDataKey } from '@/lib/Defaults/DefaultTypes'
import {
  Calendar,
  Loader2,
  Mail,
  Printer,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getTimesheets } from './api'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function Layout() {
  const route = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)

  const [emailOpen, setEmailOpen] = useState(false)
  const [emailFrom, setEmailFrom] = useState('')
  const [emailTo, setEmailTo] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  const [initialRows, setInitialRows] = useState<RowDataKey[]>([])
  const [filteredRows, setFilteredRows] = useState<RowDataKey[]>([])

  // DATE RANGE
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const tableColumnsx: ColumnConfig[] = useMemo(
    () => [
      { key: 'doc_date', label: 'Date', type: 'text' },
      { key: 'project_name', label: 'Project', type: 'text' },
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'remarks', label: 'Remarks', type: 'text' },
      { key: 'from_time', label: 'Time From', type: 'text' },
      { key: 'hrs', label: 'Hr(s)', type: 'text' },
    ],
    []
  )

  // PREFETCH
  useEffect(() => {
    route.prefetch('/wks/timelines/new')
  }, [])

  // LOAD DATA
  useEffect(() => {
    const loadTasks = async () => {
      setLoading(true)

      try {
        const data = await getTimesheets()

        console.log('Fetched Timesheets:', data)

        setInitialRows(data)
        setFilteredRows(data)
      } catch (err) {
        console.error(err)
      }

      setLoading(false)
    }

    loadTasks()
  }, [])

  // PREFETCH DETAILS
  useEffect(() => {
    initialRows.forEach((row) => {
      route.prefetch(`/wks/tasks/${row.id}`)
    })
  }, [initialRows])

  // FILTER DATE RANGE
  useEffect(() => {
    let filtered = [...initialRows]

    if (dateFrom) {
      filtered = filtered.filter((row) => {
        if (!row.doc_date) return false

        const rowDate = new Date(row.doc_date)
        const fromDate = new Date(dateFrom)

        return rowDate >= fromDate
      })
    }

    if (dateTo) {
      filtered = filtered.filter((row) => {
        if (!row.doc_date) return false

        const rowDate = new Date(row.doc_date)

        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999)

        return rowDate <= toDate
      })
    }

    setFilteredRows(filtered)
  }, [dateFrom, dateTo, initialRows])

  // PRINT TABLE
  // PRINT TABLE
  const handlePrint = () => {
    const printWindow = window.open('', '_blank')

    if (!printWindow) return

    // GROUP BY DATE
    const groupedRows: Record<string, RowDataKey[]> = {}

    filteredRows.forEach((row) => {
      const date = row.doc_date || 'No Date'

      if (!groupedRows[date]) {
        groupedRows[date] = []
      }

      groupedRows[date].push(row)
    })

    const tableRows = Object.entries(groupedRows)
      .map(([date, rows]) => {
        return rows
          .map((row, index) => {
            return `
            <tr>
              ${index === 0
                ? `
                    <td class="group-date" rowspan="${rows.length}">
                      ${date}
                    </td>
                  `
                : ''
              }

              <td>${row.project_name || '-'}</td>
              <td>${row.subject || '-'}</td>
              <td>${row.remarks || '-'}</td>
              <td class="center">${row.from_time || '-'}</td>
              <td class="center">${row.hrs || '-'}</td>
            </tr>
          `
          })
          .join('')
      })
      .join('')

    printWindow.document.write(`
    <html>
      <head>
        <title>Timesheet Report</title>

        <style>
          @page {
            size: landscape;
            margin: 10mm;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 20px;
            color: #111;
            background: white;
          }

          .header {
            margin-bottom: 14px;
          }

          .title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 4px;
          }

          .subtitle {
            color: #666;
            font-size: 13px;
          }

          .filter {
            margin-top: 4px;
            font-size: 12px;
            color: #444;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          thead th {
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            padding: 10px 12px;
            text-align: left;
            font-size: 13px;
            font-weight: 700;
          }

          tbody td {
            border: 1px solid #e5e7eb;
            padding: 9px 12px;
            font-size: 13px;
            vertical-align: top;
          }

          tbody tr:nth-child(even) {
            background: #fafafa;
          }

          .group-date {
            font-weight: 700;
            background: #f9fafb;
            text-align: center;
            vertical-align: middle !important;
            min-width: 140px;
            width: 140px;
          }

          .center {
            text-align: center;
          }

          .footer {
            margin-top: 14px;
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #666;
          }

          .total-box {
            margin-top: 12px;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 13px;
          }

          .total-value {
            font-weight: bold;
            font-size: 16px;
          }
        </style>
      </head>

      <body>

        <!-- HEADER -->
        <div class="header">
          <div class="title">
            Timesheet Report
          </div>
 

          ${dateFrom || dateTo
        ? `
                <div class="filter">
                  Filter:
                  ${dateFrom || '...'}
                  →
                  ${dateTo || '...'}
                </div>
              `
        : ''
      }
        </div>

        <!-- TABLE -->
        <table>
          <thead>
            <tr>
              <th style="width: 140px;">Date</th>
              <th>Project</th>
              <th>Subject</th>
              <th>Remarks</th>
              <th style="width: 100px;">Time From</th>
              <th style="width: 70px;">Hr(s)</th>
            </tr>
          </thead>

          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <!-- TOTAL -->
     
 

        <script>
          window.onload = function () {
            window.print()
            // window.close()
          }
        </script>
      </body>
    </html>
  `)

    printWindow.document.close()
  }


  const handleSendEmail = async () => {
    try {
      if (!emailFrom || !emailTo) {
        toast.error('Please complete all email fields')
        return
      }

      setSendingEmail(true)

      // GROUP DATA
      const groupedRows: Record<string, RowDataKey[]> = {}

      filteredRows.forEach((row) => {
        const date = row.doc_date || 'No Date'

        if (!groupedRows[date]) {
          groupedRows[date] = []
        }

        groupedRows[date].push(row)
      })

      // HTML TABLE
      const tableRows = Object.entries(groupedRows)
        .map(([date, rows]) => {
          return rows
            .map((row, index) => {
              return `
              <tr>
                ${index === 0
                  ? `
                      <td rowspan="${rows.length}"
                        style="
                          font-weight:bold;
                          background:#f9fafb;
                          text-align:center;
                          vertical-align:middle;
                          border:1px solid #ddd;
                          padding:8px;
                        ">
                        ${date}
                      </td>
                    `
                  : ''
                }

                <td style="border:1px solid #ddd;padding:8px;">
                  ${row.project_name || '-'}
                </td>

                <td style="border:1px solid #ddd;padding:8px;">
                  ${row.subject || '-'}
                </td>

                <td style="border:1px solid #ddd;padding:8px;">
                  ${row.remarks || '-'}
                </td>

                <td style="border:1px solid #ddd;padding:8px;text-align:center;">
                  ${row.from_time || '-'}
                </td>

                <td style="border:1px solid #ddd;padding:8px;text-align:center;">
                  ${row.hrs || '-'}
                </td>
              </tr>
            `
            })
            .join('')
        })
        .join('')

      const html = `
      <div style="font-family:Arial,sans-serif;">
        <h2 style="margin-bottom:4px;">
          Timesheet Report
        </h2>

        <p style="color:#666;margin-top:0;">
          Employee work output and logged hours summary
        </p>

        <table
          style="
            width:100%;
            border-collapse:collapse;
            margin-top:20px;
          "
        >
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="border:1px solid #ddd;padding:10px;text-align:left;">
                Date
              </th>

              <th style="border:1px solid #ddd;padding:10px;text-align:left;">
                Project
              </th>

              <th style="border:1px solid #ddd;padding:10px;text-align:left;">
                Subject
              </th>

              <th style="border:1px solid #ddd;padding:10px;text-align:left;">
                Remarks
              </th>

              <th style="border:1px solid #ddd;padding:10px;text-align:left;">
                Time From
              </th>

              <th style="border:1px solid #ddd;padding:10px;text-align:left;">
                Hr(s)
              </th>
            </tr>
          </thead>

          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div style="margin-top:20px;font-size:13px;color:#666;">
          Total Records: ${filteredRows.length}
          <br />
          Total Hours:
          ${filteredRows.reduce(
        (sum, row) => sum + Number(row.hrs || 0),
        0
      )}
        </div>
      </div>
    `

      // CALL API
      const res = await fetch('/api/send-timesheet-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: emailTo,
          subject: 'Timesheet Report',
          html,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to send email')
      }

      toast.success('Timesheet report sent successfully')

      setEmailOpen(false)

      setEmailFrom('')
      setEmailTo('')
    } catch (err) {
      console.error(err)
      toast.error('Failed to send email')
    }

    setSendingEmail(false)
  }


  return (
    <div>
      {/* HEADER */}
      <div className="flex items-center justify-between mt-8 mx-4">
        <Breadcrumb
          CurrentPageName="Timesheets"
          FirstPreviewsPageName="Workspace"
        />

        <div className="flex gap-2">

          <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="border-black hover:bg-black hover:text-white"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  Send Timesheet Report
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* FROM */}
                <div className="space-y-2">
                  <Label>Email From</Label>

                  <Input
                    placeholder="sender@company.com"
                    value={emailFrom}
                    onChange={(e) => setEmailFrom(e.target.value)}
                  />
                </div>

                {/* TO */}
                <div className="space-y-2">
                  <Label>Email To</Label>

                  <Input
                    placeholder="manager@company.com"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                  />
                </div>

                {/* SUMMARY */}
                <div className="rounded-xl border bg-muted/40 p-4 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">
                      Records
                    </span>

                    <span className="font-medium">
                      {filteredRows.length}
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">
                      Total Hours
                    </span>

                    <span className="font-medium">
                      {filteredRows.reduce(
                        (sum, row) => sum + Number(row.hrs || 0),
                        0
                      )}
                    </span>
                  </div>

                  {(dateFrom || dateTo) && (
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">
                        Date Filter
                      </span>

                      <span className="font-medium text-right">
                        {dateFrom || '...'} → {dateTo || '...'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setEmailOpen(false)}
                >
                  Cancel
                </Button>

                <Button
                  disabled={sendingEmail}
                  className="bg-black hover:bg-black/90"
                  onClick={handleSendEmail}
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Report
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            size="sm"
            className="bg-black text-white hover:bg-gray-700"
            onClick={handlePrint}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <p className="text-gray-600 mx-4">
        Timesheet reports provide a summary of recorded hours and status
        information.
      </p>

      {/* FILTERS */}
      <Card className="p-4 my-4 mx-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* DATE FROM */}
          <div className="space-y-2">
            <Label htmlFor="dateFrom">Date From</Label>

            <div className="relative">
              <Calendar className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />

              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* DATE TO */}
          <div className="space-y-2">
            <Label htmlFor="dateTo">Date To</Label>

            <div className="relative">
              <Calendar className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />

              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* TABLE */}
      <div ref={printRef}>
        <DynamicTable
          loading={loading}
          data={filteredRows}
          columns={tableColumnsx.map((col) => ({
            key: col.key,
            label: col.label,
            align: col.key === 'action' ? 'right' : 'left',

            render: (row: RowDataKey) => {
              if (col.key === 'action') {
                return (
                  <div className="flex gap-2">
                    <Button
                      size={'sm'}
                      className="my-1 bg-background border hover:bg-foreground/10 border-green-400 text-green-400 p-1 rounded-md"
                      onClick={() => {
                        route.push(`/wks/timelines/${row.id}`)
                      }}
                    >
                      View
                    </Button>
                  </div>
                )
              }

              if (col.key === 'status') {
                const status = row[col.key]

                const statusColors: Record<string, string> = {
                  Draft: 'bg-gray-300 text-gray-800',
                  Submitted: 'bg-blue-100 text-blue-800',
                  Approved: 'bg-green-100 text-green-800',
                  Rejected: 'bg-red-100 text-red-800',
                }

                const colorClass =
                  statusColors[status] || 'bg-gray-100 text-gray-800'

                return (
                  <span
                    className={`px-2 py-1 rounded-full text-sm font-medium ${colorClass}`}
                  >
                    {status}
                  </span>
                )
              }

              const value = row[col.key]

              if (!value) return '-'

              return String(value)
            },
          }))}
        />
      </div>
    </div>
  )
}