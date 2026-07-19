import { type ReactNode } from 'react'

export function PageHeader({
  title,
  desc,
  right
}: {
  title: string
  desc?: string
  right?: ReactNode
}): JSX.Element {
  return (
    <div className="flex items-end justify-between px-6 py-4 border-b border-line bg-panel sticky top-0 z-10">
      <div>
        <h1 className="text-[1.4em] font-bold text-ink">{title}</h1>
        {desc && <p className="text-muted text-[0.85em] mt-0.5">{desc}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  )
}

export function money(n: number | undefined): string {
  return `￥${(n ?? 0).toFixed(2)}`
}
