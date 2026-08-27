'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import Breadcrumb from '@/lib/Breadcrumb'
import SearchableDropdown from '@/lib/SearchableDropdown'
import { Checkbox } from '@/components/ui/checkbox'
import UserFarmSearchCombobox, { getAllowedUserFarms, type UserFarm } from '@/components/ui/UserFarmSearchCombobox'
import { usePermission } from '@/hooks/usePermission'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { getFarmBuildingsForFlockCard, type FarmBuildingListRow } from '@/app/brd/fc/api'
import { ModuleSettingsHeader, SettingRow, SettingsCategory } from '@/components/settings/ModuleSettingsLayout'
import {
  addDocReceivingSettings,
  DocItemOption,
  DocReceivingSettings,
  getDocItemOptions,
  getDocReceivingSettings,
  getDocCycleExcludedBuildingIds,
  saveDocCycleExcludedBuildingIds,
  updateDocReceivingSettings,
} from './api'

type FormState = {
  goodDoc: string
  daoDoc: string
  rejectDoc: string
}

const emptyForm: FormState = {
  goodDoc: '',
  daoDoc: '',
  rejectDoc: '',
}

const toForm = (settings: DocReceivingSettings | null): FormState => ({
  goodDoc: settings?.good_doc == null ? '' : String(settings.good_doc),
  daoDoc: settings?.bad_doc == null ? '' : String(settings.bad_doc),
  rejectDoc: settings?.reject_doc == null ? '' : String(settings.reject_doc),
})

const toPayload = (form: FormState, farmId: number): DocReceivingSettings => ({
  farm_id: farmId,
  good_doc: form.goodDoc ? Number(form.goodDoc) : null,
  bad_doc: form.daoDoc ? Number(form.daoDoc) : null,
  reject_doc: form.rejectDoc ? Number(form.rejectDoc) : null,
})

const optionLabel = (item: DocItemOption) =>
  `${item.item_code}${item.item_name ? ` - ${item.item_name}` : ''}`

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message || fallback)
  }
  return fallback
}

type DocReceivingSettingsLayoutProps = {
  fixedFarmId?: number
  embedded?: boolean
  permissionBasePath?: string
  usePreviousFarmDefaults?: boolean
  saveLabel?: string
  onSaved?: () => void
}

export default function DocReceivingSettingsLayout({
  fixedFarmId,
  embedded = false,
  permissionBasePath = '/a_dean/doc-receiving-settings',
  usePreviousFarmDefaults = false,
  saveLabel,
  onSaved,
}: DocReceivingSettingsLayoutProps = {}) {
  const canAdd = usePermission(`${permissionBasePath}/insert`)
  const canEdit = usePermission(`${permissionBasePath}/edit`)
  const { getValue } = useGlobalContext()
  const session = getValue('UserInfoAuthSession')
  const rawFarmDB = getValue('getFarmDB')
  const rawUserFarms = session?.[0]?.users_farms
  const [settings, setSettings] = useState<DocReceivingSettings | null>(null)
  const [items, setItems] = useState<DocItemOption[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [savedForm, setSavedForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedFarmId, setSelectedFarmId] = useState('')
  const [buildings, setBuildings] = useState<FarmBuildingListRow[]>([])
  const [excludedBuildingIds, setExcludedBuildingIds] = useState<number[]>([])
  const [savedExcludedBuildingIds, setSavedExcludedBuildingIds] = useState<number[]>([])

  const allowedFarms = useMemo(
    () => getAllowedUserFarms((rawFarmDB || []) as UserFarm[], (rawUserFarms || []) as unknown[]),
    [rawFarmDB, rawUserFarms],
  )
  const singleAllowedFarm = allowedFarms.length === 1 ? allowedFarms[0] : null
  const activeFarmId = fixedFarmId ? String(fixedFarmId) : selectedFarmId || (singleAllowedFarm ? String(singleAllowedFarm.id) : '')

  const canSave = useMemo(
    () => !saving && Boolean(activeFarmId) && (settings?.id ? !canEdit : !canAdd),
    [activeFarmId, canAdd, canEdit, saving, settings?.id],
  )
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedForm) ||
    JSON.stringify([...excludedBuildingIds].sort((a, b) => a - b)) !== JSON.stringify([...savedExcludedBuildingIds].sort((a, b) => a - b)),
  [excludedBuildingIds, form, savedExcludedBuildingIds, savedForm])
  const itemOptions = useMemo(
    () => items.map(item => ({ code: String(item.id), name: optionLabel(item) })),
    [items],
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [nextSettings, nextItems] = await Promise.all([
        getDocReceivingSettings(Number(activeFarmId), { usePreviousFarmDefaults }),
        getDocItemOptions(),
      ])
      setSettings(nextSettings)
      const nextForm = toForm(nextSettings)
      setForm(nextForm)
      setSavedForm(nextForm)
      setItems(nextItems)
    } catch (error) {
      toast('Error: ' + errorMessage(error, 'Unable to load DOC receiving settings'))
      setSettings(null)
      setForm(emptyForm)
      setSavedForm(emptyForm)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [activeFarmId, usePreviousFarmDefaults])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const farmId = Number(activeFarmId)
    if (!farmId) {
      setBuildings([])
      setExcludedBuildingIds([])
      setSavedExcludedBuildingIds([])
      return
    }
    Promise.all([getFarmBuildingsForFlockCard(farmId), getDocCycleExcludedBuildingIds(farmId)])
      .then(([rows, excludedIds]) => {
        setBuildings(rows.filter(row => row.source === 'WAREHOUSE' && row.status === 'Active'))
        setExcludedBuildingIds(excludedIds)
        setSavedExcludedBuildingIds(excludedIds)
      })
      .catch(error => toast('Error: ' + errorMessage(error, 'Unable to load cycle exclusion settings')))
  }, [activeFarmId])

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [isDirty])

  const handleRefresh = () => {
    if (isDirty && !window.confirm('Discard unsaved settings?')) return
    void fetchData()
  }

  const updateForm = (key: keyof FormState, value: string) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!activeFarmId) {
      toast('Please select a farm.')
      return
    }

    if (!form.goodDoc || !form.daoDoc || !form.rejectDoc) {
      toast('Please select Good DOC, DAO DOC, and Reject DOC items.')
      return
    }

    const selectedDocIds = [form.goodDoc, form.daoDoc, form.rejectDoc]
    if (new Set(selectedDocIds).size !== selectedDocIds.length) {
      toast('Good DOC, DAO DOC, and Reject DOC must be different items.')
      return
    }

    if (!canSave) {
      toast(settings?.id ? 'You do not have permission to edit this setting.' : 'You do not have permission to add this setting.')
      return
    }

    setSaving(true)
    try {
      const payload = toPayload(form, Number(activeFarmId))
      const saved = settings?.id
        ? await updateDocReceivingSettings(settings.id, payload)
        : await addDocReceivingSettings(payload)

      const savedExclusions = await saveDocCycleExcludedBuildingIds(Number(activeFarmId), excludedBuildingIds)

      setSettings(saved)
      const nextForm = toForm(saved)
      setForm(nextForm)
      setSavedForm(nextForm)
      setExcludedBuildingIds(savedExclusions)
      setSavedExcludedBuildingIds(savedExclusions)
      toast('DOC Placement settings saved')
      onSaved?.()
    } catch (error) {
      toast('Error: ' + errorMessage(error, 'Unable to save DOC receiving settings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className={embedded ? 'space-y-3' : 'mx-auto max-w-6xl space-y-3 p-3 sm:p-4'}>
      {!embedded ? <div>
        <Breadcrumb
          FirstPreviewsPageName="Settings"
          CurrentPageName="DOC Placement Settings"
        />
      </div> : null}

      <ModuleSettingsHeader
        title="DOC Placement Settings"
        description="Configure DOC Placement defaults and operational behavior."
        formId="doc-placement-settings-form"
        loading={loading}
        saving={saving}
        disableSave={!canSave}
        saveLabel={saveLabel}
        onRefresh={handleRefresh}
      />

      <form id="doc-placement-settings-form" onSubmit={handleSubmit}>
        {!fixedFarmId ? <SettingsCategory title="Scope" description="Select the farm whose DOC Placement settings you want to maintain.">
          <SettingRow label="Farm" description="Excluded Cycle Buildings are stored independently per farm." settingKey="FARM_ID" required>
            <UserFarmSearchCombobox label="Farm" required farmType="BR" value={activeFarmId} onValueChange={farmId => setSelectedFarmId(farmId)} />
          </SettingRow>
        </SettingsCategory> : null}
        <SettingsCategory title="DOC Classification" description="Map each placement outcome to the inventory item used by DOC Placement.">
          {([
            ['goodDoc', 'Good DOC', 'Item used for accepted and healthy chicks.', 'GOOD_DOC_ITEM'],
            ['daoDoc', 'DAO DOC', 'Item used for chicks recorded as dead on arrival.', 'DAO_DOC_ITEM'],
            ['rejectDoc', 'Reject DOC', 'Item used for chicks rejected during placement.', 'REJECT_DOC_ITEM'],
          ] as const).map(([field, label, description, settingKey]) => (
            <SettingRow key={field} label={label} description={description} settingKey={settingKey} required>
              <SearchableDropdown
                list={itemOptions}
                codeLabel="code"
                nameLabel="name"
                value={form[field]}
                placeholder={loading ? 'Loading DOC items...' : items.length ? `Select ${label} item` : 'No active options are available.'}
                disabled={loading || saving}
                showNameOnly
                onChange={value => updateForm(field, String(value ?? ''))}
              />
            </SettingRow>
          ))}
        </SettingsCategory>
        <SettingsCategory title="Cycle Assignment" description="Normal buildings copy the active farm Cycle Count. Excluded buildings manage independent cycles.">
          <SettingRow label="Excluded Cycle Buildings" description="Select active, empty buildings that must not rely on the farm cycle. A building with an active flock cannot be added or removed until posted Clean up is complete." settingKey="EXCLUDED_CYCLE_BUILDINGS">
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-stone-200 p-3">
              {!activeFarmId ? <p className="text-sm text-stone-500">Select a farm first.</p> : buildings.length === 0 ? <p className="text-sm text-stone-500">No active buildings are available.</p> : buildings.map(building => {
                const id = Number(building.id)
                const checked = excludedBuildingIds.includes(id)
                return <label key={building.key} className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-stone-50">
                  <Checkbox checked={checked} disabled={loading || saving || canEdit} onCheckedChange={value => setExcludedBuildingIds(current => value === true ? [...new Set([...current, id])] : current.filter(entry => entry !== id))} />
                  <span className="text-sm">{building.code} - {building.name}</span>
                </label>
              })}
            </div>
          </SettingRow>
        </SettingsCategory>
      </form>
    </main>
  )
}
