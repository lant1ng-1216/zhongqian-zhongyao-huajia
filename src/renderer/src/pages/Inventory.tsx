import { useEffect, useState } from 'react'
import type { Herb, PurchaseRecord } from '../../../shared/types'
import { PageHeader, money } from '../components/ui'
import { Modal } from '../components/Modal'
import { HerbSelect } from '../components/HerbSelect'
import { useToast } from '../components/Toast'

export function Inventory(): JSX.Element {
  const { toast } = useToast()
  const [herbs, setHerbs] = useState<Herb[]>([])
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([])
  const [onlyLow, setOnlyLow] = useState(false)
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Herb | null>(null)
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')

  const load = async (): Promise<void> => {
    const [h, p] = await Promise.all([window.api.herbs.list(false), window.api.purchases.list()])
    if (h.ok && h.data) setHerbs(h.data)
    if (p.ok && p.data) setPurchases(p.data)
  }
  useEffect(() => {
    load()
  }, [])

  const rows = herbs.filter((h) => !onlyLow || (h.stock_warning_line > 0 && h.stock_qty <= h.stock_warning_line))

  const openPurchase = (h?: Herb): void => {
    setPicked(h || null)
    setQty('')
    setPrice(h ? String(h.last_purchase_price || '') : '')
    setOpen(true)
  }

  const submit = async (): Promise<void> => {
    if (!picked) return toast('请选择药品', 'error')
    const q = parseFloat(qty)
    const pr = parseFloat(price)
    if (!q || q <= 0) return toast('进货数量无效', 'error')
    if (pr < 0 || isNaN(pr)) return toast('进货单价无效', 'error')
    const res = await window.api.purchases.create(picked.id, q, pr)
    if (res.ok) {
      toast('进货已入库，库存已增加', 'ok')
      setOpen(false)
      load()
    } else toast(res.error || '入库失败', 'error')
  }

  return (
    <div className="min-h-full flex flex-col">
      <PageHeader
        title="库存 · 进货"
        desc="进货自动增加库存并更新最近进货价；可筛选查看库存偏低药品（仅提示）"
        right={
          <>
            <label className="flex items-center gap-2 text-[0.9em] cursor-pointer mr-2">
              <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
              只看库存偏低
            </label>
            <button className="btn-primary" onClick={() => openPurchase()}>
              + 进货入库
            </button>
          </>
        }
      />
      <div className="p-6 grid grid-cols-[1fr_360px] gap-4">
        <div className="card overflow-hidden self-start">
          <div className="px-4 py-2 bg-surface font-semibold text-[0.9em] text-muted">库存清单</div>
          <table className="w-full border-collapse">
            <thead className="bg-surface">
              <tr>
                <th className="th">药名</th>
                <th className="th text-right">库存(kg)</th>
                <th className="th text-right">预警线</th>
                <th className="th text-right">最近进货价</th>
                <th className="th w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => {
                const low = h.stock_warning_line > 0 && h.stock_qty <= h.stock_warning_line
                return (
                  <tr key={h.id} className={low ? 'bg-danger/5' : ''}>
                    <td className="td font-medium">{h.name}</td>
                    <td className={`td text-right ${low ? 'text-danger font-semibold' : ''}`}>
                      {h.stock_qty}
                      {low && ' ⚠'}
                    </td>
                    <td className="td text-right text-muted">{h.stock_warning_line || '—'}</td>
                    <td className="td text-right text-muted">{money(h.last_purchase_price)}</td>
                    <td className="td text-right">
                      <button className="text-brand hover:underline text-[0.85em]" onClick={() => openPurchase(h)}>
                        进货
                      </button>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td className="td text-center text-muted py-8" colSpan={5}>
                    无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden self-start">
          <div className="px-4 py-2 bg-surface font-semibold text-[0.9em] text-muted">近期进货记录</div>
          <table className="w-full border-collapse">
            <thead className="bg-surface">
              <tr>
                <th className="th">药名</th>
                <th className="th text-right">数量kg</th>
                <th className="th text-right">单价</th>
                <th className="th">时间</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td className="td">{p.herb_name}</td>
                  <td className="td text-right">{p.qty_kg}</td>
                  <td className="td text-right">{money(p.purchase_price)}</td>
                  <td className="td text-muted text-[0.85em]">{p.purchased_at}</td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td className="td text-center text-muted py-8" colSpan={4}>
                    暂无进货记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        title="进货入库"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              取消
            </button>
            <button className="btn-primary" onClick={submit}>
              确认入库
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">药品</label>
            {picked ? (
              <div className="input flex justify-between items-center">
                <span className="font-medium">{picked.name}</span>
                <button className="text-brand text-[0.85em]" onClick={() => setPicked(null)}>
                  更换
                </button>
              </div>
            ) : (
              <HerbSelect autoFocus onPick={(h) => setPicked(h)} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">进货数量（kg）</label>
              <input type="number" className="input" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div>
              <label className="label">进货单价（元/kg）</label>
              <input type="number" className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
