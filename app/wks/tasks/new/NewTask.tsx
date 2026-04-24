'use client'

import SearchableCombobox, {
  ComboboxItemType
} from '@/components/SearchableCombobox'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Breadcrumb from '@/lib/Breadcrumb'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import React, { useEffect, useRef, useState } from 'react'
import { getTaskinNewTaskAPi, savetask, SavetaskPayload } from './api'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ArrowDown, CalendarIcon, ChevronDown } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { getProjects, getTaskList } from '../../projects/api'
import { toast } from 'sonner'
import { getTaskType } from '../api'
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'




type FormFieldName =
  | 'assigned_to'
  | 'project_id'
  | 'subject'
  | 'issue'
  | 'priority'
  | 'task_type'
  | 'parent_task'
  | 'color'

export default function NewTask() {
  const { setValue, getValue } = useGlobalContext()
  const [isBatchSaved, setisBatchSaved] = useState(true)

  const subjectRef = useRef<HTMLInputElement | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [projectsList, setProjectsList] = useState<ComboboxItemType[]>([])

  const [taskTypes, setTaskTypes] = useState<ComboboxItemType[]>([])

  const [tasksList, setTasksList] = useState<ComboboxItemType[]>([])
  const [activeUsers, setActiveUsers] = useState<ComboboxItemType[]>([])
  const [authUser, setauthUser] = useState<ComboboxItemType[]>([])
  const getRandomColor = () =>
    `#${Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, '0')}`

  const [formValues, setFormValues] =
    useState<Record<FormFieldName, any>>({
      assigned_to: null,
      project_id: null,
      subject: '',
      issue: '',
      priority: null,
      task_type: null,
      parent_task: null,
      color: getRandomColor()
    })

  const components: {
    name: FormFieldName
    label: string
    type: string
    required?: boolean
    placeholder?: string
    multiselect?: boolean
    list?: ComboboxItemType[]
  }[] = [
      {
        name: 'assigned_to',
        label: 'Assigned To',
        type: 'search',
        required: true,
        placeholder: 'Select user',
        multiselect: false,
        list: activeUsers
      },
      {
        name: 'project_id',
        label: 'Project',
        type: 'search',
        required: true,
        placeholder: 'Select project',
        multiselect: false,
        list: projectsList
      },

      {
        name: 'subject',
        label: 'Subject',
        type: 'text',
        required: true,
        placeholder: 'Enter subject'
      },


      {
        name: 'issue',
        label: 'Issue',
        type: 'textarea',
        placeholder: 'Describe issue'
      },


      {
        name: 'priority',
        label: 'Priority',
        type: 'search',
        required: true,
        multiselect: false,
        list: [
          { code: 'low', name: 'Low' },
          { code: 'mid', name: 'Medium' },
          { code: 'high', name: 'High' }
        ]
      },

      {
        name: 'task_type',
        label: 'Task Type',
        type: 'search',
        required: true,
        multiselect: false,
        list: taskTypes
      },

      // {
      //   name: 'parent_task',
      //   label: 'Parent Task',
      //   type: 'search',
      //   multiselect: false,
      //   list: tasksList
      // },

      {
        name: 'color',
        label: 'Color',
        type: 'color'
      },
    ]

  const handleChange = (
    name: FormFieldName,
    value: any
  ) => {
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (
      !formValues.assigned_to ||
      !formValues.project_id ||
      !formValues.subject ||
      !formValues.priority ||
      !formValues.task_type
    ) {
      toast.error('Please fill all required fields')
      return
    }

    setIsLoading(true)

    const payload: SavetaskPayload = {
      id: null,
      project_id: formValues.project_id,
      subject: formValues.subject,
      issue: formValues.issue,
      priority: formValues.priority as
        | "low"
        | "mid"
        | "high",
      task_type: formValues.task_type,
      parent_task:
        formValues.parent_task,
      color: formValues.color,
      assigned_to: formValues.assigned_to
    }

    // console.log('Prepared payload for saving:', payload)
    // console.log(formValues)
    // return
    try {
      const id = await savetask(payload)
      toast.success('Task saved successfully')

      // clear fields depending on save mode
      if (isBatchSaved) {
        setFormValues(prev => ({
          ...prev,
          subject: '',
          parent_task: null,
          issue: ''
        }))
        setTimeout(() => {
          subjectRef.current?.focus()
        }, 0)
      } else {
        setFormValues({
          assigned_to: authUser,
          project_id: null,
          subject: '',
          issue: '',
          priority: null,
          task_type: null,
          parent_task: null,
          color: '#000000'
        })
      }
      // console.log('Saved task:', id)
    } catch (err: any) {
      const code = err?.code || err?.error?.code
      if (code === '23505') {
        toast.error('A task with the same subject already exists in this project.')
      } else if (code === '23503') {
        toast.error('Invalid parent task selected.')
      } else {
        toast.error(err?.message || 'Failed to save task')
      }
    }

    setIsLoading(false)
  }

  const getTaskTypesList = async () => {
    const data = await getTaskType()
    setTaskTypes((data || []).map((t: any) => ({
      code: t.id,
      name: t.name
    })))
  }

  const getActiveUsers = async () => {
    const data = await getValue("activeUsers")
    console.log({ data })
    setActiveUsers((data || []).map((u: any) => ({
      code: u.code,
      name: u.name
    })))
  }

  const getAuthUser = async () => {
    const data = await getValue("UserInfoAuthSession")
    console.log({ data })
    setauthUser(data[0].id)
  }
  const getProjectList = async () => {
    const data = await getProjects()
    // console.log({ data })
    setProjectsList((data || []).map((p: any) => ({
      code: p.id,
      name: p.project_name
    })))
  }


  const getParentTaskList = async () => {
    if (!formValues.project_id) return
    const data = await getTaskinNewTaskAPi(formValues.project_id)

    setTasksList(
      (data || []).map((t: any) => ({
        code: t.id,
        name: t.subject
      }))
    )
  }

  useEffect(() => {
    getActiveUsers()
    getAuthUser()
    getTaskTypesList()
    getProjectList()
  }, [])

  useEffect(() => {
    getParentTaskList()
  }, [formValues.project_id])

  useEffect(() => {
    setValue('loading_g', isLoading)
  }, [isLoading])

  useEffect(() => {
    setFormValues(prev => ({
      ...prev,
      assigned_to: authUser
    }))
  }, [authUser])

  return (
    <div>
      <form
        className="space-y-4 mt-8"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between">
          <Breadcrumb
            CurrentPageName="Create New Task"
            FirstPreviewsPageName="Tasks"
          />

          <ButtonGroup className='border border-white shadow rounded-2xl'>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {
                isBatchSaved ? 'Save & Continue' : 'Save'
              }
            </Button>
            <ButtonGroupSeparator />


            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  className='w-6'
                  disabled={isLoading}
                >
                  <ChevronDown />
                </Button>

              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setisBatchSaved(true)}  >
                    Save & Continue
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setisBatchSaved(false)}>
                    Save Once
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </div>

        <Card className='shadow-none'>
          <div className="grid md:grid-cols-2 gap-4 px-4">

            {components.map((e, i) => (
              <div key={i}>

                {e.type !== "search" && (
                  <Label
                    required={e.required}
                    htmlFor={e.name}
                    className="block text-sm font-medium text-gray-700"
                  >
                    {e.label}
                  </Label>
                )}

                {e.type === "search" ? (
                  <SearchableCombobox
                    required={e.required}
                    multiple={e.multiselect}
                    label={e.label}
                    showCode
                    items={e.list || []}
                    value={(formValues as any)[e.name] || ""}
                    onValueChange={(val: any) => handleChange(e.name, val)}
                    className="w-full"
                  />
                ) : e.type === "textarea" ? (

                  <textarea
                    id={e.name}
                    name={e.name}
                    placeholder={e.placeholder}
                    value={(formValues as any)[e.name] || ""}
                    onChange={(ev) =>
                      handleChange(e.name, ev.target.value)
                    }
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />

                ) : e.type === "date" ? (

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {(formValues as any)[e.name]
                          ? format((formValues as any)[e.name], "PPP")
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={(formValues as any)[e.name]}
                        onSelect={(date) =>
                          handleChange(e.name, date)
                        }
                        captionLayout="dropdown"
                        className="rounded-lg border"
                      />
                    </PopoverContent>
                  </Popover>

                ) : (

                  <Input
                    ref={e.name === "subject" ? subjectRef : undefined}
                    id={e.name}
                    name={e.name}
                    type={e.type}
                    placeholder={e.placeholder}
                    value={(formValues as any)[e.name] || ""}
                    onChange={(ev) =>
                      handleChange(e.name, ev.target.value)
                    }
                  />

                )}

              </div>
            ))}

          </div>
        </Card>
      </form>
    </div>
  )
}