import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { FarmAssignedUser } from '@/lib/data/repositories/farmAssignedUsers'

export const assignedUserLabel = (user: { name: string; userType?: 1 | 2 | 3 }) =>
  user.userType === 2 ? `${user.name} - Admin` : user.name

export function AssignedUserBadgeGroups({ users }: { users: FarmAssignedUser[] }) {
  if (users.length === 0) return <span className="text-muted-foreground">Unassigned</span>

  const groups = Array.from(
    { length: Math.ceil(users.length / 5) },
    (_, index) => users.slice(index * 5, index * 5 + 5),
  )

  return (
    <div className="space-y-1">
      {groups.map((group, index) => (
        <div key={index} className="flex flex-wrap gap-1">
          {group.map(user => (
            <Badge key={user.id} variant="secondary" className="max-w-64 truncate">
              {assignedUserLabel(user)}
            </Badge>
          ))}
        </div>
      ))}
    </div>
  )
}

export function AssignedUserList({
  users,
  onRemove,
  disabled = false,
}: {
  users: FarmAssignedUser[]
  onRemove?: (userId: number) => void
  disabled?: boolean
}) {
  if (users.length === 0) {
    return (
      <div className="flex min-h-24 items-center rounded-md border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
        No Admin or User is assigned to this farm.
      </div>
    )
  }

  return (
    <ul className="divide-y overflow-hidden rounded-md border bg-card">
      {users.map(user => (
        <li key={user.id} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
          <span className="min-w-0 truncate text-sm font-medium">{assignedUserLabel(user)}</span>
          {onRemove && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${assignedUserLabel(user)} from this farm`}
              onClick={() => onRemove(user.id)}
              disabled={disabled}
            >
              <X className="size-4" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
