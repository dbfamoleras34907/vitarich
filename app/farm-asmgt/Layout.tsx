'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCcw, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import SearchableCombobox from '@/components/SearchableCombobox'
import {
  AssignedUserBadgeGroups,
  AssignedUserList,
  assignedUserLabel,
} from '@/components/farm-assignment/AssignedUserDisplay'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermission } from '@/hooks/usePermission'
import {
  getFarmAssignmentDirectory,
  saveFarmAssignments,
  type FarmAssignmentDirectoryRow,
} from '@/lib/data/repositories/farmAssignments'
import type { FarmAssignableUser } from '@/lib/data/repositories/farmAssignedUsers'

const PAGE_SIZE = 20
const ALL = 'all'

const sameIds = (left: number[], right: number[]) => {
  if (left.length !== right.length) return false
  const sortedLeft = [...left].sort((a, b) => a - b)
  const sortedRight = [...right].sort((a, b) => a - b)
  return sortedLeft.every((id, index) => id === sortedRight[index])
}

export default function FarmAssignmentLayout() {
  const cannotView = usePermission('/farm-asmgt/view')
  const cannotEdit = usePermission('/farm-asmgt/edit')
  const [farms, setFarms] = useState<FarmAssignmentDirectoryRow[]>([])
  const [users, setUsers] = useState<FarmAssignableUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [fmsType, setFmsType] = useState(ALL)
  const [region, setRegion] = useState(ALL)
  const [page, setPage] = useState(1)
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null)
  const [viewFarmId, setViewFarmId] = useState<number | null>(null)
  const [draftUserIds, setDraftUserIds] = useState<number[]>([])
  const [pickerValue, setPickerValue] = useState('')
  const assignmentDrawerRef = useRef<HTMLDivElement>(null)

  const loadDirectory = useCallback(async () => {
    setLoading(true)
    try {
      const directory = await getFarmAssignmentDirectory()
      setFarms(directory.farms)
      setUsers(directory.users)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load farm assignments.')
      setFarms([])
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!cannotView) void loadDirectory()
  }, [cannotView, loadDirectory])

  useEffect(() => setPage(1), [search, fmsType, region])

  const selectedFarm = farms.find(farm => farm.id === selectedFarmId) ?? null
  const viewFarm = farms.find(farm => farm.id === viewFarmId) ?? null
  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users])
  const originalIds = selectedFarm?.assignedUsers.map(user => user.id) ?? []
  const draftUsers = draftUserIds.flatMap(id => {
    const user = usersById.get(id)
    return user ? [user] : []
  }).sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
  const availableUsers = users.filter(user => !draftUserIds.includes(user.id))
  const regions = useMemo(() => [...new Set(farms.map(farm => farm.region))].sort(), [farms])
  const filteredFarms = useMemo(() => {
    const term = search.trim().toLowerCase()
    return farms.filter(farm => {
      const matchesSearch = !term || `${farm.code} ${farm.name} ${farm.region} ${farm.assignedUsers.map(assignedUserLabel).join(' ')}`.toLowerCase().includes(term)
      return matchesSearch && (fmsType === ALL || farm.fmsType === fmsType) && (region === ALL || farm.region === region)
    })
  }, [farms, fmsType, region, search])
  const totalPages = Math.max(1, Math.ceil(filteredFarms.length / PAGE_SIZE))
  const visibleFarms = filteredFarms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openAssignment = (farm: FarmAssignmentDirectoryRow) => {
    setSelectedFarmId(farm.id)
    setDraftUserIds(farm.assignedUsers.map(user => user.id))
    setPickerValue('')
  }

  const openMobileAssignedUsers = (farmId: number) => {
    if (window.matchMedia('(max-width: 767px)').matches) setViewFarmId(farmId)
  }

  const closeAssignment = () => {
    if (saving) return
    setSelectedFarmId(null)
    setDraftUserIds([])
    setPickerValue('')
  }

  const addUser = (value: string) => {
    const userId = Number(value)
    if (Number.isSafeInteger(userId) && usersById.has(userId)) {
      setDraftUserIds(current => current.includes(userId) ? current : [...current, userId])
    }
    setPickerValue('')
  }

  const save = async () => {
    if (!selectedFarm) return
    setSaving(true)
    try {
      const savedIds = await saveFarmAssignments(selectedFarm.id, draftUserIds)
      setFarms(current => current.map(farm => farm.id === selectedFarm.id
        ? { ...farm, assignedUsers: savedIds.flatMap(id => {
          const user = usersById.get(id)
          return user ? [{ id: user.id, name: user.name, userType: user.userType }] : []
        }) }
        : farm))
      toast.success(`Assignments saved for ${selectedFarm.code}.`)
      setSelectedFarmId(null)
      setDraftUserIds([])
      setPickerValue('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save farm assignments.')
    } finally {
      setSaving(false)
    }
  }

  if (cannotView) {
    return <div className="m-4 rounded-md border bg-card p-6 text-sm text-muted-foreground">You do not have permission to view Farm Assignment.</div>
  }

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Farm Assignment Directory</h1>
          <p className="text-sm text-muted-foreground">Assign active Admin and User accounts to farms. Farm details remain read-only.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadDirectory()} disabled={loading}>
          <RefreshCcw className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      <div className="grid gap-2 rounded-md border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[minmax(260px,1fr)_180px_240px]">
        <div className="space-y-1">
          <Label htmlFor="farm-assignment-search">Search</Label>
          <Input id="farm-assignment-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Farm code, name, region, or assigned user" />
        </div>
        <div className="space-y-1">
          <Label>FMS Type</Label>
          <Select value={fmsType} onValueChange={setFmsType}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All FMS Types</SelectItem>
              <SelectItem value="Broiler">Broiler</SelectItem>
              <SelectItem value="Breeder">Breeder</SelectItem>
              <SelectItem value="Hatchery">Hatchery</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2 lg:col-span-1">
          <Label>Region</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Regions</SelectItem>
              {regions.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm md:min-w-[920px]">
            <thead className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="hidden w-36 px-3 py-2 font-medium md:table-cell">Farm Code</th>
                <th className="min-w-0 px-3 py-2 font-medium md:min-w-64">
                  <span className="md:hidden">Farm</span>
                  <span className="hidden md:inline">Farm Name</span>
                </th>
                <th className="w-28 px-3 py-2 font-medium">FMS Type</th>
                <th className="hidden w-56 px-3 py-2 font-medium md:table-cell">Region</th>
                <th className="hidden min-w-80 px-3 py-2 font-medium md:table-cell">Assigned TA</th>
                <th className="w-28 px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 6 }, (_, index) => (
                <tr key={index} className="border-b last:border-0">
                  {Array.from({ length: 6 }, (__, cell) => (
                    <td
                      key={cell}
                      className={`${cell === 0 || cell === 3 || cell === 4 ? 'hidden md:table-cell ' : ''}px-3 py-2`}
                    >
                      <Skeleton className="h-6 w-full" />
                    </td>
                  ))}
                </tr>
              )) : visibleFarms.length === 0 ? (
                <tr><td colSpan={6} className="h-28 px-3 text-center text-muted-foreground">No farms match the current filters.</td></tr>
              ) : visibleFarms.map(farm => (
                <tr
                  key={farm.id}
                  className="cursor-pointer border-b align-top last:border-0 hover:bg-muted/30 md:cursor-default"
                  onClick={() => openMobileAssignedUsers(farm.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openMobileAssignedUsers(farm.id)
                    }
                  }}
                  tabIndex={0}
                  aria-label={`View assigned TA for ${farm.code} ${farm.name}`}
                >
                  <td className="hidden px-3 py-2 font-medium tabular-nums md:table-cell">{farm.code}</td>
                  <td className="min-w-0 px-3 py-2">
                    <div className="font-medium md:font-normal">{farm.name}</div>
                    <div className="mt-0.5 text-xs tabular-nums text-muted-foreground md:hidden">{farm.code}</div>
                  </td>
                  <td className="px-3 py-2"><Badge variant="outline">{farm.fmsType}</Badge></td>
                  <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">{farm.region}</td>
                  <td className="hidden px-3 py-2 md:table-cell">
                    <AssignedUserBadgeGroups users={farm.assignedUsers} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={event => {
                        event.stopPropagation()
                        openAssignment(farm)
                      }}
                      disabled={cannotEdit}
                    >
                      <UserPlus /> Assign
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 border-t px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{filteredFarms.length} farm{filteredFarms.length === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button>
            <span>Page {Math.min(page, totalPages)} of {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>Next</Button>
          </div>
        </div>
      </div>

      <Sheet open={Boolean(viewFarm)} onOpenChange={open => { if (!open) setViewFarmId(null) }}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>Assigned TA</SheetTitle>
            <SheetDescription>{viewFarm ? `${viewFarm.code} · ${viewFarm.name}` : 'Selected farm'}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-2 flex items-center justify-between">
              <Label>Assigned users</Label>
              <span className="text-xs text-muted-foreground">{viewFarm?.assignedUsers.length ?? 0} assigned</span>
            </div>
            <AssignedUserList users={viewFarm?.assignedUsers ?? []} />
          </div>
          <SheetFooter className="border-t bg-background">
            <Button type="button" variant="outline" onClick={() => setViewFarmId(null)}>Close</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(selectedFarm)} onOpenChange={open => { if (!open) closeAssignment() }}>
        <SheetContent ref={assignmentDrawerRef} side="right" className="w-full gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle>Assign TA to Farm</SheetTitle>
            <SheetDescription>{selectedFarm ? `${selectedFarm.code} · ${selectedFarm.name}` : 'Select a farm.'}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <div className="space-y-2">
              <Label>Add Admin or User</Label>
              <SearchableCombobox
                items={availableUsers.map(user => ({ code: String(user.id), name: assignedUserLabel(user) }))}
                value={pickerValue}
                onValueChange={addUser}
                showCode={false}
                placeholder={availableUsers.length ? 'Search and select a user' : 'All eligible users are assigned'}
                inputAriaLabel="Add assigned user"
                className="w-full max-w-none"
                contentClassName="w-[var(--anchor-width)]"
                portalContainer={assignmentDrawerRef}
                wrapItemLabels
                disabled={saving || cannotEdit || availableUsers.length === 0}
              />
              <p className="text-xs text-muted-foreground">Selecting a user adds them to the assignment list below.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Assigned users</Label>
                <span className="text-xs text-muted-foreground">{draftUsers.length} assigned</span>
              </div>
              <AssignedUserList
                users={draftUsers}
                onRemove={userId => setDraftUserIds(current => current.filter(id => id !== userId))}
                disabled={saving || cannotEdit}
              />
              <p className="text-xs text-muted-foreground">Removed users are soft-voided from <code>users_farms</code> when you save; records are not deleted.</p>
            </div>
          </div>
          <SheetFooter className="border-t bg-background sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeAssignment} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={() => void save()} disabled={saving || cannotEdit || sameIds(originalIds, draftUserIds)}>
              {saving ? 'Saving...' : 'Save Assignments'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
