import { PageSection, PageShell } from '@/components/ui/page-layout'

export default function GoodsReceiveLoadingShell() {
  return (
    <PageShell>
      <div className="flex items-center justify-between gap-3">
        <div className="h-6 w-56 rounded bg-muted" />
        <div className="h-8 w-24 rounded-md bg-muted" />
      </div>

      <PageSection>
        <div className="grid gap-x-8 gap-y-2 p-3 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid items-center gap-1.5 sm:grid-cols-[88px_minmax(0,300px)]">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-8 rounded-md bg-muted" />
            </div>
          ))}
        </div>

        <div className="border-t p-3">
          <div className="overflow-hidden rounded-md border bg-card">
            <div className="border-b bg-muted/20 px-3 py-2">
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="mt-1.5 h-3 w-20 rounded bg-muted" />
            </div>
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid grid-cols-[40px_2fr_1fr_1fr_1fr_1fr_1fr_56px] gap-3">
                  {Array.from({ length: 8 }).map((__, cellIndex) => (
                    <div key={cellIndex} className="h-8 rounded bg-muted" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageSection>
    </PageShell>
  )
}
