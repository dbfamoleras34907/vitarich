'use client'

import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import SearchableCombobox from '@/components/SearchableCombobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { FarmBuildingListRow } from '@/app/brd/fc/api'
import { flockCardBreedComboOptions } from '@/app/brd/fc/[buildingId]/add-flock/api'
import { Modal } from '@/lib/Moda'

export type CycleInformationForm = {
  startDate: string
  asOfDate: string
  breed: string
  cycleNumber: string
}

type CycleInformationModalProps = {
  open: boolean
  building: FarmBuildingListRow | null
  form: CycleInformationForm
  age: number
  saving: boolean
  cycleNumberEditable: boolean
  farmCycle: boolean
  onOpenChange: (open: boolean) => void
  onFormChange: (changes: Partial<CycleInformationForm>) => void
  onCancel: () => void
  onCreate: () => void
}

export default function CycleInformationModal({
  open,
  building,
  form,
  age,
  saving,
  cycleNumberEditable,
  farmCycle,
  onOpenChange,
  onFormChange,
  onCancel,
  onCreate,
}: CycleInformationModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={farmCycle ? 'Create Farm Cycle' : 'Create Building Cycle'}
      description={
        building
          ? `${building.code} - ${building.name} does not have an active cycle${farmCycle ? ' and will copy the active farm Cycle Count.' : '.'}`
          : 'Complete the cycle information for the selected building.'
      }
      className="max-w-2xl"
      overlayZIndex={300}
    >
      <div className="px-4 pb-4">
        <Tabs defaultValue="cycle">
          <TabsList>
            <TabsTrigger value="cycle">Cycle Information</TabsTrigger>
          </TabsList>
          <TabsContent value="cycle" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Building</Label>
                <Input
                  value={building ? `${building.code} - ${building.name}` : ''}
                  readOnly
                  className="bg-stone-50"
                />
              </div>
              <div className="space-y-2">
                <Label>Cycle Count</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={form.cycleNumber}
                  readOnly={!cycleNumberEditable}
                  className={!cycleNumberEditable ? 'bg-stone-50' : undefined}
                  onChange={event => onFormChange({ cycleNumber: event.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label required>Cycle Date</Label>
                <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                  <Input
                    type="date"
                    aria-label="Cycle date from"
                    value={form.startDate}
                    max={form.asOfDate || undefined}
                    onChange={event => onFormChange({ startDate: event.target.value })}
                  />
                  <span className="text-center text-sm text-stone-500">to</span>
                  <Input
                    type="date"
                    aria-label="Cycle date to"
                    value={form.asOfDate}
                    min={form.startDate || undefined}
                    onChange={event => onFormChange({ asOfDate: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Age</Label>
                <Input value={age} readOnly className="bg-stone-50 text-right" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label required>Breed</Label>
                <SearchableCombobox
                  items={flockCardBreedComboOptions}
                  value={form.breed}
                  onValueChange={breed => onFormChange({ breed })}
                  placeholder="Select breed"
                  showCode={false}
                  className="w-full"
                  contentPositionerZIndex={310}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={onCreate}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? 'Creating...' : 'Create Cycle'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
