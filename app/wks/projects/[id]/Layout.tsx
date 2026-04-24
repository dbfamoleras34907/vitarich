'use client'
import SearchableCombobox, { ComboboxItemType } from '@/components/SearchableCombobox'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import Breadcrumb from '@/lib/Breadcrumb'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { parse } from 'path'
import { getProjectById } from './api'
import { saveProject, SaveProjectPayload } from '../new/api'
import { Modal } from '@/lib/Moda'
import NewProjectTask from './NewProjectTask'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function Layout() {
  const { setValue, getValue } = useGlobalContext();
  const [activeUsers, setactiveUsers] = useState<ComboboxItemType[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { id } = useParams()
  const [modalOpen, setmodalOpen] = useState(false)
  const [formValues, setFormValues] = useState<Partial<SaveProjectPayload>>({})
  const components = [
    { name: "project_name", label: "Project Name", type: "text", required: true, placeholder: "Enter project name" },
    { name: "description", label: "Description", type: "text", required: false, placeholder: "Enter project description" },
    { name: "start_date", label: "Start Date", type: "date", required: true },
    { name: "end_date", label: "End Date", type: "date", required: true },
    // { name: "project_manager", label: "Project Manager", type: "text", required: false, placeholder: "Enter project manager name" },
    {
      name: "project_manager",
      label: "Project Manager",
      type: "search",
      required: false,
      multiselect: false,
      placeholder: "Enter project manager"
      , list: activeUsers

    },
    {
      name: "project_members",
      label: "Project Members",
      type: "search",
      required: false,
      multiselect: true,
      placeholder: "Enter project members"
      , list: activeUsers
    },

    {
      name: "project_type",
      label: "Project Type",
      type: "search",
      required: true,
      multiselect: false,
      placeholder: "Enter project type",
      list: [
        { code: "1", name: "Software Development" },
        { code: "2", name: "Marketing Campaign" },
        { code: "3", name: "Event Planning" },
      ]
    },
  ]

  const handleChange = (name: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const getActiveUsers = async () => {
    try {
      const data = await getValue("activeUsers");
      setactiveUsers(data);
    } catch (error) {
      console.error("Error fetching active users:", error);
    }
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setIsLoading(true)
    if (
      !formValues.project_name ||
      !formValues.start_date ||
      !formValues.end_date ||
      !formValues.project_type
    ) {
      console.error("Missing required fields")
      return
    }

    const payload: SaveProjectPayload = {
      id: parseInt(id as string) || null,
      project_name: formValues.project_name,
      description: formValues.description,
      start_date: formValues.start_date,
      end_date: formValues.end_date,
      project_manager: formValues.project_manager,
      project_type: formValues.project_type,
      project_members: formValues.project_members ?? []
    }
    console.log({ payload })
    try {
      const id = await saveProject(payload)
      console.log("Saved project:", id)
    } catch (err) {
      console.error(err)
    }
    setIsLoading(false)
  }

  const loadProject = async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const data = await getProjectById(Number(id))

      setFormValues({
        id: data.id,
        project_name: data.project_name,
        description: data.description,
        start_date: new Date(data.start_date),
        end_date: new Date(data.end_date),
        project_manager: data.project_manager,
        project_type: data.project_type,
        project_members: data.project_members ?? []
      })
    } catch (err) {
      console.error(err)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadProject()
  }, [id])

  useEffect(() => {
    setValue("loading_g", isLoading);
  }, [isLoading])


  useEffect(() => {
    getActiveUsers();
  }, [getValue])


  return (
    <div>
      <form className="space-y-4 mt-8" onSubmit={handleSubmit}>

        <div className='flex items-center justify-between'>
          <Breadcrumb
            CurrentPageName='View Project'
            FirstPreviewsPageName='Projects'
          />
          <div className='flex gap-2'>
            <Button
              type="button"
              variant={"secondary"}
              onClick={() => setmodalOpen(true)}
              disabled={isLoading}
            >
              New Task
            </Button>


            <Button
              type="submit"
              disabled={isLoading}
            >
              Save
            </Button>

          </div>
        </div>

        <Card className='shadow-none'>
          <div className="grid grid-cols-2 gap-4 px-4">

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

      </form >

      {/* <Modal
        open={modalOpen}
        onOpenChange={(open) => setmodalOpen(open)}
        title="Create New Task"
      >
        <div className=' bg-card m-2 pt-4 rounded-md'>
          <NewProjectTask projectId={id as string} />   

        </div>
      </Modal> */}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">

          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setmodalOpen(false)}
          />

          {/* modal content */}
          <div className="relative z-10 w-full max-w-2xl rounded-lg bg-white shadow-lg p-6">

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Create New Task
              </h2>

              <button
                type="button"
                onClick={() => setmodalOpen(false)}
                className="text-gray-500 hover:text-black"
              >
                ✕
              </button>
            </div>

            <NewProjectTask projectId={id as string} />

          </div>
        </div>
      )}


      {/* <NewProjectTask projectId={id as string} />  update */}
      {/* /task list */}
      <div>
            // task list here
      </div>
    </div >
  )
}