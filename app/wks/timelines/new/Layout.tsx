'use client'

import SearchableCombobox, {
  ComboboxItemType
} from '@/components/SearchableCombobox'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import Breadcrumb from '@/lib/Breadcrumb'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { format } from 'date-fns'
import { CalendarIcon, EllipsisVertical } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/Supabase/supabaseClient'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuShortcut, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatDateTime } from '@/lib/formatDate'

type LineRow = {
  id?: number | null
  line_num: number
  activity_type: string | null
  from_time: string
  hrs: string
  project_id: string | null
  task_id: string | null
  remarks: string
}

export default function Layout() {

  const router = useRouter()
  const { setValue, getValue } = useGlobalContext()

  const [isLoading, setIsLoading] = useState(false)

  const [authUser, setAuthUser] =
    useState<number | null>(null)

  const [activityTypes, setActivityTypes] =
    useState<ComboboxItemType[]>([])

  const [projectsList, setProjectsList] =
    useState<ComboboxItemType[]>([])

  const [tasksList, setTasksList] =
    useState<Record<number, ComboboxItemType[]>>({})

  const [formValues, setFormValues] =
    useState({
      doc_date: new Date(),
      assigned_to: null as number | null
    })

  const [rows, setRows] = useState<LineRow[]>([
    {
      line_num: 1,
      activity_type: null,
      from_time: '08:00',
      hrs: '',
      project_id: null,
      task_id: null,
      remarks: ''
    }
  ])

  const handleHeaderChange = (
    name: string,
    value: any
  ) => {
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleRowChange = <K extends keyof LineRow>(
    index: number,
    field: K,
    value: LineRow[K]
  ) => {

    const updated = [...rows]
    updated[index][field] = value

    setRows(updated)
  }

  const addRow = () => {

    setRows(prev => [
      ...prev,
      {
        line_num: prev.length + 1,
        activity_type: null,
        from_time: '',
        hrs: '',
        project_id: null,
        task_id: null,
        remarks: ''
      }
    ])
  }

  const loadActivityTypes = async () => {

    const { data } =
      await db.from('activity_types').select('*')

    setActivityTypes(
      (data || []).map(a => ({
        code: a.id,
        name: a.name
      }))
    )
  }

  const loadProjects = async () => {

    const { data } =
      await db.from('projects')
        .select('*')
        .eq('void', 1)

    setProjectsList(
      (data || []).map(p => ({
        code: p.id,
        name: p.project_name
      }))
    )
  }

  const loadTasksByProject = async (
    projectId: any,
    rowIndex: any
  ) => {

    const { data } =
      await db.from('tasks')
        .select('*')
        .eq('project_id', projectId)

    setTasksList(prev => ({
      ...prev,
      [rowIndex]:
        (data || []).map(t => ({
          code: t.id,
          name: t.subject
        }))
    }))
  }

  const getAuthUser = async () => {

    const data =
      await getValue('UserInfoAuthSession')

    const id = data?.[0]?.id ?? null

    setAuthUser(id)

    setFormValues(prev => ({
      ...prev,
      assigned_to: id
    }))
  }


  const duplicateRowBelow = (index: number) => {
    setRows(prev => {
      const newRows = [...prev]

      const copiedRow = {
        ...newRows[index],
        line_num: index + 2
      }

      newRows.splice(index + 1, 0, copiedRow)

      // re-sequence line numbers
      return newRows.map((row, i) => ({
        ...row,
        line_num: i + 1
      }))
    })
  }

  const deleteRow = (index: number) => {
    setRows(prev => {
      if (prev.length === 1) return prev // prevent deleting last row

      const newRows = prev.filter((_, i) => i !== index)

      return newRows.map((row, i) => ({
        ...row,
        line_num: i + 1
      }))
    })
  }



  const handleSubmit = async (
    e: React.FormEvent
  ) => {

    e.preventDefault()    
     
    if (!formValues.assigned_to) return

    const filteredRows =
      rows.filter(r =>
        r.project_id &&
        r.task_id &&
        r.activity_type
      )

    if (!filteredRows.length) return

    setIsLoading(true)

    const payload = {
      header: {
        id: null,
        doc_date: formatDateTime(String(formValues.doc_date),'mmddyyyy'),
        assigned_to: formValues.assigned_to
      },
      lines: filteredRows.map((r, i) => ({
        id: null,
        line_num: i + 1,
        activity_type: r.activity_type,
        from_time: r.from_time,
        hrs: r.hrs,
        project_id: r.project_id,
        task_id: r.task_id,
        remarks: r.remarks
      }))
    }

    const { data, error } =
      await db.rpc(
        'rpc_upsert_timesheet_full',
        { payload }
      )

    if (error) {

      console.error(error)
      setIsLoading(false)
      return
    }

    router.push(`/wks/timelines/${data}`)
  }

  useEffect(() => {

    loadActivityTypes()
    loadProjects()
    getAuthUser()

  }, [])

  useEffect(() => {

    setValue('loading_g', isLoading)

  }, [isLoading])

  return (
    <div>
      <form
        className="space-y-4 mt-8"
        onSubmit={handleSubmit}
      >

        <div className="flex items-center justify-between">

          <Breadcrumb
            CurrentPageName="Create New Timesheet"
            FirstPreviewsPageName="Timelines"
          />

          <Button
            type="submit"
            disabled={isLoading}
          >
            Save
          </Button>

        </div>

        {/* HEADER */}

        <Card className="px-4 py-4">

          <Label required>Date</Label>

          <Popover>

            <PopoverTrigger asChild>

              <Button
                variant="outline"
                className="w-full justify-start"
              >

                <CalendarIcon className="mr-2 h-4 w-4" />

                {formValues.doc_date
                  ? format(
                    formValues.doc_date,
                    'PPP'
                  )
                  : 'Pick date'}

              </Button>

            </PopoverTrigger>

            <PopoverContent>

              <Calendar
                mode="single"
                selected={formValues.doc_date}
                onSelect={date =>
                  handleHeaderChange(
                    'doc_date',
                    date
                  )
                }
              />

            </PopoverContent>

          </Popover>

        </Card>

        {/* LINES */}

        <Card className="px-4 py-4">

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>From Time</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>

                  <TableCell className='border-t border-b'>
                    {/* <EllipsisVertical className='h-4' /> */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <EllipsisVertical className='h-4' />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-40" align="start">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => duplicateRowBelow(index)}>
                            Duplicate to below
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className='text-red-500'
                            onClick={() => deleteRow(index)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell className='border'>
                    <SearchableCombobox
                      // label="Activity"
                      // required
                      items={activityTypes}
                      value={row.activity_type || ""}
                      onValueChange={(val) =>
                        handleRowChange(index, "activity_type", val)
                      }
                    />
                  </TableCell>

                  <TableCell className='border'>
                    <Input
                      type="time"
                      value={row.from_time}
                      onChange={(e) =>
                        handleRowChange(index, "from_time", e.target.value)
                      }
                    />
                  </TableCell>

                  <TableCell className='border'>
                    <Input
                      placeholder="Hours"
                      value={row.hrs}
                      onChange={(e) =>
                        handleRowChange(index, "hrs", e.target.value)
                      }
                    />
                  </TableCell>

                  <TableCell className='border'>
                    <SearchableCombobox
                      // label="Project"
                      items={projectsList}
                      value={row.project_id || ""}
                      onValueChange={(val) => {
                        handleRowChange(index, "project_id", val)
                        loadTasksByProject(val, index)
                      }}
                    />
                  </TableCell>

                  <TableCell className='border'>
                    <SearchableCombobox
                      // label="Task"
                      items={tasksList[index] || []}
                      value={row.task_id || ""}
                      onValueChange={(val) =>
                        handleRowChange(index, "task_id", val)
                      }
                    />
                  </TableCell>

                  <TableCell className='border'>
                    <Input
                      placeholder="Remarks"
                      value={row.remarks}
                      onChange={(e) =>
                        handleRowChange(index, "remarks", e.target.value)
                      }
                    />
                  </TableCell>

                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Button
            type="button"
            variant="secondary"
            className=" w-fit"
            onClick={addRow}
          >
            Add Row
          </Button>

        </Card>
      </form>


    </div>


  )
}