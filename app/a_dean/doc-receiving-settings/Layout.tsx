'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCcw, Save } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import Breadcrumb from '@/lib/Breadcrumb'
import { usePermission } from '@/hooks/usePermission'
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const canSave = useMemo(
    () => !saving && (settings?.id ? !canEdit : !canAdd),
    [canAdd, canEdit, saving, settings?.id],
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [nextSettings, nextItems] = await Promise.all([
        getDocReceivingSettings(),
        getDocItemOptions(),
      ])
      setSettings(nextSettings)
      setForm(toForm(nextSettings))
      setItems(nextItems)
    } catch (error) {
      toast('Error: ' + errorMessage(error, 'Unable to load DOC receiving settings'))
      setSettings(null)
      setForm(emptyForm)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
      setForm(toForm(saved))
      toast('DOC receiving settings saved successfully')
    } catch (error) {
      toast('Error: ' + errorMessage(error, 'Unable to save DOC receiving settings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Breadcrumb
          FirstPreviewsPageName="Settings"
          CurrentPageName="DOC Placement Settings"
        />
        <Button type="button" variant="secondary" onClick={fetchData} disabled={loading || saving}>
          <RefreshCcw className={loading ? 'size-4 animate-spin' : 'size-4'} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>DOC Placement Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label required>Good DOC</Label>
                <select
                  value={form.goodDoc}
                  onChange={event => updateForm('goodDoc', event.target.value)}
                  disabled={loading || saving}
                  className="h-9 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-stone-200 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:opacity-80"
                  required
                >
                  <option value="">{loading ? 'Loading DOC items...' : 'Select Good DOC item'}</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {optionLabel(item)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label required>DAO DOC</Label>
                <select
                  value={form.daoDoc}
                  onChange={event => updateForm('daoDoc', event.target.value)}
                  disabled={loading || saving}
                  className="h-9 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-stone-200 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:opacity-80"
                  required
                >
                  <option value="">{loading ? 'Loading DOC items...' : 'Select DAO DOC item'}</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {optionLabel(item)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label required>Reject DOC</Label>
                <select
                  value={form.rejectDoc}
                  onChange={event => updateForm('rejectDoc', event.target.value)}
                  disabled={loading || saving}
                  className="h-9 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-stone-200 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:opacity-80"
                  required
                >
                  <option value="">{loading ? 'Loading DOC items...' : 'Select Reject DOC item'}</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {optionLabel(item)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={!canSave}>
                <Save className="mr-2 size-4" />
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
