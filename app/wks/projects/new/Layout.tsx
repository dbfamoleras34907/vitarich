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
import { CalendarIcon, Plus } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { saveProject, SaveProjectPayload } from './api'
import EggHenLoaderIcon from '@/app/components/EggHenLoaderIcon'
import { useRouter } from 'next/navigation'

export default function Layout() {
  const { setValue, getValue } = useGlobalContext();
  const [activeUsers, setactiveUsers] = useState<ComboboxItemType[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const router = useRouter()
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
      id: null,
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
      router.push(`/wks/projects/${id}`)
    } catch (err) {
      console.error(err)
    }
    setIsLoading(false)
  }



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
            CurrentPageName='Create New Project'
            FirstPreviewsPageName='Projects'
          />
          <Button
            type="submit"
            disabled={isLoading}
          >
            {!isLoading ?
              <Plus className='mr-2 h-4 w-4' /> :
              <EggHenLoaderIcon className='mr-2 h-4 w-4' />
            }


            Save
          </Button>
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

      </form>
    </div>
  )
}