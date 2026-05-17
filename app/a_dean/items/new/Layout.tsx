'use client'

import React, { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { addItem } from '../api'
import SearchableDropdown from '@/lib/SearchableDropdown'

export default function AddItemPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [form, setForm] = useState({
    item_code: '',
    item_name: '',
    description: '',
    barcode: '',
    unit_measure: 'pcs',
    item_group: '',
    group: ""
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // async function handleSubmit(e: React.FormEvent) {
  //   e.preventDefault()

  //   setLoading(true)
  //   setMessage(null)


  //   try {
  //     await addItem(form)

  //     setMessage('✅ Item added successfully')

  //     setForm({
  //       item_code: '',
  //       item_name: '',
  //       description: '',
  //       barcode: '',
  //       unit_measure: 'pcs',
  //       item_group: '',
  //     })
  //   } catch (err: any) {
  //     setMessage('❌ ' + err.message)
  //   } finally {
  //     setLoading(false)
  //   }
  // }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setMessage(null)

    // ✅ validation
    if (
      !form.item_code.trim() ||
      !form.item_name.trim() ||
      !form.barcode.trim() ||
      !form.unit_measure.trim() ||
      !form.item_group.trim()
    ) {
      setMessage('❌ Please fill in all required fields')
      return
    }

    setLoading(true)

    try {
      await addItem({
        ...form,
        group: form.item_group, // ✅ added group
      })

      setMessage('✅ Item added successfully')

      setForm({
        item_code: '',
        item_name: '',
        description: '',
        barcode: '',
        unit_measure: 'pcs',
        item_group: '',
        group: '',
      })
    } catch (err: any) {
      setMessage('❌ ' + err.message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className=" mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Item</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* 🔹 GRID 2 COLUMNS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Item Code */}
              <div className="space-y-2">
                <Label>Item Code *</Label>
                <Input
                  name="item_code"
                  value={form.item_code}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Item Name */}
              <div className="space-y-2">
                <Label>Item Name</Label>
                <Input
                  name="item_name"
                  value={form.item_name}
                  onChange={handleChange}
                />
              </div>

              {/* Barcode */}
              <div className="space-y-2">
                <Label>Barcode</Label>
                <Input
                  name="barcode"
                  value={form.barcode}
                  onChange={handleChange}
                />
              </div>

              {/* Item Group */}
              <div className="space-y-2">
                <Label>Item Group</Label>
                {/* <Input
                  name="item_group"
                  value={form.item_group}
                  onChange={handleChange}
                /> */}
                <SearchableDropdown
                  codeLabel='code'
                  value={form.item_group}
                  nameLabel='name'

                  list={[
                    { code: "E", name: "Eggs" }, // needs to be a master data
                    { code: "F", name: "Feeds" },
                    { code: "C", name: "Consumables" },
                    { code: "T", name: "Tools" }
                  ]}
                  onChange={(e) => {
                    console.log({ e })
                    setForm((prev) => ({ ...prev, item_group: e }))
                  }}
                />
              </div>

              {/* 🔥 Unit of Measure Dropdown */}
              <div className="space-y-2">
                <Label>Unit of Measure</Label>

                <Select
                  value={form.unit_measure}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      unit_measure: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select UoM" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="pcs">pcs (Pieces)</SelectItem>
                    <SelectItem value="box">box</SelectItem>
                    <SelectItem value="pack">pack</SelectItem>
                    <SelectItem value="set">set</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="liter">liter</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="meter">meter</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                    <SelectItem value="roll">roll</SelectItem>
                    <SelectItem value="pair">pair</SelectItem>
                    <SelectItem value="dozen">dozen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>

            {/* 🔹 FULL WIDTH DESCRIPTION */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                name="description"
                value={form.description}
                onChange={handleChange}
              />
            </div>

            {/* 🔹 ACTIONS */}
            <div className="flex items-center gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Add Item'}
              </Button>

              {message && (
                <span className="text-sm">{message}</span>
              )}
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  )
}
