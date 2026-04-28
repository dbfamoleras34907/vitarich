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
import { CalendarIcon, ChevronDown, EllipsisVertical } from 'lucide-react'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { db } from '@/lib/Supabase/supabaseClient'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { formatDateTime } from '@/lib/formatDate'

type LineRow = {
  id?: number | null
  line_num: number
  activity_type: string
  from_time: string
  hrs: string
  project_id: string
  task_id: string
  remarks: string
}

export default function Layout() {
  
  const { id } = useParams()
  const router = useRouter()
  const { setValue } = useGlobalContext()

  const [isLoading, setIsLoading] = useState(false)

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

  const [rows, setRows] =
    useState<LineRow[]>([])

  /* ---------------- LOOKUPS ---------------- */

  const loadActivityTypes = async () => {

    const { data } =
      await db.from('activity_types').select('*')

    setActivityTypes(
      (data || []).map(a => ({
        code: String(a.id),
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
        code: String(p.id),
        name: p.project_name
      }))
    )
  }

  const loadTasksByProject = async (
    projectId: number,
    index: number
  ) => {

    const { data } =
      await db.from('tasks')
        .select('*')
        .eq('project_id', projectId)

    setTasksList(prev => ({
      ...prev,
      [index]:
        (data || []).map(t => ({
          code: String(t.id),
          name: t.subject
        }))
    }))
  }

  /* ---------------- LOAD HEADER ---------------- */

  const loadHeader = async () => {

    const { data } =
      await db
        .from('vw_timesheets')
        .select('*')
        .eq('id', id)
        .single()

    if (!data) return

    setFormValues({
      doc_date: new Date(data.doc_date),
      assigned_to: data.assigned_to
    })
  }

  /* ---------------- LOAD LINES ---------------- */

  const loadLines = async () => {

    const { data } =
      await db
        .from('vw_timesheet_lines')
        .select('*')
        .eq('docentry', id)

    if (!data) return

    const mapped =
      data.map((row, index) => {

        if (row.project_id) {
          loadTasksByProject(
            Number(row.project_id),
            index
          )
        }

        return {
          id: row.id,
          line_num: row.line_num,
          activity_type:
            row.activity_type?.toString() ?? '',
          from_time: row.from_time,
          hrs: row.hrs,
          project_id:
            row.project_id?.toString() ?? '',
          task_id:
            row.task_id?.toString() ?? '',
          remarks: row.remarks
        }
      })

    setRows(mapped)
  }

  /* ---------------- ROW OPS ---------------- */

  const duplicateRowBelow = (index: number) => {

    setRows(prev => {

      const copy = {
        ...prev[index],
        id: null
      }

      const updated = [...prev]

      updated.splice(index + 1, 0, copy)

      return updated.map((r, i) => ({
        ...r,
        line_num: i + 1
      }))
    })
  }

  const deleteRow = (index: number) => {

    setRows(prev =>
      prev
        .filter((_, i) => i !== index)
        .map((r, i) => ({
          ...r,
          line_num: i + 1
        }))
    )
  }

  const addRow = () => {

    setRows(prev => [
      ...prev,
      {
        line_num: prev.length + 1,
        activity_type: '',
        from_time: '',
        hrs: '',
        project_id: '',
        task_id: '',
        remarks: ''
      }
    ])
  }

  /* ---------------- SAVE ---------------- */

  const handleSubmit = async ( ) => {


    const payload = {

      header: {
        id: Number(id),
        doc_date: formatDateTime(String(formValues.doc_date), 'mmddyyyy'),
        assigned_to: formValues.assigned_to,
        status: 'Submitted'
      },

      lines: rows.map((r, i) => ({
        id: r.id ?? null,
        line_num: i + 1,
        activity_type: r.activity_type
          ? Number(r.activity_type)
          : null,
        from_time: r.from_time,
        hrs: r.hrs,
        project_id: r.project_id
          ? Number(r.project_id)
          : null,
        task_id: r.task_id
          ? Number(r.task_id)
          : null,
        remarks: r.remarks
      }))
    }

    setIsLoading(true)
    console.log('payload', payload)
    const { error } =
      await db.rpc(
        'rpc_upsert_timesheet_full',
        { payload }
      )

    if (error) {

      console.error(error)
      setIsLoading(false)
      return
    }
    setIsLoading(false)
    router.push('/wks/timelines')

    // location.reload()
  }



  const handleSubmitAsDraft = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {

    e.preventDefault()

    const payload = {

      header: {
        id: Number(id),
        doc_date: formatDateTime(String(formValues.doc_date), 'mmddyyyy'),
        assigned_to: formValues.assigned_to
      },

      lines: rows.map((r, i) => ({
        id: r.id ?? null,
        line_num: i + 1,
        activity_type: r.activity_type
          ? Number(r.activity_type)
          : null,
        from_time: r.from_time,
        hrs: r.hrs,
        project_id: r.project_id
          ? Number(r.project_id)
          : null,
        task_id: r.task_id
          ? Number(r.task_id)
          : null,
        remarks: r.remarks
      }))
    }

    setIsLoading(true)
    console.log('payload', payload)
    const { error } =
      await db.rpc(
        'rpc_upsert_timesheet_full',
        { payload }
      )

    if (error) {

      console.error(error)
      setIsLoading(false)
      return
    }
    setIsLoading(false)

    // location.reload()
  }

  /* ---------------- INIT ---------------- */
  useEffect(() => {
    router.prefetch('/wks/timelines')
  }, [])

  useEffect(() => {

    if (!id) return

    loadActivityTypes()
    loadProjects()
    loadHeader()
    loadLines()

  }, [id])

  useEffect(() => {

    setValue('loading_g', isLoading)

  }, [isLoading])


  /* ---------------- UI ---------------- */

  return (
    <form
      className="space-y-4 mt-8"
      onSubmit={handleSubmitAsDraft}
    >

      <div className="flex items-center justify-between">

        <Breadcrumb
          CurrentPageName="Edit Timesheet"
          FirstPreviewsPageName="Timelines"
        />

        <div className='flex justify-center '>
          <Button
            type="submit"
            disabled={isLoading}
            className='rounded-none rounded-bl-md rounded-tl-md border-r'
          >
            Save as Draft
          </Button>
          <DropdownMenu >
            <DropdownMenuTrigger asChild>
              <Button className='rounded-none rounded-br-md rounded-tr-md '><ChevronDown /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={handleSubmit}>
                  Submit
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>


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

              {format(
                formValues.doc_date,
                'PPP'
              )}

            </Button>

          </PopoverTrigger>

          <PopoverContent>

            <Calendar
              mode="single"
              selected={formValues.doc_date}
              onSelect={date => {
                if (!date) return

                setFormValues(prev => ({
                  ...prev,
                  doc_date: date
                }))
              }}
            />

          </PopoverContent>

        </Popover>

      </Card>

      {/* TABLE */}

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

                <TableCell>

                  <DropdownMenu>

                    <DropdownMenuTrigger asChild>
                      <EllipsisVertical className="h-4 cursor-pointer" />
                    </DropdownMenuTrigger>

                    <DropdownMenuContent>

                      <DropdownMenuGroup>

                        <DropdownMenuItem
                          onClick={() =>
                            duplicateRowBelow(index)
                          }
                        >
                          Duplicate below
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className="text-red-500"
                          onClick={() =>
                            deleteRow(index)
                          }
                        >
                          Delete
                        </DropdownMenuItem>

                      </DropdownMenuGroup>

                    </DropdownMenuContent>

                  </DropdownMenu>

                </TableCell>

                {/* activity */}

                <TableCell>

                  <SearchableCombobox
                    items={activityTypes}
                    value={row.activity_type}
                    onValueChange={val =>
                      setRows(prev => {

                        const updated = [...prev]
                        updated[index].activity_type = val
                        return updated

                      })
                    }
                  />

                </TableCell>

                {/* time */}

                <TableCell>

                  <Input
                    type="time"
                    value={row.from_time}
                    onChange={e =>
                      setRows(prev => {

                        const updated = [...prev]
                        updated[index].from_time =
                          e.target.value
                        return updated

                      })
                    }
                  />

                </TableCell>

                {/* hrs */}

                <TableCell>

                  <Input
                    value={row.hrs}
                    onChange={e =>
                      setRows(prev => {

                        const updated = [...prev]
                        updated[index].hrs =
                          e.target.value
                        return updated

                      })
                    }
                  />

                </TableCell>

                {/* project */}

                <TableCell>

                  <SearchableCombobox
                    items={projectsList}
                    value={row.project_id}
                    onValueChange={val => {

                      setRows(prev => {

                        const updated = [...prev]
                        updated[index].project_id =
                          val
                        updated[index].task_id = ''
                        return updated

                      })

                      if (val) {
                        loadTasksByProject(
                          Number(val),
                          index
                        )
                      }

                    }}
                  />

                </TableCell>

                {/* task */}

                <TableCell>

                  <SearchableCombobox
                    items={tasksList[index] || []}
                    value={row.task_id}
                    onValueChange={val =>
                      setRows(prev => {

                        const updated = [...prev]
                        updated[index].task_id =
                          val
                        return updated

                      })
                    }
                  />

                </TableCell>

                {/* remarks */}

                <TableCell>

                  <Input
                    value={row.remarks}
                    onChange={e =>
                      setRows(prev => {

                        const updated = [...prev]
                        updated[index].remarks =
                          e.target.value
                        return updated

                      })
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
          className="mt-2"
          onClick={addRow}
        >
          Add Row
        </Button>

      </Card>

    </form>
  )
}