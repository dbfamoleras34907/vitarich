import { type ReactNode } from 'react'

export type GoodsIssueHeaderField = {
  key: string
  label: string
  content: ReactNode
  className?: string
}

type GoodsIssueHeaderSectionProps = {
  fields: GoodsIssueHeaderField[]
}

export default function GoodsIssueHeaderSection({ fields }: GoodsIssueHeaderSectionProps) {
  return (
    <div className="grid gap-x-16 gap-y-3 p-5 lg:grid-cols-2">
      {fields.map(item => (
        <div
          key={item.key}
          className={`grid items-center gap-2 ${item.className ?? 'sm:grid-cols-[112px_minmax(0,300px)]'}`}
        >
          <label className="text-sm font-semibold">{item.label}</label>
          {item.content}
        </div>
      ))}
    </div>
  )
}
