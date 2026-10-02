import { Skeleton } from '@/components/ui/skeleton'

export default function CycleDashboardSkeleton({ records = false }: { records?: boolean }) {
  return <div role="status" aria-label={records ? 'Loading cycle data' : 'Loading Cycle Dashboard'} className="space-y-2">
    <span className="sr-only">{records ? 'Loading cycle data...' : 'Loading Cycle Dashboard...'}</span>
    <div aria-hidden="true" className="space-y-2">
      <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-9 w-24 bg-muted" />)}
      </div>
      {records ? <div className="space-y-3 overflow-hidden rounded-lg border bg-card p-3">
        <Skeleton className="h-6 w-44 bg-muted" />
        {Array.from({ length: 10 }, (_, index) => <div key={index} className="grid grid-cols-4 gap-3 border-b pb-3 last:border-0">
          {Array.from({ length: 4 }, (_, column) => <Skeleton key={column} className="h-5 w-full bg-muted" />)}
        </div>)}
      </div> : <div className="grid items-start gap-2 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2 rounded-md border bg-card p-3">
          <Skeleton className="mb-4 h-4 w-28 bg-muted" />
          {Array.from({ length: 20 }, (_, index) => <div key={index} className="flex justify-between gap-4">
            <Skeleton className="h-3 w-24 bg-muted" />
            <Skeleton className="h-3 w-16 bg-muted" />
          </div>)}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => <div key={index} className="min-h-20 rounded-md border bg-card p-2.5 shadow-[var(--starbucks-card-shadow)]">
              <div className="flex items-center gap-2"><Skeleton className="size-7 bg-muted" /><Skeleton className="h-3 w-24 bg-muted" /></div>
              <div className="mt-2 flex gap-3 border-t pt-2"><Skeleton className="h-7 flex-1 bg-muted" /><Skeleton className="h-7 flex-1 bg-muted" /></div>
            </div>)}
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => <div key={index} className="space-y-4 rounded-lg border bg-card p-3">
              <Skeleton className="h-4 w-36 bg-muted" />
              <Skeleton className="h-40 w-full bg-muted" />
            </div>)}
          </div>
        </div>
      </div>}
    </div>
  </div>
}
