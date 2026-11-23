"use client"

import { FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"

import { ModuleSettingsHeader, SettingRow, SettingsCategory } from "@/components/settings/ModuleSettingsLayout"
import { Input } from "@/components/ui/input"
import Breadcrumb from "@/lib/Breadcrumb"
import {
  DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
  MAX_INACTIVITY_TIMEOUT_MINUTES,
  MIN_INACTIVITY_TIMEOUT_MINUTES,
  readInactivityTimeoutMinutes,
  saveInactivityTimeoutMinutes,
} from "@/lib/auth/inactivityTimeout"

const FORM_ID = "system-settings-form"

export default function SystemSettingsLayout() {
  const [minutes, setMinutes] = useState(String(DEFAULT_INACTIVITY_TIMEOUT_MINUTES))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadSettings = () => {
    setLoading(true)
    setMinutes(String(readInactivityTimeoutMinutes()))
    setLoading(false)
  }

  useEffect(() => {
    const timeout = window.setTimeout(loadSettings, 0)
    return () => window.clearTimeout(timeout)
  }, [])

  const parsedMinutes = Number(minutes)
  const isValid = Number.isInteger(parsedMinutes)
    && parsedMinutes >= MIN_INACTIVITY_TIMEOUT_MINUTES
    && parsedMinutes <= MAX_INACTIVITY_TIMEOUT_MINUTES

  const submit = (event: FormEvent) => {
    event.preventDefault()

    if (!isValid) {
      toast.error(`Enter a whole number from ${MIN_INACTIVITY_TIMEOUT_MINUTES} to ${MAX_INACTIVITY_TIMEOUT_MINUTES} minutes.`)
      return
    }

    setSaving(true)
    const savedMinutes = saveInactivityTimeoutMinutes(parsedMinutes)
    setMinutes(String(savedMinutes))
    setSaving(false)
    toast.success("System settings saved in this browser.")
  }

  return (
    <main className="mx-auto max-w-5xl space-y-3 p-3 sm:p-4">
      <Breadcrumb FirstPreviewsPageName="Settings" FirstPreviewsPageLink="/admin" CurrentPageName="System Settings" />
      <ModuleSettingsHeader
        title="System Settings"
        description="Configure browser-local application behavior without database storage."
        formId={FORM_ID}
        loading={loading}
        saving={saving}
        disableSave={!isValid}
        onRefresh={loadSettings}
      />

      <form id={FORM_ID} onSubmit={submit} className="space-y-3">
        <SettingsCategory
          title="Session Security"
          description="Control automatic logout for this browser profile. The setting is shared by every open Vita FMS tab."
        >
          <SettingRow
            label="Inactivity timeout"
            description="Sign out after this many minutes without mouse, keyboard, or touch activity. A warning appears during the final 60 seconds. A 1-minute timeout warns during its final 30 seconds."
            settingKey="INACTIVITY_TIMEOUT_MINUTES"
            required
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Input
                  id="inactivity-timeout-minutes"
                  type="number"
                  min={MIN_INACTIVITY_TIMEOUT_MINUTES}
                  max={MAX_INACTIVITY_TIMEOUT_MINUTES}
                  step={1}
                  inputMode="numeric"
                  value={minutes}
                  disabled={loading || saving}
                  aria-invalid={!isValid}
                  onChange={event => setMinutes(event.target.value)}
                  className="max-w-40"
                />
                <label htmlFor="inactivity-timeout-minutes" className="text-sm text-muted-foreground">
                  minutes
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Allowed range: {MIN_INACTIVITY_TIMEOUT_MINUTES} to {MAX_INACTIVITY_TIMEOUT_MINUTES} minutes. Default: {DEFAULT_INACTIVITY_TIMEOUT_MINUTES} minutes.
              </p>
            </div>
          </SettingRow>
        </SettingsCategory>
      </form>
    </main>
  )
}
