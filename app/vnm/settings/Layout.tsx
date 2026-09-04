'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import Breadcrumb from '@/lib/Breadcrumb'
import SearchableCombobox from '@/components/SearchableCombobox'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ModuleSettingsHeader, SettingRow, SettingsCategory } from '@/components/settings/ModuleSettingsLayout'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import {
  getVnmReferences,
  saveVnmMasterValue,
  saveVnmSettings,
  voidVnmMasterValue,
  type VnmFmsType,
  type VnmMasterValue,
  type VnmSetting,
} from '@/lib/data/repositories/vaccinationMeds'

const blankSetting = (fmsType: VnmFmsType): VnmSetting => ({
  fms_type: fmsType,
  medication_group_id: null,
  auto_batch_selection: true,
  allow_historical_cycle_selection: false,
})

export default function VnmSettingsLayout() {
  const { getValue } = useGlobalContext()
  const profile = getValue('UserInfoAuthSession')?.[0]
  const isSuperuser = Number(profile?.user_type ?? 3) === 1
  const [fmsType, setFmsType] = useState<VnmFmsType>('Broiler')
  const [setting, setSetting] = useState<VnmSetting>(blankSetting('Broiler'))
  const [groups, setGroups] = useState<Array<{ id?: number; code: string; name: string }>>([])
  const [routes, setRoutes] = useState<VnmMasterValue[]>([])
  const [indications, setIndications] = useState<VnmMasterValue[]>([])
  const [routeName, setRouteName] = useState('')
  const [indicationName, setIndicationName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const reference = await getVnmReferences(null, fmsType)
      setSetting(reference.settings ?? blankSetting(fmsType))
      setGroups(reference.itemGroups)
      setRoutes(reference.routes)
      setIndications(reference.indications)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Vaccination and Meds settings could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [fmsType])

  useEffect(() => { void load() }, [load])

  const groupOptions = useMemo(() => groups.map(group => ({ code: String(group.id), name: `${group.code} - ${group.name}` })), [groups])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!isSuperuser) return toast.error('Only a Super Admin can edit these settings.')
    if (!setting.medication_group_id) return toast.error('Select a Medication Group.')
    setSaving(true)
    try {
      await saveVnmSettings(setting)
      toast.success(`${fmsType} Vaccination and Meds settings saved.`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Settings could not be saved.')
    } finally { setSaving(false) }
  }

  const addMaster = async (master: 'route' | 'indication') => {
    const value = master === 'route' ? routeName : indicationName
    if (!value.trim()) return
    try {
      await saveVnmMasterValue(master, value)
      if (master === 'route') setRouteName(''); else setIndicationName('')
      await load()
      toast.success(`${master === 'route' ? 'Route' : 'Indication'} added.`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Master data could not be saved.') }
  }

  const removeMaster = async (master: 'route' | 'indication', id: number) => {
    if (!window.confirm('Remove this value from future selection? Existing documents will keep their saved value.')) return
    try { await voidVnmMasterValue(master, id); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Master data could not be removed.') }
  }

  const masterPanel = (title: string, master: 'route' | 'indication', values: VnmMasterValue[], value: string, setValue: (value: string) => void) => (
    <SettingsCategory title={`${title} Master`} description={`Global ${title.toLowerCase()} values available to Broiler and Breeder documents.`}>
      <SettingRow label={`Add ${title}`} description="Only Super Admin users can maintain this list." settingKey={`${master.toUpperCase()}_MASTER`}>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input value={value} disabled={!isSuperuser || saving} onChange={event => setValue(event.target.value)} placeholder={`${title} name`} />
            <Button type="button" size="icon" disabled={!isSuperuser || !value.trim()} onClick={() => void addMaster(master)} aria-label={`Add ${title}`}><Plus className="size-4" /></Button>
          </div>
          <div className="max-h-52 divide-y overflow-y-auto rounded-md border">
            {values.length ? values.map(item => <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm"><span>{item.name}</span><Button type="button" size="icon" variant="ghost" disabled={!isSuperuser} onClick={() => void removeMaster(master, item.id)} aria-label={`Remove ${item.name}`}><Trash2 className="size-4" /></Button></div>) : <div className="px-3 py-4 text-sm text-muted-foreground">No values configured.</div>}
          </div>
        </div>
      </SettingRow>
    </SettingsCategory>
  )

  return <main className="mx-auto max-w-6xl space-y-3 p-3 sm:p-4">
    <Breadcrumb FirstPreviewsPageName="Animal Health" FirstPreviewsPageLink="/vnm" CurrentPageName="Vaccination and Meds Settings" />
    <ModuleSettingsHeader title="Vaccination and Meds Settings" description="Configure medication eligibility, cycle selection, and FIFO allocation." formId="vnm-settings-form" loading={loading} saving={saving} disableSave={!isSuperuser || !setting.medication_group_id} onRefresh={() => void load()} />
    {!isSuperuser && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">These settings are read-only. Only a Super Admin can edit them.</div>}
    <form id="vnm-settings-form" onSubmit={submit} className="space-y-3">
      <SettingsCategory title="FMS Configuration" description="Medication rules are maintained independently for Broiler and Breeder.">
        <SettingRow label="FMS Type" description="Choose which operating group to configure." settingKey="FMS_TYPE" required>
          <select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={fmsType} onChange={event => setFmsType(event.target.value as VnmFmsType)}><option>Broiler</option><option>Breeder</option></select>
        </SettingRow>
        <SettingRow label="Medication Group" description="Includes active inventory items in this Item Group and every descendant subgroup." settingKey="MEDICATION_GROUP" required>
          <SearchableCombobox items={groupOptions} value={setting.medication_group_id ? String(setting.medication_group_id) : ''} onValueChange={value => setSetting(current => ({ ...current, medication_group_id: value ? Number(value) : null }))} showCode disabled={!isSuperuser || loading} placeholder="Select Item Group" className="w-full" />
        </SettingRow>
        <SettingRow label="Auto Batch Selection" description="Automatically split the requested quantity across available batches using FIFO." settingKey="AUTO_BATCH_SELECTION">
          <div className="flex items-center gap-3"><Checkbox id="vnm-auto-batch" checked={setting.auto_batch_selection} disabled={!isSuperuser || loading} onCheckedChange={checked => setSetting(current => ({ ...current, auto_batch_selection: checked === true }))} /><Label htmlFor="vnm-auto-batch">{setting.auto_batch_selection ? 'Enabled' : 'Disabled'}</Label></div>
        </SettingRow>
        <SettingRow label="Allow Historical Cycle Selection" description="Broiler only. When enabled, users may select Active or Closed cycles; Cancelled cycles remain excluded." settingKey="ALLOW_HISTORICAL_CYCLE_SELECTION">
          <div className="flex items-center gap-3"><Checkbox id="vnm-history" checked={setting.allow_historical_cycle_selection} disabled={!isSuperuser || loading || fmsType === 'Breeder'} onCheckedChange={checked => setSetting(current => ({ ...current, allow_historical_cycle_selection: checked === true }))} /><Label htmlFor="vnm-history">{fmsType === 'Breeder' ? 'Not applicable' : setting.allow_historical_cycle_selection ? 'Enabled' : 'Disabled'}</Label></div>
        </SettingRow>
      </SettingsCategory>
    </form>
    <div className="grid gap-3 lg:grid-cols-2">{masterPanel('Route', 'route', routes, routeName, setRouteName)}{masterPanel('Indication', 'indication', indications, indicationName, setIndicationName)}</div>
  </main>
}
