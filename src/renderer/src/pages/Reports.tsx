import { useEffect, useState } from 'react'
import type { Prescription, PurchaseRecord } from '../../../shared/types'
import { PageHeader, money } from '../components/ui'
import { useToast } from '../components/Toast'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export function Reports(): JSX.Element {
  const { toast } = useToast()
  const [tab, setTab] = useState<'sales' | 'purchases'>('sales')
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(today())
  const [sales, setSales] = useState<{
    prescriptions: Prescription[]
    total: number
    herbTotal: number
    feeTotal: number
    cost: number
    profit: number
  }>({ prescriptions: [], total: 0, herbTotal: 0, feeTotal: 0, cost: 0, profit: 0 })
  const [purchases, setPurchases] = useState<{ purchases: PurchaseRecord[]; total: number }>({
    purchases: [],
    total: 0
  })

  const load = async (): Promise<void> => {
    const s = await window.api.reports.sales(from, to)
    if (s.ok && s.data) setSales(s.data)
    const p = await window.api.reports.purchases(from, to)
    if (p.ok && p.data) setPurchases(p.data)
  }
  useEffect(() => {
    load()
  }, [from, to])

  const reprint = async (id: number): Promise<void> => {
    const res = await window.api.dispense.print(id)
    if (res.ok && res.data?.ok) toast('已发送打印', 'ok')
    else toast('打印失败：' + (res.data?.error || res.error || ''), 'error')
  }
  const voidRx = async (id: number): Promise<void> => {
    if (!confirm(`确认作废处方 #${id}？将恢复库存，且从营业额中扣除。`)) return
    const res = await window.api.prescriptions.void(id)
    if (res.ok) {
      toast('已作废，库存已恢复', 'ok')
      load()
    } else toast(res.error || '作废失败', 'error')
  }

  return (
    <div className="min-h-full flex flex-col">
      <PageHeader
        title="进销存报表"
        desc="按时间范围查看销售（划价）与进货明细"
        right={
          <>
            <input type="date" className="input w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-muted">至</span>
            <input type="date" className="input w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        }
      />
      <div className="p-6 space-y-4">
        <div className="flex gap-2">
          <button
            className={tab === 'sales' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => setTab('sales')}
          >
            销售明细 · {money(sales.total)}
          </button>
          <button
            className={tab === 'purchases' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => setTab('purchases')}
          >
            进货明细 · {money(purchases.total)}
          </button>
        </div>

        {tab === 'sales' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '营业额（总价）', value: sales.total, strong: true },
                { label: '其中·药费', value: sales.herbTotal },
                { label: '其中·针灸+其它', value: sales.feeTotal },
                { label: '毛利估算', value: sales.profit, hint: `成本约 ${money(sales.cost)}` }
              ].map((s) => (
                <div key={s.label} className="card p-3">
                  <div className="text-muted text-[0.8em]">{s.label}</div>
                  <div className={`${s.strong ? 'text-brand' : ''} font-bold text-[1.3em]`}>
                    {money(s.value)}
                  </div>
                  {s.hint && <div className="text-muted text-[0.72em]">{s.hint}</div>}
                </div>
              ))}
            </div>
            <p className="text-muted text-[0.75em]">
              毛利/成本为按“当前成本价”估算（历史成本可能已变动），仅供参考；已作废处方不计入。
            </p>
          <div className="card overflow-hidden">
            <table className="w-full border-collapse">
              <thead className="bg-surface">
                <tr>
                  <th className="th">处方号</th>
                  <th className="th">顾客</th>
                  <th className="th">医师</th>
                  <th className="th text-right">付数</th>
                  <th className="th text-right">金额</th>
                  <th className="th">时间</th>
                  <th className="th w-28"></th>
                </tr>
              </thead>
              <tbody>
                {sales.prescriptions.map((p) => (
                  <tr key={p.id}>
                    <td className="td">#{p.id}</td>
                    <td className="td">{p.patient_name || '散客'}</td>
                    <td className="td text-muted">{p.doctor_name || '—'}</td>
                    <td className="td text-right">{p.doses_count}</td>
                    <td className="td text-right font-medium">{money(p.total_price)}</td>
                    <td className="td text-muted text-[0.85em]">{p.created_at}</td>
                    <td className="td text-right whitespace-nowrap">
                      <button className="text-brand hover:underline text-[0.82em] mr-2" onClick={() => reprint(p.id)}>
                        补打
                      </button>
                      <button className="text-danger hover:underline text-[0.82em]" onClick={() => voidRx(p.id)}>
                        作废
                      </button>
                    </td>
                  </tr>
                ))}
                {sales.prescriptions.length === 0 && (
                  <tr>
                    <td className="td text-center text-muted py-8" colSpan={7}>
                      该时间段无销售记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full border-collapse">
              <thead className="bg-surface">
                <tr>
                  <th className="th">药名</th>
                  <th className="th text-right">数量kg</th>
                  <th className="th text-right">单价</th>
                  <th className="th text-right">金额</th>
                  <th className="th">时间</th>
                </tr>
              </thead>
              <tbody>
                {purchases.purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="td">{p.herb_name}</td>
                    <td className="td text-right">{p.qty_kg}</td>
                    <td className="td text-right">{money(p.purchase_price)}</td>
                    <td className="td text-right font-medium">{money(p.qty_kg * p.purchase_price)}</td>
                    <td className="td text-muted text-[0.85em]">{p.purchased_at}</td>
                  </tr>
                ))}
                {purchases.purchases.length === 0 && (
                  <tr>
                    <td className="td text-center text-muted py-8" colSpan={5}>
                      该时间段无进货记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
