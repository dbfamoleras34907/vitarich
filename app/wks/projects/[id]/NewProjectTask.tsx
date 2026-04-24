'use client'

import SearchableCombobox, {
  ComboboxItemType
} from '@/components/SearchableCombobox'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import React, { useEffect, useState } from 'react'
import { savetask, SavetaskPayload } from '../../tasks/new/api'
import { getTaskType } from '../../tasks/api'
import { toast } from 'sonner'

interface Props {
  projectId: string
  onClose?: () => void
}

export default function NewProjectTask({
  projectId,
  onClose
}: Props) {
  const { setValue } = useGlobalContext()

  const [isLoading, setIsLoading] = useState(false)

  const [taskTypes, setTaskTypes] =
    useState<ComboboxItemType[]>([])

  const [tasksList, setTasksList] =
    useState<ComboboxItemType[]>([])

  const [formValues, setFormValues] =
    useState({
      subject: '',
      issue: '',
      priority: null as ComboboxItemType | null,
      task_type: null as ComboboxItemType | null,
      parent_task: null as ComboboxItemType | null,
      color: '#000000'
    })

  const handleChange = (
    name: string,
    value: any
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
      priority:
        formValues.priority.code as "low" | "mid" | "high",
      task_type:
        Number(formValues.task_type.code),
      parent_task:
        formValues.parent_task?.code
          ? Number(formValues.parent_task.code)
          : null,
      color: formValues.color
    }

    try {
      await savetask(payload)

      toast.success('Task created')

      onClose?.()
    } catch (err) {
      console.error(err)
      toast.error('Insert failed')
    }

    setIsLoading(false)
  }

  const loadTaskTypes = async () => {
    const data = await getTaskType()
    console.log({ data })
    setTaskTypes(
      (data || []).map((t: any) => ({
        code: t.id,
        name: t.name
      }))
    )
  }

  useEffect(() => {
    loadTaskTypes()
  }, [])

  useEffect(() => {
    setValue('loading_g', isLoading)
  }, [isLoading])

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit}
    >
        <div className="grid grid-cols-2 gap-4 px-4">

          {/* SUBJECT */}
          <div>
            <Label required>
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
              value={formValues.priority?.code || ''}
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
              value={formValues.task_type?.code || ''}
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
              value={formValues.parent_task?.code || ''}
              onValueChange={val =>
                handleChange(
                  'parent_task',
                  val
                )
              }
            />
          </div>

          {/* COLOR */}
          <div>
            <Label>Color</Label>
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