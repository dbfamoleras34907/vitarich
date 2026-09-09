'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Modal } from '@/lib/Moda'
import { UserRow } from '@/lib/types'
import { UsersGroup } from '../user-group/api'
import { ApprovalTriggerUser } from './api'
import { useMemo, useState } from 'react'

function userName(user?: UserRow) {
  if (!user) return '-'
  const name = [user.firstname, user.middlename, user.lastname]
    .filter(Boolean)
    .join(' ')
    .trim()

  return name || user.email || `User ${user.id}`
}

function buildTriggerUser(user: UserRow): ApprovalTriggerUser {
  return {
    user_id: user.id,
    auth_id: user.auth_id,
    fullname: userName(user),
    email: user.email,
    users_group_id: user.users_group_id ?? null,
    isactive: user.isactive ?? null,
    issuper: user.issuper ?? null,
  }
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${active
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-stone-100 text-stone-600'
        }`}
    >
      {label}
    </span>
  )
}

export default function TriggerUserPickerDialog({
  open,
  onOpenChange,
  title = 'Select Trigger Users',
  description = 'Use the header checkbox to select or clear the currently visible users.',
  users,
  userGroups,
  selectedUsers,
  onSelectedUsersChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  users: UserRow[]
  userGroups: UsersGroup[]
  selectedUsers: ApprovalTriggerUser[]
  onSelectedUsersChange: (users: ApprovalTriggerUser[]) => void
}) {
  const [groupFilter, setGroupFilter] = useState('')
  const [search, setSearch] = useState('')

  const userGroupById = useMemo(
    () => new Map(userGroups.map((group) => [String(group.id), group])),
    [userGroups]
  )

  const selectedUserIds = useMemo(
    () => new Set(selectedUsers.map((user) => Number(user.user_id))),
    [selectedUsers]
  )

  const filteredUsers = useMemo(() => {
    const searchValue = search.trim().toLowerCase()

    return users.filter((user) => {
      const groupMatches = !groupFilter || String(user.users_group_id ?? '') === groupFilter
      const label = `${userName(user)} ${user.email ?? ''} ${user.issuper ?? ''}`.toLowerCase()

      return groupMatches && (!searchValue || label.includes(searchValue))
    })
  }, [groupFilter, search, users])

  const filteredUserIds = useMemo(
    () => filteredUsers.map((user) => user.id),
    [filteredUsers]
  )

  const allFilteredSelected =
    filteredUserIds.length > 0 &&
    filteredUserIds.every((id) => selectedUserIds.has(id))

  const someFilteredSelected =
    filteredUserIds.some((id) => selectedUserIds.has(id)) && !allFilteredSelected

  function toggleUser(user: UserRow, checked: boolean) {
    if (!checked) {
      onSelectedUsersChange(selectedUsers.filter((selected) => selected.user_id !== user.id))
      return
    }

    if (selectedUsers.some((selected) => selected.user_id === user.id)) return

    onSelectedUsersChange([...selectedUsers, buildTriggerUser(user)])
  }

  function toggleFilteredUsers(checked: boolean) {
    if (!checked) {
      const ids = new Set(filteredUserIds)
      onSelectedUsersChange(selectedUsers.filter((user) => !ids.has(user.user_id)))
      return
    }

    const currentIds = new Set(selectedUsers.map((user) => user.user_id))
    const nextUsers = filteredUsers
      .filter((user) => !currentIds.has(user.id))
      .map((user) => buildTriggerUser(user))

    onSelectedUsersChange([...selectedUsers, ...nextUsers])
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className=" max-w-2xl overflow-hidden"
    >
      <div className="grid  min-h-0 grid-rows-[minmax(0,1fr)_auto] border-t border-stone-200 p-4">
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
          <div className="grid shrink-0 gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label>Filter by group</Label>
              <Select value={groupFilter || 'all'} onValueChange={(value) => setGroupFilter(value === 'all' ? '' : value)}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="All groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {userGroups.map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.group_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval-trigger-user-search">Search users</Label>
              <Input
                id="approval-trigger-user-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search fullname, email, status..."
                className="bg-white"
              />
            </div>
          </div>
          <div className=''>
            <div className="min-h-0 overflow-y-auto overscroll-contain rounded-md border border-stone-200">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
                <thead className="text-left">
                  <tr>
                    <th className="sticky top-0 z-10 w-12 border-b border-stone-200 bg-stone-50 px-3 py-2 font-medium text-stone-700 shadow-sm">
                      <Checkbox
                        checked={
                          allFilteredSelected
                            ? true
                            : someFilteredSelected
                              ? 'indeterminate'
                              : false
                        }
                        onCheckedChange={(value) => toggleFilteredUsers(Boolean(value))}
                        disabled={filteredUsers.length === 0}
                      />
                    </th>
                    <th className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50 px-3 py-2 font-medium text-stone-700 shadow-sm">Full Name</th>
                    <th className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50 px-3 py-2 font-medium text-stone-700 shadow-sm">Group</th>
                    <th className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50 px-3 py-2 font-medium text-stone-700 shadow-sm">Status</th>
                    <th className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50 px-3 py-2 font-medium text-stone-700 shadow-sm">Is Super</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const checked = selectedUserIds.has(user.id)
                    const group = user.users_group_id
                      ? userGroupById.get(String(user.users_group_id))?.group_name
                      : ''

                    return (
                      <tr
                        key={user.id}
                        className="cursor-pointer border-t border-stone-200 hover:bg-stone-50"
                        onClick={() => toggleUser(user, !checked)}
                      >
                        <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleUser(user, Boolean(value))}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-stone-900">{userName(user)}</div>
                          <div className="text-xs text-stone-500">{user.email || '-'}</div>
                        </td>
                        <td className="px-3 py-2 text-stone-700">{group || '-'}</td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            active={String(user.isactive ?? '').trim() === '1'}
                            label={String(user.isactive ?? '').trim() === '1' ? 'Active' : 'Inactive'}
                          />
                        </td>
                        <td className="px-3 py-2 text-stone-700">
                          {String(user.issuper ?? '').trim() === '1' ? 'Yes' : 'No'}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="mt-3 flex w-full flex-col gap-2 border-t border-stone-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedUsers.length} selected user{selectedUsers.length === 1 ? '' : 's'}
          </p>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}
