import { useEffect, useState } from 'react'
import type { Herb, HerbInput } from '../../../shared/types'
import { PageHeader } from '../components/ui'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'

const empty: HerbInput = {
  name: '',
  pinyin_code: '',
  pinyin_full: '',
  spec: '',
  unit: 'kg',
  retail_price: 0,
  cost_price: 0,
  stock_qty: 0,
  stock_warning_line: 0,
  last_purchase_price: 0,
  is_disabled: 0
}

export function Herbs(): JSX.Element {
  const { toast } = useToast()
  const [list, setList] = useState<Herb[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<HerbInput>(empty)
  const [codeTouched, setCodeTouched] = useState(false) // 用户是否手动改过简码

  const load = async (): Promise<void> => {
    const res = await window.api.herbs.list(true)
    if (res.ok && res.data) setList(res.data)
  }
  useEffect(() => {
    load()
  }, [])

  const filtered = list.filter(
    (h) =>
      !q ||
      h.name.includes(q) ||
      h.pinyin_code.includes(q.toLowerCase()) ||
      h.pinyin_full.includes(q.toLowerCase())
  )

  const openNew = (): void => {
    setEditId(null)
    setForm(empty)
    setCodeTouched(false)
    setOpen(true)
  }
  const openEdit = (h: Herb): void => {
    setEditId(h.id)
    setForm({ ...h })
    setCodeTouched(true) // 编辑已有药品时，保留其现有简码，不自动覆盖
    setOpen(true)
  }

  // 药名变化时自动生成拼音简码（仅当用户未手动改过简码时）
  const onNameChange = async (name: string): Promise<void> => {
    setForm((f) => ({ ...f, name }))
    if (name.trim() && !codeTouched) {
      const res = await window.api.herbs.makePinyin(name)
      if (res.ok && res.data) {
        setForm((f) => ({ ...f, name, pinyin_code: res.data!.code, pinyin_full: res.data!.full }))
      }
    }
  }

  const save = async (): Promise<void> => {
    if (!form.name.trim()) return toast('请填写药名', 'error')
    if (form.retail_price < 0 || form.cost_price < 0)
      return toast('价格不能为负数', 'error')
    const res = editId ? await window.api.herbs.update(editId, form) : await window.api.herbs.create(form)
    if (res.ok) {
      toast('已保存', 'ok')
      setOpen(false)
      load()
    } else toast(res.error || '保存失败', 'error')
  }

  const remove = async (h: Herb): Promise<void> => {
    if (!confirm(`确认删除「${h.name}」？（若有历史处方引用将改为停用）`)) return
    const res = await window.api.herbs.remove(h.id)
    if (res.ok) {
      toast('已删除', 'ok')
      load()
    } else toast(res.error || '删除失败', 'error')
  }

  const num = (v: string): number => parseFloat(v) || 0

  return (
    <div className="min-h-full flex flex-col">
      <PageHeader
        title="药品管理"
        desc="维护药品信息、拼音简码（自动生成，可手改）、价格、库存与预警线"
        right={
          <>
            <input
              className="input w-56"
              placeholder="搜索药名 / 简码"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn-primary" onClick={openNew}>
              + 新增药品
            </button>
          </>
        }
      />
      <div className="p-6">
        <div className="card overflow-hidden">
          <table className="w-full border-collapse">
            <thead className="bg-surface">
              <tr>
                <th className="th">药名</th>
                <th className="th">简码</th>
                <th className="th">规格</th>
                <th className="th text-right">零售价/kg</th>
                <th className="th text-right">成本价/kg</th>
                <th className="th text-right">库存(kg)</th>
                <th className="th text-right">预警线</th>
                <th className="th w-28"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => {
                const low = h.stock_warning_line > 0 && h.stock_qty <= h.stock_warning_line
                return (
                  <tr key={h.id} className={h.is_disabled ? 'opacity-50' : ''}>
                    <td className="td font-medium">
                      {h.name}
                      {h.is_disabled ? <span className="text-muted text-[0.75em] ml-1">(停用)</span> : ''}
                    </td>
                    <td className="td text-muted">{h.pinyin_code}</td>
                    <td className="td text-muted">{h.spec || '—'}</td>
                    <td className="td text-right">{h.retail_price}</td>
                    <td className="td text-right text-muted">{h.cost_price}</td>
                    <td className={`td text-right ${low ? 'text-danger font-semibold' : ''}`}>
                      {h.stock_qty}
                      {low && ' ⚠'}
                    </td>
                    <td className="td text-right text-muted">{h.stock_warning_line || '—'}</td>
                    <td className="td text-right whitespace-nowrap">
                      <button className="text-brand hover:underline text-[0.85em] mr-2" onClick={() => openEdit(h)}>
                        编辑
                      </button>
                      <button className="text-danger hover:underline text-[0.85em]" onClick={() => remove(h)}>
                        删除
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="td text-center text-muted py-8" colSpan={8}>
                    暂无药品
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        title={editId ? '编辑药品' : '新增药品'}
        onClose={() => setOpen(false)}
        width="max-w-2xl"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              取消
            </button>
            <button className="btn-primary" onClick={save}>
              保存
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">药名 *</label>
            <input className="input" value={form.name} onChange={(e) => onNameChange(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">拼音简码（自动生成，可修改）</label>
            <input
              className="input"
              value={form.pinyin_code}
              onChange={(e) => {
                setCodeTouched(true)
                setForm({ ...form, pinyin_code: e.target.value })
              }}
            />
          </div>
          <div>
            <label className="label">规格</label>
            <input className="input" value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} />
          </div>
          <div>
            <label className="label">零售价（元/kg）</label>
            <input
              type="number"
              className="input"
              value={form.retail_price}
              onChange={(e) => setForm({ ...form, retail_price: num(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">成本价（元/kg）</label>
            <input
              type="number"
              className="input"
              value={form.cost_price}
              onChange={(e) => setForm({ ...form, cost_price: num(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">当前库存（kg）</label>
            <input
              type="number"
              className="input"
              value={form.stock_qty}
              onChange={(e) => setForm({ ...form, stock_qty: num(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">库存预警线（kg）</label>
            <input
              type="number"
              className="input"
              value={form.stock_warning_line}
              onChange={(e) => setForm({ ...form, stock_warning_line: num(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">最近进货价</label>
            <input
              type="number"
              className="input"
              value={form.last_purchase_price}
              onChange={(e) => setForm({ ...form, last_purchase_price: num(e.target.value) })}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.is_disabled}
                onChange={(e) => setForm({ ...form, is_disabled: e.target.checked ? 1 : 0 })}
              />
              <span>停用（不在划价中出现）</span>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
