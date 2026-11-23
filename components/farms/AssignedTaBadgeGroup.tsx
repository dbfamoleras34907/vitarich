import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { FarmAssignedUser } from '@/lib/data/repositories/farmAssignedUsers'
import { cn } from '@/lib/utils'

type AssignedTaBadgeGroupProps = {
  users: readonly FarmAssignedUser[]
  loading?: boolean
  error?: boolean
  waitingForFarm?: boolean
  compact?: boolean
  className?: string
}

const userTypeLabel = (userType?: FarmAssignedUser['userType']) => {
  if (userType === 1) return 'Super Admin'
  if (userType === 2) return 'Admin'
  if (userType === 3) return 'User'
  return 'User'
}

export function AssignedTaBadgeGroup({
  users,
  loading = false,
  error = false,
  waitingForFarm = false,
  compact = false,
  className,
}: AssignedTaBadgeGroupProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className={cn(
        'flex flex-wrap items-center gap-1.5',
        compact ? 'text-[11px]' : 'text-xs',
      )}>
        <span className="shrink-0 font-medium text-muted-foreground">Assigned TA</span>
        {loading ? (
          <>
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-5 w-24 rounded-md" />
          </>
        ) : error ? (
          <span className="text-amber-700 dark:text-amber-400">Unavailable</span>
        ) : waitingForFarm ? (
          <span className="text-muted-foreground">Select farm</span>
        ) : users.length ? users.map(user => (
          <Badge
            key={user.id}
            variant="outline"
            className={cn(
              'max-w-full rounded-md bg-card font-medium text-foreground',
              compact ? 'h-5 px-1.5 text-[10px]' : 'px-2 py-0.5 text-xs',
            )}
            title={`${user.id} - ${user.name} - ${userTypeLabel(user.userType)}`}
          >
            <span className="truncate">{user.name}</span>
          </Badge>
        )) : (
          <Badge variant="secondary" className={cn(compact && 'h-5 px-1.5 text-[10px]')}>
            Unassigned
          </Badge>
        )}
      </div>
    </div>
  )
}
