import { type ReactNode } from 'react'

export type GoodsIssueHeaderField = {
  key: string
  label: string
  content: ReactNode
  className?: string
}

type GoodsIssueHeaderSectionProps = {
  fields: GoodsIssueHeaderField[]
  balanced?: boolean
}

export default function GoodsIssueHeaderSection({ fields, balanced = false }: GoodsIssueHeaderSectionProps) {
  return (
    <div className={balanced ? 'grid w-full grid-cols-2 items-start gap-4 p-5 md:grid-cols-[repeat(4,minmax(0,320px))] md:gap-2' : 'grid gap-x-16 gap-y-3 p-5 lg:grid-cols-2'}>
      {fields.map(item => (
        <div
          key={item.key}
          className={balanced
            ? 'w-full space-y-2'
            : `grid items-center gap-2 ${item.className ?? 'sm:grid-cols-[112px_minmax(0,300px)]'}`}
        >
          <label className="text-sm font-semibold">{item.label}</label>
          {item.content}
        </div>
      ))}
    </div>
  )
}
