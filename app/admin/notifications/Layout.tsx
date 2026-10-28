"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { BellRing, Braces, Pencil, Plus, RefreshCcw, ShieldCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { usePermission } from "@/hooks/usePermission"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  getNotificationRuleSetup,
  saveNotificationRuleRequest,
  voidNotificationRuleRequest,
} from "@/lib/data/repositories/notificationApiClient"
import {
  NOTIFICATION_PRIORITIES,
  USER_TYPES,
  type FmsType,
  type NotificationCatalog,
  type NotificationPriority,
  type NotificationRule,
  type NotificationRuleAccess,
  type NotificationRuleInput,
  type NotificationUserGroup,
} from "@/lib/notifications/types"
import { NOTIFICATION_TEMPLATE_PLACEHOLDERS } from "@/lib/notifications/templatePlaceholders"

type TemplateForm = {
  id?: number
  name: string
  module_key: string
  event_key: string
  source_fms_types: FmsType[]
  recipient_fms_types: FmsType[]
  user_types: number[]
  user_group_ids: number[]
  title_template: string
  message_template: string
  priority: NotificationPriority
  exclude_actor: boolean
  is_active: boolean
}

function firstAvailableModule(catalog: NotificationCatalog, actor?: NotificationRuleAccess | null) {
  return catalog.find(module =>
    actor?.userType !== USER_TYPES.ADMIN
      || Boolean(actor.fmsType && module.fmsTypes.includes(actor.fmsType)),
  ) ?? catalog[0]
}

function emptyForm(catalog: NotificationCatalog, actor?: NotificationRuleAccess | null): TemplateForm {
  const moduleDefinition = firstAvailableModule(catalog, actor)
  return {
    name: "",
    module_key: moduleDefinition?.key ?? "",
    event_key: moduleDefinition?.events[0]?.key ?? "",
    source_fms_types: actor?.userType === USER_TYPES.ADMIN && actor.fmsType
      ? [actor.fmsType]
      : moduleDefinition?.fmsTypes ?? [],
    recipient_fms_types: moduleDefinition?.defaultRecipientFmsTypes ?? [],
    user_types: actor?.userType === USER_TYPES.ADMIN ? [USER_TYPES.USER] : [],
    user_group_ids: [],
    title_template: "",
    message_template: "",
    priority: "normal",
    exclude_actor: true,
    is_active: true,
  }
}

function toggleNumber(values: number[], value: number, checked: boolean) {
  return checked
    ? Array.from(new Set([...values, value]))
    : values.filter(item => item !== value)
}

function farmRoutingLabel(value: string | undefined) {
  if (value === "document") return "Document farm"
  if (value === "origin") return "Origin farm"
  if (value === "destination") return "Destination farm"
  if (value === "origin_and_destination") return "Origin and destination farms"
  return "No farm restriction"
}

function SetupSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-4 sm:px-5" aria-label="Loading notification templates">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  )
}

export default function Layout({ catalog }: { catalog: NotificationCatalog }) {
  const cannotEdit = usePermission("/admin/notifications/edit")
  const formRef = useRef<HTMLDivElement>(null)
  const [actor, setActor] = useState<NotificationRuleAccess | null>(null)
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [groups, setGroups] = useState<NotificationUserGroup[]>([])
  const [form, setForm] = useState<TemplateForm>(() => emptyForm(catalog))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const availableModules = useMemo(
    () => actor?.userType === USER_TYPES.ADMIN
      ? catalog.filter(module => Boolean(actor.fmsType && module.fmsTypes.includes(actor.fmsType)))
      : catalog,
    [actor, catalog],
  )
  const selectedModule = useMemo(
    () => availableModules.find(module => module.key === form.module_key) ?? availableModules[0],
    [availableModules, form.module_key],
  )
  const selectedEvent = useMemo(
    () => selectedModule?.events.find(event => event.key === form.event_key) ?? selectedModule?.events[0],
    [form.event_key, selectedModule],
  )

  async function loadSetup() {
    setLoading(true)
    try {
      const result = await getNotificationRuleSetup()
      setActor(result.actor)
      setRules(result.rules)
      setGroups(result.userGroups)
      setForm(current => current.id ? current : emptyForm(catalog, result.actor))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load notification templates.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSetup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetForm() {
    setForm(emptyForm(catalog, actor))
  }

  function editTemplate(rule: NotificationRule) {
    setForm({
      id: rule.id,
      name: rule.name,
      module_key: rule.module_key,
      event_key: rule.event_key,
      source_fms_types: rule.source_fms_types,
      recipient_fms_types: rule.recipient_fms_types,
      user_types: rule.user_types,
      user_group_ids: rule.user_group_ids,
      title_template: rule.title_template ?? "",
      message_template: rule.message_template ?? "",
      priority: rule.priority,
      exclude_actor: rule.exclude_actor,
      is_active: rule.is_active,
    })
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  async function saveTemplate(event: FormEvent) {
    event.preventDefault()
    if (!form.name.trim() || !form.module_key || !form.event_key) {
      toast.error("Template name, module, and event are required.")
      return
    }

    setSaving(true)
    try {
      const payload: NotificationRuleInput = {
        ...form,
        name: form.name.trim(),
        title_template: form.title_template.trim() || null,
        message_template: form.message_template.trim() || null,
        email_enabled: false,
        require_view_permission: true,
      }
      const result = await saveNotificationRuleRequest(payload)
      setRules(current => [result.rule, ...current.filter(rule => rule.id !== result.rule.id)])
      toast.success(form.id ? "Notification template updated." : "Notification template created.")
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save notification template.")
    } finally {
      setSaving(false)
    }
  }

  async function removeTemplate(rule: NotificationRule) {
    if (!window.confirm(`Deactivate notification template "${rule.name}"?`)) return
    try {
      await voidNotificationRuleRequest(rule.id)
      setRules(current => current.filter(item => item.id !== rule.id))
      if (form.id === rule.id) resetForm()
      toast.success("Notification template deactivated.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to deactivate notification template.")
    }
  }

  if (loading) return <SetupSkeleton />

  return (
    <div className="min-h-[calc(100vh-120px)] bg-background px-3 py-4 sm:px-5">
      <div className="mx-auto max-w-5xl space-y-4">
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl"><BellRing className="size-5" />Notification Templates</CardTitle>
              <CardDescription className="mt-1">Create an in-app template for a registered module event. Notifications are delivered only when that event succeeds.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void loadSetup()}><RefreshCcw className="size-4" />Refresh</Button>
              <Button type="button" variant="outline" size="sm" disabled={cannotEdit} onClick={() => { resetForm(); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) }}><Plus className="size-4" />New template</Button>
            </div>
          </CardHeader>
        </Card>

        <Card ref={formRef}>
          <CardHeader>
            <CardTitle>{form.id ? "Edit Template" : "New Template"}</CardTitle>
            <CardDescription>Farm routing and module View permission are enforced automatically. Leave User Group empty to notify all permitted users in scope.</CardDescription>
            {actor?.userType === USER_TYPES.ADMIN ? (
              <div className="flex gap-2 rounded-md border border-primary/25 bg-primary/5 p-3 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>Your templates are limited to {actor.fmsType ?? "your"} modules and regular users.</span>
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            <form onSubmit={saveTemplate} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5 md:col-span-2 lg:col-span-4">
                  <Label htmlFor="notification-template-name" required>Template name</Label>
                  <Input id="notification-template-name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="DOC Placement posted" />
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <Label required>Module</Label>
                  <Select
                    value={form.module_key}
                    onValueChange={moduleKey => {
                      const moduleDefinition = availableModules.find(item => item.key === moduleKey)
                      setForm(current => ({
                        ...current,
                        module_key: moduleKey,
                        event_key: moduleDefinition?.events[0]?.key ?? "",
                        source_fms_types: actor?.userType === USER_TYPES.ADMIN && actor.fmsType
                          ? [actor.fmsType]
                          : moduleDefinition?.fmsTypes ?? [],
                        recipient_fms_types: moduleDefinition?.defaultRecipientFmsTypes ?? [],
                      }))
                    }}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{availableModules.map(module => <SelectItem key={module.key} value={module.key}>{module.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label required>Event</Label>
                  <Select value={form.event_key} onValueChange={eventKey => setForm(current => ({ ...current, event_key: eventKey }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{selectedModule?.events.map(event => <SelectItem key={event.key} value={event.key}>{event.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={priority => setForm(current => ({ ...current, priority: priority as NotificationPriority }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{NOTIFICATION_PRIORITIES.map(priority => <SelectItem key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span className="font-medium">Recipient routing:</span> {farmRoutingLabel(selectedEvent?.farmRouting)} with required <span className="font-medium">{selectedModule?.permissionTitle}</span> permission.
              </div>

              <div className="rounded-md border bg-muted/20 p-3">
                <h3 className="text-sm font-semibold">User groups</h3>
                <p className="mb-3 text-xs text-muted-foreground">Optional. Empty means every permitted user within the event’s farm scope.</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.length ? groups.map(group => (
                    <CheckOption
                      key={group.id}
                      label={group.group_name}
                      checked={form.user_group_ids.includes(group.id)}
                      onCheckedChange={checked => setForm(current => ({ ...current, user_group_ids: toggleNumber(current.user_group_ids, group.id, checked) }))}
                    />
                  )) : <p className="text-sm text-muted-foreground">No active user groups.</p>}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <TemplateField id="notification-title-template" label="Title template" value={form.title_template} onChange={title_template => setForm(current => ({ ...current, title_template }))} placeholder="Default event title" />
                <TemplateField id="notification-message-template" label="Message template" value={form.message_template} onChange={message_template => setForm(current => ({ ...current, message_template }))} placeholder="Default event message" multiline />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SwitchOption label="Exclude the user who performed the action" checked={form.exclude_actor} onCheckedChange={exclude_actor => setForm(current => ({ ...current, exclude_actor }))} />
                <SwitchOption label="Template active" checked={form.is_active} onCheckedChange={is_active => setForm(current => ({ ...current, is_active }))} />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                {form.id ? <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button> : null}
                <Button type="submit" disabled={saving || cannotEdit}>{saving ? "Saving..." : form.id ? "Update template" : "Create template"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configured Templates ({rules.length})</CardTitle>
            <CardDescription>Only active templates create inbox notifications. In-app delivery does not use a scheduled worker.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {rules.length ? rules.map(rule => {
              const moduleDefinition = catalog.find(module => module.key === rule.module_key)
              const eventDefinition = moduleDefinition?.events.find(event => event.key === rule.event_key)
              const groupNames = rule.user_group_ids
                .map(id => groups.find(group => group.id === id)?.group_name)
                .filter(Boolean)
              return (
                <div key={rule.id} className="flex flex-col gap-3 rounded-md border bg-card p-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{rule.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${rule.is_active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{rule.is_active ? "Active" : "Inactive"}</span>
                      <span className="rounded-full border px-2 py-0.5 text-xs capitalize">{rule.priority}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{moduleDefinition?.label ?? rule.module_key} · {eventDefinition?.label ?? rule.event_key}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{groupNames.length ? `Groups: ${groupNames.join(", ")}` : "All permitted users in scope"} · {farmRoutingLabel(eventDefinition?.farmRouting)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={cannotEdit} onClick={() => editTemplate(rule)}><Pencil className="size-4" />Edit</Button>
                    <Button type="button" variant="ghost" size="icon-sm" disabled={cannotEdit} onClick={() => void removeTemplate(rule)} title="Deactivate template"><Trash2 className="size-4" /></Button>
                  </div>
                </div>
              )
            }) : <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No notification templates configured.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TemplateField({ id, label, value, onChange, placeholder, multiline = false }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string; multiline?: boolean }) {
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  function insertToken(token: string) {
    const field = fieldRef.current
    const start = field?.selectionStart ?? value.length
    const end = field?.selectionEnd ?? start
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`
    onChange(next)
    window.requestAnimationFrame(() => {
      fieldRef.current?.focus()
      fieldRef.current?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Popover>
          <PopoverTrigger asChild><Button type="button" variant="ghost" size="sm"><Braces className="size-4" />Placeholders</Button></PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-2">
            {NOTIFICATION_TEMPLATE_PLACEHOLDERS.map(item => (
              <button key={item.token} type="button" className="w-full rounded-md px-2 py-2 text-left hover:bg-muted" onClick={() => insertToken(item.token)}>
                <span className="block font-mono text-xs font-semibold">{item.token}</span>
                <span className="block text-xs text-muted-foreground">{item.description}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      {multiline
        ? <Textarea ref={fieldRef as React.Ref<HTMLTextAreaElement>} id={id} rows={4} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
        : <Input ref={fieldRef as React.Ref<HTMLInputElement>} id={id} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />}
    </div>
  )
}

function CheckOption({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md border bg-background px-2 text-sm"><Checkbox checked={checked} onCheckedChange={value => onCheckedChange(Boolean(value))} /><span>{label}</span></label>
}

function SwitchOption({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <div className="flex min-h-10 items-center justify-between gap-2 rounded-md border px-3 py-2"><Label className="text-xs">{label}</Label><Switch checked={checked} onCheckedChange={onCheckedChange} /></div>
}
