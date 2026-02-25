'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { createWarehouse } from './api'
import { WarehouseData } from '@/lib/types'
import Breadcrumb from '@/lib/Breadcrumb'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface FormItem {
  code: string;
  name: string;
  type: 'text' | 'checkbox' | 'select' | 'empty';
  required?: boolean;
  disabled?: boolean;
  remarks?: string;
  value?: string;
}

const WAREHOUSE_TYPES = [
  "Poultry-Farm",
  "Breeder-Farm",
  "Breeder_Layer",
  "Poultry-Hatchery"
]

// --- 1. MOVE FORmFIELD OUTSIDE THE MAIN COMPONENT ---
const FormField = ({
  item,
  formData,
  handleInputChange
}: {
  item: FormItem,
  formData: Partial<WarehouseData>,
  handleInputChange: (code: string, value: any) => void
}) => {
  if (item.type === "empty") return <div className="hidden md:block" />

  const fieldCode = item.code as keyof WarehouseData

  return (
    <div className="flex flex-col space-y-1.5">
      {item.type === "checkbox" ? (
        <div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={item.code}
              checked={!!formData[fieldCode]}
              onCheckedChange={(checked) => handleInputChange(item.code, checked)}
            />
            <Label htmlFor={item.code} className="cursor-pointer">
              {item.name}
            </Label>
          </div>
          {item.remarks && (
            <div className="mt-1 ml-6 text-xs text-muted-foreground">
              {item.remarks}
            </div>
          )}
        </div>
      ) : (
        <>
          <Label required={item.required}>
            {item.name}
          </Label>

          {item.type === "select" ? (
            <Select
              value={(formData[fieldCode] as string) || ""}
              onValueChange={(value) => handleInputChange(item.code, value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select warehouse type" />
              </SelectTrigger>
              <SelectContent>
                {WAREHOUSE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={(formData[fieldCode] as string) || ""}
              onChange={(e) => handleInputChange(item.code, e.target.value)}
              disabled={item.disabled}
              required={item.required}
            />
          )}

          {item.remarks && (
            <div className="text-xs text-muted-foreground">
              {item.remarks}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function Layout() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<Partial<WarehouseData>>({
    is_active: true,
    bin_activated: false,
  })

  const warehouseDetail: FormItem[] = [
    { code: "whse_code", name: "Warehouse Code", disabled: false, type: "text", required: true },
    { code: "whse_name", name: "Warehouse Name", disabled: false, type: "text", required: true },
    { code: "warehouse_type", name: "Warehouse Type", disabled: false, type: "select", required: true },
    { code: "subinventory_desc", name: "Sub Inventory Desc", disabled: false, type: "text", required: false },
  ]

  const contactInfo: FormItem[] = [
    { code: "phone", name: "Phone No", disabled: false, type: "text" },
    { code: "addr1", name: "Address Line 1", disabled: false, type: "text" },
    { code: "mobile", name: "Mobile No", disabled: false, type: "text" },
    { code: "addr2", name: "Address Line 2", disabled: false, type: "text" },
    { code: "city", name: "City", disabled: false, type: "text" },
    { code: "province", name: "State/Province", disabled: false, type: "text" },
  ]

  const handleInputChange = (code: string, value: any) => {
    setFormData((prev) => ({ ...prev, [code]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { success, error } = await createWarehouse(formData as WarehouseData)
    setLoading(false)

    if (success) {
      toast("Warehouse created successfully")
      router.push("/a_dean/warehouse")

    } else {
      toast("Error: " + error)
    }
  }

  useEffect(() => {
    router.prefetch("/a_dean/warehouse")
  }, [])

  return (
    <div className='w-full'>
      <form onSubmit={handleSubmit}>
        <div className='flex justify-between items-center px-8 pb-3 mt-3'>
          <Breadcrumb
            SecondPreviewPageName="Warehouse"
            SecondPreviewPageLink="/a_dean/warehouse"
            CurrentPageName="Warehouse Master"
          />
          <Button type="submit" disabled={loading}>
            <Plus className="mr-2 h-4 w-4" /> {loading ? "Saving..." : "Save"}
          </Button>
        </div>

        <Separator />

        <div className="max-w-content mx-auto px-8 py-8 bg-white rounded-2xl my-4">
          <h2 className="mb-6 text-lg font-semibold">Warehouse Detail</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
            {warehouseDetail.map((item) => (
              <FormField
                key={item.code}
                item={item}
                formData={formData}
                handleInputChange={handleInputChange}
              />
            ))}
          </div>
        </div>

        <Separator />

        <div className="max-w-content mx-auto px-8 py-8 bg-white rounded-2xl mt-4">
          <div className="flex items-center space-x-2 mb-6">
            <h2 className="text-lg font-semibold">Warehouse Location Info</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
            {contactInfo.map((item) => (
              <FormField
                key={item.code}
                item={item}
                formData={formData}
                handleInputChange={handleInputChange}
              />
            ))}
          </div>
        </div>
      </form>
    </div>
  )
}