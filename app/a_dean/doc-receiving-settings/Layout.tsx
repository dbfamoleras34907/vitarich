'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import Breadcrumb from '@/lib/Breadcrumb'
import SearchableDropdown from '@/lib/SearchableDropdown'
import { usePermission } from '@/hooks/usePermission'
import { ModuleSettingsHeader, SettingRow, SettingsCategory } from '@/components/settings/ModuleSettingsLayout'
import {
  addDocReceivingSettings,
  DocItemOption,
  DocReceivingSettings,
  getDocItemOptions,
  getDocReceivingSettings,
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

const toPayload = (form: FormState): DocReceivingSettings => ({
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

export default function DocReceivingSettingsLayout() {
  const canAdd = usePermission('/a_dean/doc-receiving-settings/insert')
  const canEdit = usePermission('/a_dean/doc-receiving-settings/edit')
  const [settings, setSettings] = useState<DocReceivingSettings | null>(null)
  const [items, setItems] = useState<DocItemOption[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [savedForm, setSavedForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const canSave = useMemo(
    () => !saving && (settings?.id ? !canEdit : !canAdd),
    [canAdd, canEdit, saving, settings?.id],
  )
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedForm), [form, savedForm])
  const itemOptions = useMemo(
    () => items.map(item => ({ code: String(item.id), name: optionLabel(item) })),
    [items],
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [nextSettings, nextItems] = await Promise.all([
        getDocReceivingSettings(),
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
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
      const payload = toPayload(form)
      const saved = settings?.id
        ? await updateDocReceivingSettings(settings.id, payload)
        : await addDocReceivingSettings(payload)

      setSettings(saved)
      const nextForm = toForm(saved)
      setForm(nextForm)
      setSavedForm(nextForm)
      toast('DOC Placement settings saved')
    } catch (error) {
      toast('Error: ' + errorMessage(error, 'Unable to save DOC receiving settings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-3 p-3 sm:p-4">
      <div>
        <Breadcrumb
          FirstPreviewsPageName="Settings"
          CurrentPageName="DOC Placement Settings"
        />
      </div>

      <ModuleSettingsHeader
        title="DOC Placement Settings"
        description="Configure DOC Placement defaults and operational behavior."
        formId="doc-placement-settings-form"
        loading={loading}
        saving={saving}
        disableSave={!canSave}
        onRefresh={handleRefresh}
      />

      <form id="doc-placement-settings-form" onSubmit={handleSubmit}>
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
      </form>
    </main>
  )
}
