'use client'

import SearchableCombobox, {
  ComboboxItemType
} from '@/components/SearchableCombobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import React, { useEffect, useState } from 'react'
import { getTaskinNewTaskAPi, savetask, SavetaskPayload } from '../../tasks/new/api'
import { getTaskType } from '../../tasks/api'
import { toast } from 'sonner'

interface Props {
  projectId: string
  onClose?: () => void
  onCreated?: (taskId: number, taskSubject: string) => void
  defaultPriority?: 'low' | 'mid' | 'high'
  defaultTaskTypeId?: number | null
}

const TASK_COLOR_PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0d9488',
  '#0891b2',
]

function getRandomTaskColor() {
  return TASK_COLOR_PALETTE[Math.floor(Math.random() * TASK_COLOR_PALETTE.length)]
}

type TaskFormValues = {
  subject: string
  issue: string
  assigned_to: string
  priority: string
  task_type: string
  parent_task: string
  color: string
}

export default function NewProjectTask({
  projectId,
  onClose,
  onCreated,
  defaultPriority,
  defaultTaskTypeId,
}: Props) {
  const { setValue, getValue } = useGlobalContext()

  const [isLoading, setIsLoading] = useState(false)

  const [taskTypes, setTaskTypes] =
    useState<ComboboxItemType[]>([])

  const [tasksList, setTasksList] =
    useState<ComboboxItemType[]>([])

  const [activeUsers, setActiveUsers] =
    useState<ComboboxItemType[]>([])

  const [formValues, setFormValues] =
    useState<TaskFormValues>({
      subject: '',
      issue: '',
      assigned_to: '',
      priority: defaultPriority ?? '',
      task_type: defaultTaskTypeId ? String(defaultTaskTypeId) : '',
      parent_task: '',
      color: '#000000'
    })

  const handleChange = <K extends keyof TaskFormValues>(
    name: K,
    value: TaskFormValues[K]
  ) => {
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }))
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault()

    if (
      !formValues.subject ||
      !formValues.assigned_to ||
      !formValues.priority ||
      !formValues.task_type
    ) {
      toast.error(
        'Please fill required fields'
      )
      return
    }

    setIsLoading(true)

    const payload: SavetaskPayload = {
      id: null,
      project_id: Number(projectId),
      subject: formValues.subject,
      issue: formValues.issue || undefined,
      priority: formValues.priority as "low" | "mid" | "high",
      task_type: Number(formValues.task_type),
      parent_task: formValues.parent_task ? Number(formValues.parent_task) : null,
      color: formValues.color,
      assigned_to: Number(formValues.assigned_to),
    }

    try {
      const taskId = await savetask(payload)

      toast.success('Task created')

      onCreated?.(taskId, formValues.subject)
      onClose?.()
    } catch (err) {
      console.error(err)
      toast.error('Insert failed')
    }

    setIsLoading(false)
  }

  useEffect(() => {
    let cancelled = false

    const loadFormOptions = async () => {
      const [types, projectTasks] = await Promise.all([
        getTaskType(),
        getTaskinNewTaskAPi(Number(projectId)),
      ])
      if (cancelled) return

      const users = getValue('activeUsers')
      const session = getValue('UserInfoAuthSession')
      const currentUserId = Array.isArray(session) ? session[0]?.id : null

      setTaskTypes(types.map((type) => ({
        code: String(type.id),
        name: type.name,
      })))
      setTasksList(projectTasks.map((task) => ({
        code: String(task.id),
        name: task.subject,
      })))
      setActiveUsers((Array.isArray(users) ? users : []).map((user) => ({
        code: String(user.code),
        name: String(user.name),
      })))
      const availableDefaultTaskTypeId = types.some(
        type => Number(type.id) === Number(defaultTaskTypeId)
      )
        ? defaultTaskTypeId
        : types[0]?.id
      setFormValues(current => ({
        ...current,
        priority: current.priority || defaultPriority || '',
        task_type: current.task_type || String(availableDefaultTaskTypeId ?? ''),
        assigned_to: current.assigned_to || String(currentUserId ?? ''),
        color: current.color === '#000000' ? getRandomTaskColor() : current.color,
      }))
    }

    void loadFormOptions()
    return () => {
      cancelled = true
    }
  }, [defaultPriority, defaultTaskTypeId, getValue, projectId])

  useEffect(() => {
    setValue('loading_g', isLoading)
  }, [isLoading, setValue])

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit}
    >
        <div className="grid grid-cols-2 gap-4 px-4">

          <div>
            <SearchableCombobox
              label="Assigned To"
              required
              items={activeUsers}
              value={formValues.assigned_to}
              onValueChange={val => handleChange('assigned_to', val)}
            />
          </div>

          {/* SUBJECT */}
          <div>
            <Label required className='mb-2'>
              Subject
            </Label>
            <Input
              value={formValues.subject}
              onChange={e =>
                handleChange(
                  'subject',
                  e.target.value
                )
              }
            />
          </div>

          {/* PRIORITY */}
          <div>
            <SearchableCombobox
              label="Priority"
              required
              items={[
                {
                  code: 'low',
                  name: 'Low'
                },
                {
                  code: 'mid',
                  name: 'Medium'
                },
                {
                  code: 'high',
                  name: 'High'
                }
              ]}
              value={formValues.priority}
              onValueChange={val =>
                handleChange(
                  'priority',
                  val
                )
              }
            />
          </div>

          {/* TASK TYPE */}
          <div>
            <SearchableCombobox
              label="Task Type"
              required
              items={taskTypes}
              value={formValues.task_type}
              onValueChange={val =>
                handleChange(
                  'task_type',
                  val
                )
              }
            />
          </div>

          {/* PARENT TASK */}
          <div>
            <SearchableCombobox
              label="Parent Task"
              items={tasksList}
              value={formValues.parent_task}
              onValueChange={val =>
                handleChange(
                  'parent_task',
                  val
                )
              }
            />
          </div>
{/*  */}
          {/* COLOR */}
          <div>
            <Label className='mb-2'>Color</Label>
            <Input
              type="color"
              value={formValues.color}
              onChange={e =>
                handleChange(
                  'color',
                  e.target.value
                )
              }
            />
          </div>

          {/* ISSUE */}
          <div className="col-span-2">
            <Label>Issue</Label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={formValues.issue}
              onChange={e =>
                handleChange(
                  'issue',
                  e.target.value
                )
              }
            />
          </div>

        </div>

        <div className="flex justify-end p-4">
          <Button
            type="submit"
            disabled={isLoading}
          >
            Save Task
          </Button>
        </div>
    </form>
  )
}
