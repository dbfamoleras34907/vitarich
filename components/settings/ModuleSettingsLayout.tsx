import type { ReactNode } from 'react'
import { Loader2, RefreshCcw, Save, Settings2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type ModuleSettingsHeaderProps = {
  title: string
  description: string
  formId: string
  loading: boolean
  saving: boolean
  disableRefresh?: boolean
  disableSave?: boolean
  onRefresh: () => void
}

export function ModuleSettingsHeader({
  title,
  description,
  formId,
  loading,
  saving,
  disableRefresh = false,
  disableSave = false,
  onRefresh,
}: ModuleSettingsHeaderProps) {
  return (
    <header className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Settings2 className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onRefresh} disabled={loading || saving || disableRefresh}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          Refresh
        </Button>
        <Button type="submit" form={formId} disabled={loading || saving || disableSave}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </header>
  )
}

export function SettingsCategory({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="gap-1 border-b bg-muted/30 px-4 py-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="divide-y p-0">{children}</CardContent>
    </Card>
  )
}

export function SettingRow({
  label,
  description,
  settingKey,
  required = false,
  children,
}: {
  label: string
  description: string
  settingKey: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] md:items-center">
      <div className="min-w-0">
        <div className="text-sm font-medium">
          {label}{required ? <span aria-label="required"> *</span> : null}
        </div>
        <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{description}</p>
        <code className="mt-1 block text-[11px] text-muted-foreground">{settingKey}</code>
      </div>
      <div className="w-full min-w-0">{children}</div>
    </div>
  )
}
