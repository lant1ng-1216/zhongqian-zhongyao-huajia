import { useEffect, useState } from 'react'
import type { Herb, PriceAdjustment } from '../../../shared/types'
import { PageHeader, money } from '../components/ui'
import { useToast } from '../components/Toast'

export function PriceAdjust(): JSX.Element {
  const { toast } = useToast()
  const [herbs, setHerbs] = useState<Herb[]>([])
  const [history, setHistory] = useState<PriceAdjustment[]>([])
  const [q, setQ] = useState('')
  const [edits, setEdits] = useState<Record<number, string>>({})

  const load = async (): Promise<void> => {
    const [h, hist] = await Promise.all([window.api.herbs.list(false), window.api.prices.history()])
    if (h.ok && h.data) setHerbs(h.data)
    if (hist.ok && hist.data) setHistory(hist.data)
  }
  useEffect(() => {
    load()
  }, [])

  const filtered = herbs.filter((h) => !q || h.name.includes(q) || h.pinyin_code.includes(q.toLowerCase()))

  const apply = async (h: Herb): Promise<void> => {
    const v = parseFloat(edits[h.id])
    if (isNaN(v) || v < 0) return toast('价格无效', 'error')
    if (v === h.retail_price) return toast('价格未变化', 'error')
    const res = await window.api.prices.adjust(h.id, v)
    if (res.ok) {
      toast(`${h.name} 调价成功`, 'ok')
      setEdits((e) => {
        const n = { ...e }
        delete n[h.id]
        return n
      })
      load()
    } else toast(res.error || '调价失败', 'error')
  }

  return (
    <div className="min-h-full flex flex-col">
      <PageHeader
        title="调价"
        desc="调整零售价，每次调价自动写入历史，便于追溯"
        right={
          <input className="input w-56" placeholder="搜索药名 / 简码" value={q} onChange={(e) => setQ(e.target.value)} />
        }
      />
      <div className="p-6 grid grid-cols-[1fr_360px] gap-4">
        <div className="card overflow-hidden self-start">
          <table className="w-full border-collapse">
            <thead className="bg-surface">
              <tr>
                <th className="th">药名</th>
                <th className="th text-right">当前零售价/kg</th>
                <th className="th text-right w-40">新零售价</th>
                <th className="th w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => (
                <tr key={h.id}>
                  <td className="td font-medium">{h.name}</td>
                  <td className="td text-right">{money(h.retail_price)}</td>
                  <td className="td text-right">
                    <input
                      type="number"
                      className="input py-1 text-right w-28 inline-block"
                      placeholder={String(h.retail_price)}
                      value={edits[h.id] ?? ''}
                      onChange={(e) => setEdits({ ...edits, [h.id]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && apply(h)}
                    />
                  </td>
                  <td className="td text-right">
                    <button className="btn-primary btn-sm" onClick={() => apply(h)} disabled={edits[h.id] === undefined}>
                      调价
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden self-start">
          <div className="px-4 py-2 bg-surface font-semibold text-[0.9em] text-muted">调价历史</div>
          <table className="w-full border-collapse">
            <thead className="bg-surface">
              <tr>
                <th className="th">药名</th>
                <th className="th text-right">调整</th>
                <th className="th">时间</th>
              </tr>
            </thead>
            <tbody>
              {history.map((a) => (
                <tr key={a.id}>
                  <td className="td">{a.herb_name}</td>
                  <td className="td text-right text-[0.9em]">
                    <span className="text-muted line-through">{a.old_retail_price}</span>
                    {' → '}
                    <span className="text-brand font-medium">{a.new_retail_price}</span>
                  </td>
                  <td className="td text-muted text-[0.82em]">{a.adjusted_at}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td className="td text-center text-muted py-8" colSpan={3}>
                    暂无调价记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
