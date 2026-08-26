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
import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatDateTime } from '@/lib/formatDate'
import { getWorkspaceActivityTypes, getWorkspaceTimesheetById, getWorkspaceTimesheetEntryOptionsForUser, getWorkspaceTimesheetSettings } from '@/lib/data/repositories/workspace'
import { saveTimesheet } from './api'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import NewProjectTask from '../../projects/[id]/NewProjectTask'
import { Modal } from '@/lib/Moda'

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

type TimesheetFormValues = {
  doc_date: Date | undefined
  assigned_to: number | null
}

const calculateNextFromTime = (fromTime: string, hours: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(fromTime)
  const duration = Number(hours)
  if (!match || !Number.isFinite(duration) || duration <= 0) return ''

  const startMinutes = Number(match[1]) * 60 + Number(match[2])
  const nextMinutes = (startMinutes + Math.round(duration * 60)) % (24 * 60)
  const nextHour = Math.floor(nextMinutes / 60)
  const nextMinute = nextMinutes % 60
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`
}

const isCompleteLine = (row: LineRow) => Boolean(
  row.activity_type &&
  row.from_time &&
  Number(row.hrs) > 0 &&
  row.project_id &&
  row.task_id
)

const prepareTimesheetRows = (
  sourceRows: LineRow[],
  defaultActivityType: string | null
) => {
  const preparedRows: LineRow[] = []
  sourceRows.forEach((row, index) => {
    if (index === 0 || row.from_time) {
      preparedRows.push(row)
      return
    }

    const previousRow = preparedRows[index - 1]
    const calculatedTime = calculateNextFromTime(previousRow.from_time, previousRow.hrs)
    preparedRows.push(calculatedTime ? { ...row, from_time: calculatedTime } : row)
  })

  const lastRow = preparedRows[preparedRows.length - 1]
  if (!lastRow || !isCompleteLine(lastRow)) return preparedRows

  return [
    ...preparedRows,
    {
      line_num: preparedRows.length + 1,
      activity_type: defaultActivityType,
      from_time: calculateNextFromTime(lastRow.from_time, lastRow.hrs),
      hrs: '',
      project_id: null,
      task_id: null,
      remarks: '',
    },
  ]
}

type Props = {
  timesheetId?: number
}

export default function Layout({ timesheetId }: Props = {}) {

  const router = useRouter()
  const { setValue, getValue } = useGlobalContext()
  const gridRef = useRef<HTMLTableElement>(null)

  const [isLoading, setIsLoading] = useState(false)

  const saveDenied = usePermission(timesheetId
    ? '/wks/timelines/edit'
    : '/wks/timelines/insert')
  const taskInsertDenied = usePermission('/wks/tasks/insert')

  const [activityTypes, setActivityTypes] =
    useState<ComboboxItemType[]>([])

  const [defaultActivityType, setDefaultActivityType] =
    useState<string | null>(null)

  const [projectsList, setProjectsList] =
    useState<ComboboxItemType[]>([])

  const [tasksByProject, setTasksByProject] =
    useState<Record<string, ComboboxItemType[]>>({})

  const [taskCreateRowIndex, setTaskCreateRowIndex] =
    useState<number | null>(null)

  const [taskCreationDefaults, setTaskCreationDefaults] = useState<{
    priority: 'low' | 'mid' | 'high'
    taskTypeId: number | null
  }>({ priority: 'mid', taskTypeId: null })

  const [formValues, setFormValues] =
    useState<TimesheetFormValues>({
      doc_date: new Date(),
      assigned_to: null
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

  const handleHeaderChange = <K extends keyof TimesheetFormValues>(
    name: K,
    value: TimesheetFormValues[K]
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
    setRows(current => prepareTimesheetRows(
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      ),
      defaultActivityType
    ))
  }

  const handleProjectChange = (index: number, projectId: string) => {
    setRows(current => prepareTimesheetRows(
      current.map((row, rowIndex) => rowIndex === index
        ? { ...row, project_id: projectId || null, task_id: null }
        : row
      ),
      defaultActivityType
    ))
  }

  const addRow = () => {

    setRows(prev => {
      const previousRow = prev[prev.length - 1]
      return [
        ...prev,
        {
          line_num: prev.length + 1,
          activity_type: defaultActivityType,
          from_time: previousRow
            ? calculateNextFromTime(previousRow.from_time, previousRow.hrs)
            : '',
          hrs: '',
          project_id: null,
          task_id: null,
          remarks: ''
        }
      ]
    })
  }

  const focusGridCell = (rowIndex: number, columnIndex: number) => {
    const element = gridRef.current?.querySelector<HTMLInputElement>(
      `[data-grid-row="${rowIndex}"][data-grid-column="${columnIndex}"]:not(:disabled)`
    )
    if (!element) return false
    element.focus()
    if (!element.readOnly) element.select()
    return true
  }

  const moveGridFocus = (
    rowIndex: number,
    columnIndex: number,
    rowStep: number,
    columnStep: number
  ) => {
    let nextRow = rowIndex + rowStep
    let nextColumn = columnIndex + columnStep

    if (nextColumn > 5) {
      nextColumn = 0
      nextRow += 1
    }
    if (nextColumn < 0) {
      nextColumn = 5
      nextRow -= 1
    }

    if (nextRow === rows.length) {
      addRow()
      window.setTimeout(() => focusGridCell(nextRow, nextColumn), 0)
      return
    }

    if (nextRow >= 0 && nextRow < rows.length) {
      focusGridCell(nextRow, nextColumn)
    }
  }

  const handleGridKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number
  ) => {
    const movement: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      Enter: [event.shiftKey ? -1 : 1, 0],
      Tab: [0, event.shiftKey ? -1 : 1],
    }
    const next = movement[event.key]
    if (!next) return

    event.preventDefault()
    moveGridFocus(rowIndex, columnIndex, next[0], next[1])
  }

  const openTaskCreation = (rowIndex: number) => {
    if (taskInsertDenied) {
      toast.error('You do not have permission to create tasks')
      return
    }

    if (!rows[rowIndex]?.project_id) {
      toast.error('Select a project before creating a task')
      return
    }

    setTaskCreateRowIndex(rowIndex)
  }

  const handleTaskCreated = (taskId: number, taskSubject: string) => {
    if (taskCreateRowIndex === null) return

    const rowIndex = taskCreateRowIndex
    const projectId = rows[rowIndex]?.project_id
    if (!projectId) return

    setTasksByProject(current => ({
      ...current,
      [projectId]: [
        { code: String(taskId), name: taskSubject },
        ...(current[projectId] ?? []).filter(task => task.code !== String(taskId)),
      ],
    }))
    handleRowChange(rowIndex, 'task_id', String(taskId))
    setTaskCreateRowIndex(null)
  }

  const duplicateRowBelow = (index: number) => {
    setRows(prev => {
      const newRows = [...prev]

      const copiedRow = {
        ...newRows[index],
        id: null,
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
    if (rows.length === 1) return

    setRows(prev => {
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
     
    if (!formValues.assigned_to) {
      toast.error('Unable to resolve the timesheet owner')
      return
    }

    const filteredRows =
      rows.filter(r =>
        r.project_id &&
        r.task_id &&
        r.activity_type
      )

    if (!filteredRows.length) {
      toast.error('Add at least one complete timesheet line')
      return
    }

    setIsLoading(true)

    const payload = {
      header: {
        id: timesheetId ?? null,
        doc_date: formatDateTime(String(formValues.doc_date),'mmddyyyy'),
        assigned_to: formValues.assigned_to
      },
      lines: filteredRows.map((r, i) => ({
        id: r.id ?? null,
        line_num: i + 1,
        activity_type: r.activity_type,
        from_time: r.from_time,
        hrs: r.hrs,
        project_id: r.project_id,
        task_id: r.task_id,
        remarks: r.remarks
      }))
    }

    try {
      const data = await saveTimesheet(payload)
      toast.success(timesheetId
        ? 'Timesheet updated successfully'
        : 'Timesheet saved successfully')
      router.push(`/wks/timelines/${data}`)
    } catch (error) {
      console.error(error)
      toast.error('Failed to save timesheet')
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const loadFormOptions = async () => {
      let existingTimesheet: Awaited<ReturnType<typeof getWorkspaceTimesheetById>> | null = null
      let existingRows: LineRow[] = []

      if (timesheetId) {
        try {
          existingTimesheet = await getWorkspaceTimesheetById(timesheetId)
          if (cancelled) return

          existingRows = existingTimesheet.lines
            .slice()
            .sort((left, right) => left.line_num - right.line_num)
            .map(row => ({
              id: row.id ?? null,
              line_num: row.line_num,
              activity_type: row.activity_type == null ? null : String(row.activity_type),
              from_time: row.from_time ?? '',
              hrs: row.hrs == null ? '' : String(row.hrs),
              project_id: row.project_id == null ? null : String(row.project_id),
              task_id: row.task_id == null ? null : String(row.task_id),
              remarks: row.remarks ?? '',
            }))

          setFormValues({
            doc_date: new Date(existingTimesheet.header.doc_date),
            assigned_to: existingTimesheet.header.assigned_to,
          })
          setRows(existingRows.length > 0
            ? existingRows
            : [{
              line_num: 1,
              activity_type: null,
              from_time: '08:00',
              hrs: '',
              project_id: null,
              task_id: null,
              remarks: '',
            }])
        } catch (error) {
          console.error(error)
          toast.error('Failed to load timesheet record')
          return
        }
      }

      try {
        const session = await Promise.resolve(getValue('UserInfoAuthSession'))
        const userId = Number(existingTimesheet?.header.assigned_to ?? session?.[0]?.id)
        if (!userId) throw new Error('Unable to resolve the timesheet owner')

        const [activities, entryOptions, settings] = await Promise.all([
          getWorkspaceActivityTypes(),
          getWorkspaceTimesheetEntryOptionsForUser(userId),
          getWorkspaceTimesheetSettings().catch(() => null),
        ])
        if (cancelled) return

        setActivityTypes(activities.map(activity => ({
          code: String(activity.id),
          name: activity.name,
        })))
        const configuredActivity = settings?.default_activity_type_id
          ? activities.find(activity => activity.id === settings.default_activity_type_id)
          : activities.find(activity => activity.name.trim().toLowerCase() === 'development')
        const configuredActivityId = configuredActivity
          ? String(configuredActivity.id)
          : null
        setTaskCreationDefaults({
          priority: settings?.default_priority ?? 'mid',
          taskTypeId: settings?.default_task_type_id ?? null,
        })
        setDefaultActivityType(configuredActivityId)
        if (existingTimesheet) {
          setRows(prepareTimesheetRows(
            existingRows.length > 0
              ? existingRows
              : [{
                line_num: 1,
                activity_type: configuredActivityId,
                from_time: '08:00',
                hrs: '',
                project_id: null,
                task_id: null,
                remarks: '',
              }],
            configuredActivityId
          ))
        } else if (configuredActivityId) {
          setRows(current => prepareTimesheetRows(
            current.map(row => ({
              ...row,
              activity_type: row.activity_type || configuredActivityId,
            })),
            configuredActivityId
          ))
        }
        setProjectsList(entryOptions.projects.map(project => ({
          code: String(project.id),
          name: project.project_name,
        })))
        setTasksByProject(entryOptions.tasks.reduce<Record<string, ComboboxItemType[]>>(
          (groupedTasks, task) => {
            const projectId = String(task.project_id)
            groupedTasks[projectId] = [
              ...(groupedTasks[projectId] ?? []),
              { code: String(task.id), name: task.subject },
            ]
            return groupedTasks
          },
          {}
        ))
        setFormValues(current => existingTimesheet
          ? {
            doc_date: new Date(existingTimesheet.header.doc_date),
            assigned_to: existingTimesheet.header.assigned_to ?? userId,
          }
          : {
            ...current,
            assigned_to: userId,
          })
      } catch (error) {
        console.error(error)
        toast.error(timesheetId
          ? 'Timesheet loaded, but some form options are unavailable'
          : 'Failed to load timesheet options')
      }
    }

    void loadFormOptions()
    return () => {
      cancelled = true
    }
  }, [getValue, timesheetId])

  useEffect(() => {

    setValue('loading_g', isLoading)

  }, [isLoading, setValue])

  return (
    <div>
      <form
        className="space-y-4 mt-8"
        onSubmit={handleSubmit}
      >

        <div className="flex items-center justify-between">

          <Breadcrumb
            CurrentPageName={timesheetId ? 'Edit Timesheet' : 'Create New Timesheet'}
            FirstPreviewsPageName="Timelines"
          />

          <Button
            type="submit"
            disabled={isLoading || saveDenied}
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

        <Card className="overflow-hidden p-0">

          <Table ref={gridRef} className="min-w-[1050px] table-fixed border-collapse text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 w-12 border-r px-1 text-center">#</TableHead>
                <TableHead className="h-8 w-36 border-r px-2">Activity</TableHead>
                <TableHead className="h-8 w-28 border-r px-2">From Time</TableHead>
                <TableHead className="h-8 w-24 border-r px-2">Hours</TableHead>
                <TableHead className="h-8 w-52 border-r px-2">Project</TableHead>
                <TableHead className="h-8 w-56 border-r px-2">Task</TableHead>
                <TableHead className="h-8 min-w-56 px-2">Remarks</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index} className="h-8 hover:bg-transparent">

                  <TableCell className="h-8 border-r p-0 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" className="h-8 w-full rounded-none px-1 text-xs text-muted-foreground">
                          <span>{index + 1}</span>
                          <EllipsisVertical className="size-3.5" />
                        </Button>
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
                  <TableCell className="border-r p-0">
                    <SearchableCombobox
                      // label="Activity"
                      // required
                      items={activityTypes}
                      value={row.activity_type || ""}
                      onValueChange={(val) =>
                        handleRowChange(index, "activity_type", val)
                      }
                      className="h-8 min-h-8 w-full max-w-none rounded-none border-0 px-2 py-1 text-xs shadow-none focus-within:ring-2"
                      gridRow={index}
                      gridColumn={0}
                      onGridKeyDown={event => handleGridKeyDown(event, index, 0)}
                      openOnFocus
                    />
                  </TableCell>

                  <TableCell className="border-r p-0">
                    <Input
                      type="time"
                      value={row.from_time}
                      onChange={(e) =>
                        handleRowChange(index, "from_time", e.target.value)
                      }
                      data-grid-row={index}
                      data-grid-column={1}
                      onKeyDown={event => handleGridKeyDown(event, index, 1)}
                      className="h-8 rounded-none border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-2"
                    />
                  </TableCell>

                  <TableCell className="border-r p-0">
                    <Input
                      type="number"
                      min="0"
                      step="0.25"
                      placeholder="Hours"
                      value={row.hrs}
                      onChange={(e) =>
                        handleRowChange(index, "hrs", e.target.value)
                      }
                      data-grid-row={index}
                      data-grid-column={2}
                      onKeyDown={event => handleGridKeyDown(event, index, 2)}
                      className="h-8 rounded-none border-0 bg-transparent px-2 text-right text-xs tabular-nums shadow-none focus-visible:ring-2"
                    />
                  </TableCell>

                  <TableCell className="border-r p-0">
                    <SearchableCombobox
                      // label="Project"
                      items={projectsList}
                      value={row.project_id || ""}
                      onValueChange={(val) => handleProjectChange(index, val)}
                      className="h-8 min-h-8 w-full max-w-none rounded-none border-0 px-2 py-1 text-xs shadow-none focus-within:ring-2"
                      gridRow={index}
                      gridColumn={3}
                      onGridKeyDown={event => handleGridKeyDown(event, index, 3)}
                      openOnFocus
                    />
                  </TableCell>

                  <TableCell className="border-r p-0">
                    <SearchableCombobox
                      // label="Task"
                      items={row.project_id ? tasksByProject[row.project_id] || [] : []}
                      value={row.task_id || ""}
                      onValueChange={(val) =>
                        handleRowChange(index, "task_id", val)
                      }
                      actionLabel="Create Task"
                      actionDisabled={taskInsertDenied}
                      onAction={() => openTaskCreation(index)}
                      className="h-8 min-h-8 w-full max-w-none rounded-none border-0 px-2 py-1 text-xs shadow-none focus-within:ring-2"
                      gridRow={index}
                      gridColumn={4}
                      onGridKeyDown={event => handleGridKeyDown(event, index, 4)}
                      openOnFocus
                    />
                  </TableCell>

                  <TableCell className="p-0">
                    <Input
                      placeholder="Remarks"
                      value={row.remarks}
                      onChange={(e) =>
                        handleRowChange(index, "remarks", e.target.value)
                      }
                      data-grid-row={index}
                      data-grid-column={5}
                      onKeyDown={event => handleGridKeyDown(event, index, 5)}
                      className="h-8 rounded-none border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-2"
                    />
                  </TableCell>

                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start rounded-none border-t px-3 text-xs text-muted-foreground"
            onClick={addRow}
          >
            + Add Row
          </Button>

        </Card>
      </form>

      <Modal
        open={taskCreateRowIndex !== null}
        onOpenChange={(open) => {
          if (!open) setTaskCreateRowIndex(null)
        }}
        title="Create Task"
        description="Create a task for the selected project. It will be selected on this timesheet line after saving."
        className="max-w-2xl overflow-hidden"
      >
        {taskCreateRowIndex !== null && rows[taskCreateRowIndex]?.project_id && (
          <NewProjectTask
            projectId={rows[taskCreateRowIndex].project_id}
            onClose={() => setTaskCreateRowIndex(null)}
            onCreated={handleTaskCreated}
            defaultPriority={taskCreationDefaults.priority}
            defaultTaskTypeId={taskCreationDefaults.taskTypeId}
          />
        )}
      </Modal>


    </div>


  )
}
