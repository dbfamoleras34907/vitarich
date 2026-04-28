import React from 'react'
import ProjectsChart from './ProjectsChart'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import ChildFolder from '@/components/ChildFolder'
import Breadcrumb from '@/lib/Breadcrumb'

export default function Layout() {
  const reports = [
    {
      id: 1,
      name: 'Timesheet Report',
      description: 'A report that summarizes the hours worked by employees on various projects and tasks, often used for payroll and project management purposes.'
    },
    {
      id: 2,
      name: 'Timesheet Report',
      description: 'A report that summarizes the hours worked by employees on various projects and tasks, often used for payroll and project management purposes.'
    }
  ]
  return (
    <div className='mt-8 '>
      <div className='mt-5'></div>
      <div className='mx-4'>
        <Breadcrumb
          CurrentPageName='Reports'
          FirstPreviewsPageName='Timesheet'
        />
      </div>
      {/* <ProjectsChart /> */}
      <div className='grid lg:grid-cols-2 gap-4'>
        <Card className='mt-5 mx-2 '>
          {reports.map((report) => (
            <CardHeader key={report.id} className='border-b'>
              <CardTitle>{report.name}</CardTitle>
            </CardHeader>
          ))}
        </Card>

      </div>

    </div>
  )
} 