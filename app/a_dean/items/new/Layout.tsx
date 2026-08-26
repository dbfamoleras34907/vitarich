'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Boxes, ChevronDown, PackageCheck, Save, Settings2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import SearchableDropdown from '@/lib/SearchableDropdown'
import { usePermission } from '@/hooks/usePermission'
import { addItem, getItemUomGroups, getNextItemCode, ItemInsert, ItemUomGroup } from '../api'
import { getItemGroups, getSubItemGroups, ItemGroup } from '../../itemgroups/api'

type ItemForm = {
  item_name: string
  description: string
  barcode: string
  uom_group_code: string
  item_group: string
  sub_item_group_id: string
  fms_group: string
  is_inventory_item: boolean
  is_sales_item: boolean
  is_purchase_item: boolean
  is_delivery_item: boolean
  manage_batch_numbers: boolean
  manage_serial_numbers: boolean
  batch_management_method: string
  default_shelf_life_days: string
  default_expiration_months: string
  default_expiry_required: boolean
  allow_negative_batch_stock: boolean
  batch_number_series: string
  min_on_hand: string
  max_on_hand: string
}

type SaveMode = 'createAnother' | 'goToList'

const emptyForm: ItemForm = {
  item_name: '',
  description: '',
  barcode: '',
  uom_group_code: '',
  item_group: '',
  sub_item_group_id: '',
  fms_group: '',
  is_inventory_item: true,
  is_sales_item: true,
  is_purchase_item: true,
  is_delivery_item: true,
  manage_batch_numbers: false,
  manage_serial_numbers: false,
  batch_management_method: 'NONE',
  default_shelf_life_days: '',
  default_expiration_months: '',
  default_expiry_required: false,
  allow_negative_batch_stock: false,
  batch_number_series: '',
  min_on_hand: '',
  max_on_hand: '',
}

const shelfLifeValue = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

const expirationMonthsValue = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

const optionalQuantityValue = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

const toPayload = (form: ItemForm, selectedUomGroup?: ItemUomGroup): ItemInsert => ({
  item_name: form.item_name,
  description: form.description,
  barcode: form.barcode,
  unit_measure: selectedUomGroup?.baseUomCode || form.uom_group_code,
  inventory_uom: form.uom_group_code,
  item_group: form.item_group,
  sub_item_group_id: form.sub_item_group_id ? Number(form.sub_item_group_id) : null,
  fms_group: form.fms_group,
  group: form.item_group,
  is_inventory_item: form.is_inventory_item,
  is_sales_item: form.is_sales_item,
  is_purchase_item: form.is_purchase_item,
  is_delivery_item: form.is_delivery_item,
  manage_batch_numbers: form.manage_batch_numbers,
  manage_serial_numbers: form.manage_serial_numbers,
  batch_management_method: form.manage_batch_numbers ? form.batch_management_method : 'NONE',
  default_shelf_life_days: shelfLifeValue(form.default_shelf_life_days),
  default_expiration_months: expirationMonthsValue(form.default_expiration_months),
  default_expiry_required: form.default_expiry_required,
  allow_negative_batch_stock: form.allow_negative_batch_stock,
  batch_number_series: form.batch_number_series,
  min_on_hand: optionalQuantityValue(form.min_on_hand),
  max_on_hand: optionalQuantityValue(form.max_on_hand),
})

export default function AddItemPage() {
  const router = useRouter()
  const canInsert = !usePermission('/a_dean/items/insert')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([])
  const [subItemGroups, setSubItemGroups] = useState<ItemGroup[]>([])
  const [uomGroups, setUomGroups] = useState<ItemUomGroup[]>([])
  const [form, setForm] = useState<ItemForm>(emptyForm)
  const [nextItemCode, setNextItemCode] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<ItemInsert | null>(null)
  const [pendingSaveMode, setPendingSaveMode] = useState<SaveMode>('createAnother')

  const selectedGroup = useMemo(
    () => itemGroups.find(group => group.code === form.item_group),
    [form.item_group, itemGroups],
  )
  const availableSubItemGroups = useMemo(
    () => subItemGroups.filter(group => Number(group.father) === selectedGroup?.id),
    [selectedGroup?.id, subItemGroups],
  )
  const subItemGroupOptions = useMemo(
    () => [
      { id: '', label: 'No sub item group' },
      ...availableSubItemGroups.map(group => ({
        id: String(group.id),
        label: `${group.code} - ${group.name}`,
      })),
    ],
    [availableSubItemGroups],
  )
  const selectedSubItemGroup = useMemo(
    () => availableSubItemGroups.find(group => String(group.id) === form.sub_item_group_id),
    [availableSubItemGroups, form.sub_item_group_id],
  )
  const selectedUomGroup = useMemo(
    () => uomGroups.find(group => group.code === form.uom_group_code),
    [form.uom_group_code, uomGroups],
  )
  const itemCodePreview = form.item_group ? nextItemCode || 'Generating...' : 'Select item group'
  const messageIsSuccess = message?.startsWith('Item saved successfully')

  useEffect(() => {
    router.prefetch('/a_dean/items')

    if (!canInsert) {
      router.replace('/a_dean/items')
      return
    }

    const loadItemGroups = async () => {
      try {
        const [groups, subGroups, uomGroupData] = await Promise.all([
          getItemGroups(),
          getSubItemGroups(),
          getItemUomGroups(),
        ])
        setItemGroups((groups || []) as ItemGroup[])
        setSubItemGroups((subGroups || []) as ItemGroup[])
        setUomGroups(uomGroupData)
      } catch (error) {
        console.error('Error loading item references:', error)
        setItemGroups([])
        setSubItemGroups([])
        setUomGroups([])
      }
    }

    loadItemGroups()
  }, [canInsert, router])

  useEffect(() => {
    let cancelled = false

    if (!form.item_group) {
      setNextItemCode('')
      return
    }

    const timer = window.setTimeout(() => {
      getNextItemCode(form.item_group)
        .then(code => {
          if (!cancelled) setNextItemCode(code)
        })
        .catch(error => {
          console.error('Error generating next item code:', error)
          if (!cancelled) setNextItemCode('')
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [form.item_group])

  const updateForm = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
  }

  function validateForm() {
    setMessage(null)

    if (!form.item_name.trim() || !form.uom_group_code.trim() || !form.item_group.trim() || !form.fms_group.trim()) {
      setMessage('Please complete the required item fields.')
      return false
    }

    if (form.manage_batch_numbers && form.batch_management_method === 'NONE') {
      setMessage('Choose a batch management method.')
      return false
    }

    if (form.default_shelf_life_days.trim() && shelfLifeValue(form.default_shelf_life_days) === null) {
      setMessage('Shelf life must be a whole number greater than or equal to 0.')
      return false
    }

    if (form.default_expiration_months.trim() && expirationMonthsValue(form.default_expiration_months) === null) {
      setMessage('Default expiration must be a whole number of months greater than or equal to 0.')
      return false
    }

    if (
      (form.min_on_hand.trim() && optionalQuantityValue(form.min_on_hand) === null) ||
      (form.max_on_hand.trim() && optionalQuantityValue(form.max_on_hand) === null)
    ) {
      setMessage('Min and max on-hand must be numbers greater than or equal to 0.')
      return false
    }

    return true
  }

  function prepareSave(mode: SaveMode = 'createAnother') {
    if (!validateForm()) return

    setPendingPayload(toPayload(form, selectedUomGroup))
    setPendingSaveMode(mode)
    setConfirmOpen(true)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    prepareSave('createAnother')
  }

  async function confirmSave() {
    if (!pendingPayload) return

    setConfirmOpen(false)
    setLoading(true)

    try {
      const savedItem = await addItem(pendingPayload)
      const savedCode = typeof savedItem?.item_code === 'string' ? savedItem.item_code : ''
      setMessage(`Item saved successfully${savedCode ? `: ${savedCode}` : ''}.`)
      setPendingPayload(null)

      if (pendingSaveMode === 'goToList') {
        router.push('/a_dean/items')
        return
      }

      setForm(current => ({ ...current, item_name: '' }))
      if (pendingPayload.item_group) {
        try {
          setNextItemCode(await getNextItemCode(pendingPayload.item_group))
        } catch (error) {
          console.error('Error generating next item code:', error)
          setNextItemCode('')
        }
      } else {
        setNextItemCode('')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add item.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-stone-50/40 p-4 text-stone-950">
      <form onSubmit={handleSubmit} className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">New Item</h1>
            <p className="mt-1 text-sm text-stone-500">Create item master data and inventory controls.</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => router.push('/a_dean/items')}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <div className="flex">
              <Button
                type="submit"
                disabled={loading || !canInsert}
                className="rounded-r-none border-r-primary-foreground/30"
              >
                <Save className="size-4" />
                {loading ? 'Saving...' : 'Save Item'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    disabled={loading || !canInsert}
                    className="rounded-l-none px-2"
                    aria-label="Select save option"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => prepareSave('createAnother')}>
                    Save and Create Another
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => prepareSave('goToList')}>
                    Save and Go to List
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {message && (
          <Alert
            className={
              messageIsSuccess
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }
          >
            <AlertTitle>{messageIsSuccess ? 'Item Saved' : 'Item Needs Attention'}</AlertTitle>
            <AlertDescription className={messageIsSuccess ? 'text-emerald-800' : 'text-amber-800'}>
              {message}
            </AlertDescription>
          </Alert>
        )}

        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
            <Boxes className="size-4 text-stone-500" />
            <h2 className="text-sm font-semibold">Item Details</h2>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Field label="Item Code">
              <div className="flex h-9 items-center rounded-md border border-stone-200 bg-stone-50 px-3 text-sm font-medium text-stone-700">
                {itemCodePreview}
              </div>
            </Field>
            <Field label="Item Name" required>
              <Input name="item_name" value={form.item_name} onChange={handleChange} placeholder="Feeds" />
            </Field>
            <Field label="Barcode">
              <Input name="barcode" value={form.barcode} onChange={handleChange} placeholder="Optional" />
            </Field>
            <Field label="Item Group" required hint={selectedGroup?.name}>
              <SearchableDropdown
                codeLabel="code"
                nameLabel="name"
                list={itemGroups}
                value={form.item_group}
                onChange={value => setForm(current => ({
                  ...current,
                  item_group: value,
                  sub_item_group_id: '',
                }))}
              />
            </Field>
            {availableSubItemGroups.length > 0 && (
              <Field label="Sub Item Group" hint={selectedSubItemGroup?.name}>
                <SearchableDropdown
                  codeLabel="id"
                  nameLabel="label"
                  list={subItemGroupOptions}
                  value={form.sub_item_group_id}
                  placeholder="Select sub item group"
                  showNameOnly
                  onChange={value => updateForm('sub_item_group_id', value)}
                />
              </Field>
            )}
            <Field label="FMS Group" required>
              <SelectNative value={form.fms_group} onChange={value => updateForm('fms_group', value)}>
                <option value="">Select FMS group</option>
                <option value="breeder">Breeder</option>
                <option value="hatchery">Hatchery</option>
                <option value="broiler">Broiler</option>
              </SelectNative>
            </Field>
            <Field label="UoM Group" required hint={selectedUomGroup ? `Base: ${selectedUomGroup.baseUomCode}` : undefined}>
              <SelectNative value={form.uom_group_code} onChange={value => updateForm('uom_group_code', value)}>
                <option value="">Select UoM group</option>
                {uomGroups.map(group => (
                  <option key={group.id} value={group.code}>
                    {group.code} - {group.name}
                  </option>
                ))}
              </SelectNative>
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Description">
              <Textarea name="description" value={form.description} onChange={handleChange} placeholder="Optional item description" />
            </Field>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
              <Settings2 className="size-4 text-stone-500" />
              <h2 className="text-sm font-semibold">Item Usage</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ToggleRow label="Inventory" checked={form.is_inventory_item} onChange={value => updateForm('is_inventory_item', value)} />
              <ToggleRow label="Sales" checked={form.is_sales_item} onChange={value => updateForm('is_sales_item', value)} />
              <ToggleRow label="Purchase" checked={form.is_purchase_item} onChange={value => updateForm('is_purchase_item', value)} />
              <ToggleRow label="Delivery" checked={form.is_delivery_item} onChange={value => updateForm('is_delivery_item', value)} />
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
              <PackageCheck className="size-4 text-stone-500" />
              <h2 className="text-sm font-semibold">Batch Control</h2>
            </div>

            <div className="mt-4 space-y-3">
              <ToggleRow
                label="Manage by Batch"
                checked={form.manage_batch_numbers}
                onChange={value => {
                  updateForm('manage_batch_numbers', value)
                  if (value && form.batch_management_method === 'NONE') updateForm('batch_management_method', 'MANUAL')
                  if (!value) updateForm('batch_management_method', 'NONE')
                }}
              />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Min On Hand">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={form.min_on_hand}
                    onChange={event => updateForm('min_on_hand', event.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field label="Max On Hand">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={form.max_on_hand}
                    onChange={event => updateForm('max_on_hand', event.target.value)}
                    placeholder="0"
                  />
                </Field>
              </div>

              <Field label="Default Expiration in Months">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={form.default_expiration_months}
                  onChange={event => updateForm('default_expiration_months', event.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>
          </div>
        </section>
      </form>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save this item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create {form.item_name || 'the item'} with item code {itemCodePreview}.
              {pendingSaveMode === 'createAnother'
                ? ' After saving, only the item name will be cleared.'
                : ' After saving, you will go back to the item list.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSave} disabled={loading}>
              {loading ? 'Saving...' : pendingSaveMode === 'createAnother' ? 'Save and Create Another' : 'Save and Go to List'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="space-y-2">
      <span className="flex items-center justify-between gap-3 text-sm font-medium text-stone-900">
        <span>{label}{required && <span className="text-red-600"> *</span>}</span>
        {hint && <span className="truncate text-xs font-normal text-stone-500">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function SelectNative({
  value,
  disabled,
  onChange,
  children,
}: {
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={event => onChange(event.target.value)}
      className="h-9 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-500 focus:ring-2 focus:ring-stone-200 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500"
    >
      {children}
    </select>
  )
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-3">
      <Label className="text-sm font-medium text-stone-800">{label}</Label>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  )
}
