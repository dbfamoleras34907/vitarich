'use client'

import { useParams } from 'next/navigation'
import TimesheetEditor from '../new/Layout'

export default function Layout() {
  const params = useParams<{ id: string }>()
  const timesheetId = Number(params.id)

  return <TimesheetEditor timesheetId={timesheetId} />
}
