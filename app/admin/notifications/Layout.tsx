"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Activity, BellRing, Braces, Info, ListChecks, Pencil, Plus, RefreshCcw, RotateCcw, ShieldCheck, Trash2, Users } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  getNotificationRuleAffectedUsersRequest,
  getNotificationRuleSetup,
  processPendingNotificationsRequest,
  saveNotificationRuleRequest,
  voidNotificationRuleRequest,
} from "@/lib/data/repositories/notificationApiClient"
import {
  FMS_TYPES,
  NOTIFICATION_PRIORITIES,
  USER_TYPES,
  type FmsType,
  type NotificationCatalog,
  type NotificationPriority,
  type NotificationOutboxHealth,
  type NotificationRule,
  type NotificationRuleAffectedUsers,
  type NotificationRuleAccess,
  type NotificationRuleInput,
  type NotificationUserGroup,
} from "@/lib/notifications/types"
import { NOTIFICATION_TEMPLATE_PLACEHOLDERS } from "@/lib/notifications/templatePlaceholders"

type RuleForm = {
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
  email_enabled: boolean
  exclude_actor: boolean
  require_view_permission: boolean
  is_active: boolean
}

type AffectedUsersState = {
  status: "loading" | "loaded" | "error"
  data?: NotificationRuleAffectedUsers
  error?: string
}

const USER_TYPE_LABELS = new Map<number, string>([
  [USER_TYPES.SUPER_ADMIN, "Super Admin"],
  [USER_TYPES.ADMIN, "Admin/Supervisor"],
  [USER_TYPES.USER, "User"],
])

function emptyForm(catalog: NotificationCatalog, actor?: NotificationRuleAccess | null): RuleForm {
  const moduleDefinition = catalog.find(module =>
    actor?.userType !== 2 || Boolean(actor.fmsType && module.fmsTypes.includes(actor.fmsType)),
  ) ?? catalog[0]
  return {
    name: "",
    module_key: moduleDefinition?.key ?? "",
    event_key: moduleDefinition?.events[0]?.key ?? "",
    source_fms_types: actor?.userType === 2 && actor.fmsType ? [actor.fmsType] : moduleDefinition?.fmsTypes ?? [],
    recipient_fms_types: moduleDefinition?.defaultRecipientFmsTypes ?? [],
    user_types: actor?.userType === 2 ? [USER_TYPES.USER] : [],
    user_group_ids: [],
    title_template: "",
    message_template: "",
    priority: "normal",
    email_enabled: false,
    exclude_actor: true,
    require_view_permission: true,
    is_active: true,
  }
}

function SetupSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading notification setup">
      <div className="max-w-full overflow-x-auto">
        <div className="inline-flex h-9 items-center gap-1 rounded-lg bg-muted p-[3px]">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-7 w-40" />
        </div>
      </div>
      <Card>
        <CardHeader><Skeleton className="h-6 w-52" /><Skeleton className="h-4 w-96 max-w-full" /></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    </div>
  )
}

function toggleNumber(values: number[], value: number, checked: boolean) {
  return checked ? Array.from(new Set([...values, value])) : values.filter(item => item !== value)
}

function toggleFms(values: FmsType[], value: FmsType, checked: boolean) {
  return checked ? Array.from(new Set([...values, value])) : values.filter(item => item !== value)
}

function formatLocalDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date)
}

export default function Layout({ catalog }: { catalog: NotificationCatalog }) {
  const cannotEdit = usePermission("/admin/notifications/edit")
  const [actor, setActor] = useState<NotificationRuleAccess | null>(null)
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [groups, setGroups] = useState<NotificationUserGroup[]>([])
  const [outboxHealth, setOutboxHealth] = useState<NotificationOutboxHealth>({ pendingCount: 0, failedCount: 0, emailPendingCount: 0, emailFailedCount: 0, recentFailures: [], recentEmailFailures: [] })
  const [form, setForm] = useState<RuleForm>(() => emptyForm(catalog))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [processingMode, setProcessingMode] = useState<"due" | "retry" | null>(null)
  const [affectedUsersByRule, setAffectedUsersByRule] = useState<Record<number, AffectedUsersState>>({})
  const [activeSection, setActiveSection] = useState("setup")

  const selectedModule = useMemo(
    () => catalog.find(module => module.key === form.module_key) ?? catalog[0],
    [catalog, form.module_key],
  )
  const selectedEvent = useMemo(
    () => selectedModule?.events.find(event => event.key === form.event_key) ?? selectedModule?.events[0],
    [form.event_key, selectedModule],
  )
  const availableModules = useMemo(
    () => actor?.userType === 2
      ? catalog.filter(module => Boolean(actor.fmsType && module.fmsTypes.includes(actor.fmsType)))
      : catalog,
    [actor, catalog],
  )

  async function loadSetup() {
    setLoading(true)
    try {
      const result = await getNotificationRuleSetup()
      setActor(result.actor)
      setRules(result.rules)
      setGroups(result.userGroups)
      setOutboxHealth(result.outboxHealth)
      setAffectedUsersByRule({})
      setForm(current => current.id ? current : emptyForm(catalog, result.actor))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load notification setup.")
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

  function editRule(rule: NotificationRule) {
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
      email_enabled: rule.email_enabled,
      exclude_actor: rule.exclude_actor,
      require_view_permission: rule.require_view_permission,
      is_active: rule.is_active,
    })
    setActiveSection("setup")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function saveRule(event: FormEvent) {
    event.preventDefault()
    if (!form.name.trim() || !form.module_key || !form.event_key) {
      toast.error("Rule name, module, and event are required.")
      return
    }

    setSaving(true)
    try {
      const payload: NotificationRuleInput = {
        ...form,
        name: form.name.trim(),
        title_template: form.title_template.trim() || null,
        message_template: form.message_template.trim() || null,
      }
      const result = await saveNotificationRuleRequest(payload)
      setRules(current => [result.rule, ...current.filter(rule => rule.id !== result.rule.id)])
      setAffectedUsersByRule(current => {
        const next = { ...current }
        delete next[result.rule.id]
        return next
      })
      toast.success(form.id ? "Notification rule updated." : "Notification rule created.")
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save notification rule.")
    } finally {
      setSaving(false)
    }
  }

  async function removeRule(rule: NotificationRule) {
    if (!window.confirm(`Void notification rule "${rule.name}"?`)) return
    try {
      await voidNotificationRuleRequest(rule.id)
      setRules(current => current.filter(item => item.id !== rule.id))
      setAffectedUsersByRule(current => {
        const next = { ...current }
        delete next[rule.id]
        return next
      })
      if (form.id === rule.id) resetForm()
      toast.success("Notification rule voided.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to void notification rule.")
    }
  }

  async function processNow(retryFailedEmails = false) {
    setProcessingMode(retryFailedEmails ? "retry" : "due")
    try {
      const result = await processPendingNotificationsRequest({ retryFailedEmails })
      const requeued = retryFailedEmails ? `${result.emails.requeued} failed email${result.emails.requeued === 1 ? "" : "s"} requeued; ` : ""
      const message = `${requeued}${result.processed} event${result.processed === 1 ? "" : "s"} processed; ${result.emails.sent} email${result.emails.sent === 1 ? "" : "s"} sent; ${result.emails.failed} failed; ${result.emails.skipped} skipped.`
      if (result.emails.failed > 0) toast.error(message)
      else toast.success(message)
      await loadSetup()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to process notification events.")
    } finally {
      setProcessingMode(null)
    }
  }

  async function loadAffectedUsers(ruleId: number, force = false) {
    const current = affectedUsersByRule[ruleId]
    if (!force && (current?.status === "loading" || current?.status === "loaded")) return

    setAffectedUsersByRule(states => ({ ...states, [ruleId]: { status: "loading", data: states[ruleId]?.data } }))
    try {
      const data = await getNotificationRuleAffectedUsersRequest(ruleId)
      setAffectedUsersByRule(states => ({ ...states, [ruleId]: { status: "loaded", data } }))
    } catch (error) {
      setAffectedUsersByRule(states => ({
        ...states,
        [ruleId]: {
          status: "error",
          data: states[ruleId]?.data,
          error: error instanceof Error ? error.message : "Unable to load affected users.",
        },
      }))
    }
  }

  if (loading) return <div className="mx-auto max-w-[1240px] px-3 py-4 sm:px-5"><SetupSkeleton /></div>

  return (
    <div className="min-h-[calc(100vh-120px)] bg-background px-3 py-4 sm:px-5">
      <div className="mx-auto max-w-[1240px] space-y-4">
        <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-4">
          <div className="max-w-full overflow-x-auto">
            <TabsList>
              <TabsTrigger value="setup"><BellRing />Notification Setup</TabsTrigger>
              <TabsTrigger value="health"><Activity />Process Health</TabsTrigger>
              <TabsTrigger value="rules"><ListChecks />Configured Rules ({rules.length})</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="setup" className="mt-0">
            <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl"><BellRing className="size-5" />Notification Setup</CardTitle>
                <CardDescription className="mt-1">Activate module events for matching source FMS, recipient FMS, User Types, and User Groups.</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadSetup()}>
                <RefreshCcw className="size-4" />Refresh
              </Button>
            </div>
            {actor?.userType === 1 && (
              <div className="mt-3 flex gap-2 rounded-md border border-primary/25 bg-primary/5 p-3 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>Super Admin can configure notification rules for all supported FMS types.</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={saveRule} className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-1.5 lg:col-span-3">
                  <Label htmlFor="notification-rule-name" required>Rule name</Label>
                  <Input id="notification-rule-name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Notify farm managers when DOC Placement is posted" />
                </div>
                <div className="space-y-1.5">
                  <Label required>Module</Label>
                  <Select
                    value={form.module_key}
                    onValueChange={moduleKey => {
                      const moduleDefinition = catalog.find(item => item.key === moduleKey)
                      setForm(current => ({
                        ...current,
                        module_key: moduleKey,
                        event_key: moduleDefinition?.events[0]?.key ?? "",
                        source_fms_types: actor?.userType === 2 && actor.fmsType ? [actor.fmsType] : moduleDefinition?.fmsTypes ?? [],
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

              {selectedEvent?.farmRouting !== "none" ? (
                <div className="rounded-md border bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
                  Farm routing: <span className="font-medium text-foreground">
                    {selectedEvent?.farmRouting === "document" ? "Document farm" : selectedEvent?.farmRouting === "destination" ? "Destination farm" : selectedEvent?.farmRouting === "origin" ? "Origin farm" : "Origin and destination farms"}
                  </span>. Admin and User recipients must be actively assigned to that farm; Super Admin keeps the farm-assignment bypass.
                </div>
              ) : null}

              <AudiencePanel title="Delivery Channels" hint="In-app delivery is always enabled. Email uses the recipient's user-profile email address.">
                <CheckOption label="In-app" checked disabled onCheckedChange={() => undefined} />
                <CheckOption label="Email" checked={form.email_enabled} onCheckedChange={email_enabled => setForm(current => ({ ...current, email_enabled }))} />
              </AudiencePanel>

              <div className="grid gap-4 lg:grid-cols-2">
                <AudiencePanel title="Source FMS Type" hint="The FMS operation that triggers this rule.">
                  {FMS_TYPES.filter(fmsType => selectedModule?.fmsTypes.includes(fmsType)).map(fmsType => (
                    <CheckOption key={fmsType} label={fmsType} checked={form.source_fms_types.includes(fmsType)} disabled={actor?.userType === 2} onCheckedChange={checked => setForm(current => ({ ...current, source_fms_types: toggleFms(current.source_fms_types, fmsType, checked) }))} />
                  ))}
                </AudiencePanel>
                <AudiencePanel title="Recipient FMS Type" hint="Empty means any FMS Type; select Broiler for DOC Receiving.">
                  {FMS_TYPES.map(fmsType => (
                    <CheckOption key={fmsType} label={fmsType} checked={form.recipient_fms_types.includes(fmsType)} onCheckedChange={checked => setForm(current => ({ ...current, recipient_fms_types: toggleFms(current.recipient_fms_types, fmsType, checked) }))} />
                  ))}
                </AudiencePanel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <AudiencePanel title="User Type" hint="Empty means any user type.">
                  {[1, 2, 3].map(userType => (
                    <CheckOption key={userType} label={USER_TYPE_LABELS.get(userType) ?? String(userType)} checked={form.user_types.includes(userType)} disabled={actor?.userType === 2} onCheckedChange={checked => setForm(current => ({ ...current, user_types: toggleNumber(current.user_types, userType, checked) }))} />
                  ))}
                </AudiencePanel>
                <AudiencePanel title="User Group" hint="Empty means any user group.">
                  {groups.length > 0 ? groups.map(group => (
                    <CheckOption key={group.id} label={group.group_name} checked={form.user_group_ids.includes(group.id)} onCheckedChange={checked => setForm(current => ({ ...current, user_group_ids: toggleNumber(current.user_group_ids, group.id, checked) }))} />
                  )) : <p className="text-sm text-muted-foreground">No active user groups.</p>}
                </AudiencePanel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <TemplateField
                  id="notification-title-template"
                  label="Title template"
                  value={form.title_template}
                  onChange={title_template => setForm(current => ({ ...current, title_template }))}
                  placeholder="Default event title"
                />
                <TemplateField
                  id="notification-message-template"
                  label="Message template"
                  value={form.message_template}
                  onChange={message_template => setForm(current => ({ ...current, message_template }))}
                  placeholder="Type { to insert a placeholder, or leave empty for the default message."
                  multiline
                  className="lg:row-span-2"
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <SwitchOption label="Active" checked={form.is_active} onCheckedChange={is_active => setForm(current => ({ ...current, is_active }))} />
                  <SwitchOption label="Exclude initiator" checked={form.exclude_actor} onCheckedChange={exclude_actor => setForm(current => ({ ...current, exclude_actor }))} />
                  <SwitchOption label="Require View" checked={form.require_view_permission} onCheckedChange={require_view_permission => setForm(current => ({ ...current, require_view_permission }))} />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                {form.id && <Button type="button" variant="outline" onClick={resetForm}>Cancel edit</Button>}
                <Button type="submit" disabled={cannotEdit || saving}>
                  {form.id ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                  {saving ? "Saving..." : form.id ? "Update Rule" : "Create Rule"}
                </Button>
              </div>
            </form>
          </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health" className="mt-0">
            <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><CardTitle>Process Health</CardTitle><CardDescription>Durable in-app events and email deliveries waiting for processing or retry.</CardDescription></div>
              <div className="flex flex-wrap gap-2">
                {outboxHealth.emailFailedCount > 0 && (
                  <Button type="button" variant="outline" size="sm" disabled={cannotEdit || processingMode != null} onClick={() => void processNow(true)}>
                    <RotateCcw className={`size-4 ${processingMode === "retry" ? "animate-spin" : ""}`} />Retry failed emails now
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" disabled={processingMode != null} onClick={() => void processNow()}>
                  <RefreshCcw className={`size-4 ${processingMode === "due" ? "animate-spin" : ""}`} />Process due
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border bg-muted/20 p-3"><p className="text-xs uppercase text-muted-foreground">Event pending</p><p className="mt-1 text-2xl font-semibold">{outboxHealth.pendingCount}</p></div>
              <div className="rounded-md border bg-muted/20 p-3"><p className="text-xs uppercase text-muted-foreground">Event failed</p><p className={`mt-1 text-2xl font-semibold ${outboxHealth.failedCount ? "text-destructive" : ""}`}>{outboxHealth.failedCount}</p></div>
              <div className="rounded-md border bg-muted/20 p-3"><p className="text-xs uppercase text-muted-foreground">Email pending</p><p className="mt-1 text-2xl font-semibold">{outboxHealth.emailPendingCount}</p></div>
              <div className="rounded-md border bg-muted/20 p-3"><p className="text-xs uppercase text-muted-foreground">Email failed</p><p className={`mt-1 text-2xl font-semibold ${outboxHealth.emailFailedCount ? "text-destructive" : ""}`}>{outboxHealth.emailFailedCount}</p></div>
            </div>
            {outboxHealth.recentFailures.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Recent event failures</h3>
                {outboxHealth.recentFailures.map(failure => (
                  <div key={failure.id} className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{failure.event_key}{failure.document_no ? ` / ${failure.document_no}` : ""}</span><span className="text-xs text-muted-foreground">Attempt {failure.attempt_count}</span></div>
                    <p className="mt-1 text-xs text-destructive">{failure.last_error || "Unknown processing error"}</p>
                  </div>
                ))}
              </div>
            )}
            {outboxHealth.recentEmailFailures.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Recent email failures</h3>
                {outboxHealth.recentEmailFailures.map(failure => (
                  <div key={failure.id} className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{failure.event_key}{failure.document_no ? ` / ${failure.document_no}` : ""}</span>
                      <span className="text-xs text-muted-foreground">Attempt {failure.attempt_count}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Recipient: {failure.recipient_email || "No email address"}</p>
                    <p className="mt-1 break-words text-xs text-destructive">{failure.last_error || "Unknown email delivery error"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Next retry: {formatLocalDateTime(failure.next_attempt_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules" className="mt-0">
            <Card>
          <CardHeader><CardTitle>Configured Rules</CardTitle><CardDescription>{rules.length} active record{rules.length === 1 ? "" : "s"} in configuration.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {rules.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No notification rules configured.</div>
            ) : rules.map(rule => {
              const moduleDefinition = catalog.find(module => module.key === rule.module_key)
              const eventDefinition = moduleDefinition?.events.find(event => event.key === rule.event_key)
              const groupNames = rule.user_group_ids.map(id => groups.find(group => group.id === id)?.group_name).filter(Boolean)
              return (
                <div key={rule.id} className="rounded-md border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{rule.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${rule.is_active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{rule.is_active ? "Active" : "Inactive"}</span>
                        <span className="rounded-full border px-2 py-0.5 text-xs capitalize">{rule.priority}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{moduleDefinition?.label ?? rule.module_key} / {eventDefinition?.label ?? rule.event_key}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={cannotEdit} onClick={() => editRule(rule)}><Pencil className="size-4" />Edit</Button>
                      <Button type="button" variant="ghost" size="icon-sm" disabled={cannotEdit} onClick={() => void removeRule(rule)} title="Void rule"><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                  <Tabs
                    defaultValue="details"
                    className="mt-3"
                    onValueChange={value => {
                      if (value === "users") void loadAffectedUsers(rule.id)
                    }}
                  >
                    <TabsList variant="line">
                      <TabsTrigger value="details">Rule Details</TabsTrigger>
                      <TabsTrigger value="users">
                        <Users className="size-4" />Affected Users
                        {affectedUsersByRule[rule.id]?.data ? ` (${affectedUsersByRule[rule.id].data?.users.length ?? 0})` : ""}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="details" className="mt-3 rounded-md bg-muted/20 px-3 py-2.5">
                      <p className="text-xs leading-5 text-muted-foreground">
                        Source FMS: {rule.source_fms_types.join(", ") || "Any"} | Recipient FMS: {rule.recipient_fms_types.join(", ") || "Any"} | User Type: {rule.user_types.map(type => USER_TYPE_LABELS.get(type)).join(", ") || "Any"} | Group: {groupNames.join(", ") || "Any"} | Email: {rule.email_enabled ? "On" : "Off"}
                      </p>
                    </TabsContent>
                    <TabsContent value="users" className="mt-3">
                      <AffectedUsersPanel
                        rule={rule}
                        state={affectedUsersByRule[rule.id]}
                        onRefresh={() => void loadAffectedUsers(rule.id, true)}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              )
            })}
          </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function AffectedUsersPanel({
  rule,
  state,
  onRefresh,
}: {
  rule: NotificationRule
  state?: AffectedUsersState
  onRefresh: () => void
}) {
  const data = state?.data

  if (!data && (!state || state.status === "loading")) {
    return (
      <div className="space-y-2 rounded-md border p-3" aria-label="Loading affected users">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
        <p>{state?.error ?? "Unable to load affected users."}</p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRefresh}>Try again</Button>
      </div>
    )
  }

  const routingLabel = data.farmRouting === "document"
    ? "document farm"
    : data.farmRouting === "destination"
      ? "destination farm"
      : data.farmRouting === "origin"
        ? "origin farm"
        : data.farmRouting === "origin_and_destination"
          ? "origin and destination farms"
          : "event"

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-xs leading-5 text-muted-foreground">
          <p><span className="font-medium text-foreground">{data.users.length} potential recipient{data.users.length === 1 ? "" : "s"}.</span> This preview applies active status, Recipient FMS, User Type, User Group, and View permission.</p>
          {data.farmDependent && <p>Actual delivery is narrowed to users assigned to the posted event&apos;s {routingLabel}; Super Admin has the configured farm bypass.</p>}
          {data.excludeInitiator && <p>The initiator is removed when that user is the one who completed the event.</p>}
          {!rule.is_active && <p className="font-medium text-amber-700 dark:text-amber-400">This rule is inactive, so it currently delivers to nobody.</p>}
          {state?.status === "error" && <p className="text-destructive">Refresh failed: {state.error}</p>}
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onRefresh} disabled={state?.status === "loading"}>
          <RefreshCcw className={`size-4 ${state?.status === "loading" ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {data.users.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No users currently match this rule.</div>
      ) : (
        <div className="max-h-96 overflow-auto rounded-md border">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">FMS / User Type</th>
                <th className="px-3 py-2 font-medium">User Group</th>
                <th className="px-3 py-2 font-medium">Assigned Farms</th>
                <th className="px-3 py-2 font-medium">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.users.map(user => (
                <tr key={user.id} className="align-top">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email || "No email address"}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <p>{user.fmsType ?? "No FMS Type"}</p>
                    <p className="text-xs text-muted-foreground">{USER_TYPE_LABELS.get(user.userType) ?? `Type ${user.userType}`}</p>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{user.userGroupName ?? "No group"}</td>
                  <td className="px-3 py-2.5">
                    {user.farmBypass ? (
                      <span className="rounded-full border px-2 py-0.5 text-xs">All farms (bypass)</span>
                    ) : data.farmDependent ? (
                      <div className="flex max-w-md flex-wrap gap-1">
                        {user.farms.map((farm, index) => (
                          <span key={`${farm.id ?? farm.code}-${index}`} className="rounded-full border px-2 py-0.5 text-xs">
                            {[farm.code, farm.name].filter(Boolean).join(" - ")}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not required</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {!rule.email_enabled ? (
                      <span className="text-xs text-muted-foreground">Channel off</span>
                    ) : user.emailEligible ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">Ready</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">Missing or invalid</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TemplateField({
  id,
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  className,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  multiline?: boolean
  className?: string
}) {
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const selectionRef = useRef({ start: value.length, end: value.length })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState("")
  const suggestions = NOTIFICATION_TEMPLATE_PLACEHOLDERS.filter(item =>
    !query || item.key.includes(query.toLowerCase()) || item.label.toLowerCase().includes(query.toLowerCase()),
  )

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const nextValue = event.currentTarget.value
    const cursor = event.currentTarget.selectionStart ?? nextValue.length
    const beforeCursor = nextValue.slice(0, cursor)
    const openBrace = beforeCursor.lastIndexOf("{")
    const closeBrace = beforeCursor.lastIndexOf("}")
    const partial = openBrace > closeBrace ? beforeCursor.slice(openBrace + 1) : ""
    const emptyBraces = nextValue.slice(Math.max(0, cursor - 2), cursor) === "{}"

    selectionRef.current = emptyBraces
      ? { start: cursor - 2, end: cursor }
      : { start: cursor, end: cursor }
    onChange(nextValue)

    if (emptyBraces || (openBrace > closeBrace && /^[a-z_]*$/i.test(partial))) {
      setQuery(emptyBraces ? "" : partial)
      setPickerOpen(true)
    } else if (pickerOpen) {
      setPickerOpen(false)
      setQuery("")
    }
  }

  function rememberSelection() {
    const field = fieldRef.current
    if (!field) return
    selectionRef.current = {
      start: field.selectionStart ?? value.length,
      end: field.selectionEnd ?? value.length,
    }
  }

  function insertPlaceholder(token: string) {
    let { start } = selectionRef.current
    const { end } = selectionRef.current
    const beforeCursor = value.slice(0, start)
    const openBrace = beforeCursor.lastIndexOf("{")
    const closeBrace = beforeCursor.lastIndexOf("}")
    if (value.slice(Math.max(0, start - 2), start) === "{}") start = Math.max(0, start - 2)
    else if (openBrace > closeBrace && /^[a-z_]*$/i.test(beforeCursor.slice(openBrace + 1))) start = openBrace

    const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`
    const nextCursor = start + token.length
    onChange(nextValue)
    setPickerOpen(false)
    setQuery("")
    selectionRef.current = { start: nextCursor, end: nextCursor }
    window.setTimeout(() => {
      fieldRef.current?.focus()
      fieldRef.current?.setSelectionRange(nextCursor, nextCursor)
    }, 0)
  }

  const field = multiline ? (
    <Textarea
      ref={fieldRef as React.Ref<HTMLTextAreaElement>}
      id={id}
      value={value}
      onChange={handleChange}
      onClick={rememberSelection}
      onKeyUp={rememberSelection}
      placeholder={placeholder}
      className="min-h-28"
    />
  ) : (
    <Input
      ref={fieldRef as React.Ref<HTMLInputElement>}
      id={id}
      value={value}
      onChange={handleChange}
      onClick={rememberSelection}
      onKeyUp={rememberSelection}
      placeholder={placeholder}
    />
  )

  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Label htmlFor={id}>{label}</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" className="size-6 text-muted-foreground" aria-label={`Valid ${label.toLowerCase()} placeholders`}>
                <Info className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="w-80 space-y-1.5">
              <p className="font-semibold">Valid placeholders</p>
              {NOTIFICATION_TEMPLATE_PLACEHOLDERS.map(item => (
                <p key={item.key}><code>{item.token}</code> — {item.description}</p>
              ))}
            </TooltipContent>
          </Tooltip>
        </div>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" onClick={rememberSelection}>
              <Braces className="size-4" />Insert placeholder
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-2" onOpenAutoFocus={event => event.preventDefault()}>
            <p className="px-2 pb-2 text-xs text-muted-foreground">Select a placeholder to insert at the cursor.</p>
            <div className="space-y-1">
              {suggestions.length > 0 ? suggestions.map(item => (
                <button
                  key={item.key}
                  type="button"
                  className="w-full rounded-md px-2 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => insertPlaceholder(item.token)}
                >
                  <code className="text-xs font-semibold text-primary">{item.token}</code>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                </button>
              )) : <p className="px-2 py-3 text-sm text-muted-foreground">No matching placeholders.</p>}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {field}
    </div>
  )
}

function AudiencePanel({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return <div className="rounded-md border bg-muted/20 p-3"><h3 className="text-sm font-semibold">{title}</h3><p className="mb-3 text-xs text-muted-foreground">{hint}</p><div className="max-h-36 space-y-2 overflow-y-auto">{children}</div></div>
}

function CheckOption({ label, checked, disabled, onCheckedChange }: { label: string; checked: boolean; disabled?: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={checked} disabled={disabled} onCheckedChange={value => onCheckedChange(Boolean(value))} /><span>{label}</span></label>
}

function SwitchOption({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"><Label className="text-xs">{label}</Label><Switch checked={checked} onCheckedChange={onCheckedChange} /></div>
}
