import { useEffect, useState } from 'react'
import type { Patient, PatientInput, Prescription } from '../../../shared/types'
import { PageHeader, money } from '../components/ui'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'

export function Patients({ onReuse }: { onReuse?: (id: number) => void }): JSX.Element {
  const { toast } = useToast()
  const [list, setList] = useState<Patient[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<PatientInput>({ name: '', gender: '', age: '', contact: '', note: '' })

  const [historyOf, setHistoryOf] = useState<Patient | null>(null)
  const [history, setHistory] = useState<Prescription[]>([])
  const [detail, setDetail] = useState<Prescription | null>(null)

  const load = async (): Promise<void> => {
    const res = await window.api.patients.list(q)
    if (res.ok && res.data) setList(res.data)
  }
  useEffect(() => {
    load()
  }, [q])

  const openNew = (): void => {
    setEditId(null)
    setForm({ name: '', gender: '', age: '', contact: '', note: '' })
    setOpen(true)
  }
  const openEdit = (p: Patient): void => {
    setEditId(p.id)
    setForm({ name: p.name, gender: p.gender, age: p.age, contact: p.contact, note: p.note })
    setOpen(true)
  }
  const save = async (): Promise<void> => {
    if (!form.name.trim()) return toast('请填写姓名', 'error')
    const res = editId ? await window.api.patients.update(editId, form) : await window.api.patients.create(form)
    if (res.ok) {
      toast('已保存', 'ok')
      setOpen(false)
      load()
    } else toast(res.error || '保存失败', 'error')
  }
  const remove = async (p: Patient): Promise<void> => {
    if (!confirm(`删除顾客「${p.name}」？历史处方会保留但解除关联。`)) return
    const res = await window.api.patients.remove(p.id)
    if (res.ok) {
      toast('已删除', 'ok')
      load()
    }
  }

  const openHistory = async (p: Patient): Promise<void> => {
    setHistoryOf(p)
    await refreshHistory(p.id)
  }
  const refreshHistory = async (patientId: number): Promise<void> => {
    const res = await window.api.prescriptions.list(patientId)
    if (res.ok && res.data) setHistory(res.data)
  }

  const reprint = async (id: number): Promise<void> => {
    const res = await window.api.dispense.print(id)
    if (res.ok && res.data?.ok) toast('已发送打印', 'ok')
    else toast('打印失败：' + (res.data?.error || res.error || ''), 'error')
  }

  const voidRx = async (rx: Prescription): Promise<void> => {
    if (!confirm(`确认作废处方 #${rx.id}？将恢复对应药品库存，记录保留但不计入营业额。`)) return
    const res = await window.api.prescriptions.void(rx.id)
    if (res.ok) {
      toast('已作废，库存已恢复', 'ok')
      if (historyOf) refreshHistory(historyOf.id)
    } else toast(res.error || '作废失败', 'error')
  }

  const viewDetail = async (id: number): Promise<void> => {
    const res = await window.api.prescriptions.get(id)
    if (res.ok && res.data) setDetail(res.data)
  }

  return (
    <div className="min-h-full flex flex-col">
      <PageHeader
        title="顾客档案"
        desc="顾客建档与历史处方查看"
        right={
          <>
            <input
              className="input w-56"
              placeholder="搜索姓名 / 联系方式"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn-primary" onClick={openNew}>
              + 新增顾客
            </button>
          </>
        }
      />
      <div className="p-6">
        <div className="card overflow-hidden">
          <table className="w-full border-collapse">
            <thead className="bg-surface">
              <tr>
                <th className="th">姓名</th>
                <th className="th">性别</th>
                <th className="th">年龄</th>
                <th className="th">联系方式</th>
                <th className="th">备注</th>
                <th className="th">建档时间</th>
                <th className="th w-40"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="td font-medium">{p.name}</td>
                  <td className="td text-muted">{p.gender || '—'}</td>
                  <td className="td text-muted">{p.age || '—'}</td>
                  <td className="td text-muted">{p.contact || '—'}</td>
                  <td className="td text-muted">{p.note || '—'}</td>
                  <td className="td text-muted text-[0.85em]">{p.created_at}</td>
                  <td className="td text-right whitespace-nowrap">
                    <button className="text-brand hover:underline text-[0.85em] mr-2" onClick={() => openHistory(p)}>
                      历史方
                    </button>
                    <button className="text-brand hover:underline text-[0.85em] mr-2" onClick={() => openEdit(p)}>
                      编辑
                    </button>
                    <button className="text-danger hover:underline text-[0.85em]" onClick={() => remove(p)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td className="td text-center text-muted py-8" colSpan={7}>
                    暂无顾客
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 编辑/新增 */}
      <Modal
        open={open}
        title={editId ? '编辑顾客' : '新增顾客'}
        onClose={() => setOpen(false)}
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
        <div className="space-y-3">
          <div className="grid grid-cols-[1.5fr_1fr_1fr] gap-3">
            <div>
              <label className="label">姓名 *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="label">性别</label>
              <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">—</option>
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>
            <div>
              <label className="label">年龄</label>
              <input className="input" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">联系方式</label>
            <input className="input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </div>
          <div>
            <label className="label">备注</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* 历史处方 */}
      <Modal
        open={!!historyOf}
        title={`${historyOf?.name || ''} 的历史处方`}
        onClose={() => setHistoryOf(null)}
        width="max-w-2xl"
      >
        {history.length === 0 ? (
          <p className="text-muted">暂无处方记录</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className={`card p-3 flex justify-between items-center ${
                  h.status === 'voided' ? 'opacity-55' : ''
                }`}
              >
                <div>
                  <div className="font-medium">
                    处方 #{h.id} · {money(h.total_price)} · {h.doses_count}付
                    {h.status === 'voided' && (
                      <span className="ml-2 text-danger text-[0.75em] border border-danger rounded px-1">
                        已作废
                      </span>
                    )}
                  </div>
                  <div className="text-muted text-[0.8em]">{h.created_at}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button className="btn-ghost btn-sm" onClick={() => viewDetail(h.id)}>
                    明细
                  </button>
                  {onReuse && h.status !== 'voided' && (
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        setHistoryOf(null)
                        onReuse(h.id)
                      }}
                    >
                      调取复用
                    </button>
                  )}
                  {h.status !== 'voided' && (
                    <button className="btn-ghost btn-sm" onClick={() => reprint(h.id)}>
                      补打
                    </button>
                  )}
                  {h.status !== 'voided' && (
                    <button className="text-danger hover:underline text-[0.82em] px-1" onClick={() => voidRx(h)}>
                      作废
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* 处方明细 */}
      <Modal open={!!detail} title={`处方 #${detail?.id} 明细`} onClose={() => setDetail(null)}>
        {detail && (
          <div>
            <div className="text-muted text-[0.85em] mb-2">
              {detail.created_at} · {detail.doses_count}付 · 医师：{detail.doctor_name || '—'}
              {detail.patient_gender ? ` · ${detail.patient_gender}` : ''}
              {detail.patient_age ? ` · ${detail.patient_age}岁` : ''}
            </div>
            <table className="w-full border-collapse">
              <thead className="bg-surface">
                <tr>
                  <th className="th">药名</th>
                  <th className="th text-right">单付(g)</th>
                  <th className="th text-right">小计</th>
                </tr>
              </thead>
              <tbody>
                {(detail.items || []).map((it, i) => (
                  <tr key={i}>
                    <td className="td">{it.herb_name}</td>
                    <td className="td text-right">{it.dose_per_unit_g}</td>
                    <td className="td text-right">{money(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-right text-[0.9em] space-y-0.5">
              <div>药费：{money(detail.herb_total)}</div>
              {detail.acupuncture_fee > 0 && <div>针灸费：{money(detail.acupuncture_fee)}</div>}
              {detail.other_fee > 0 && <div>其它费：{money(detail.other_fee)}</div>}
              <div className="font-semibold text-[1.1em]">
                总价：<span className="text-brand">{money(detail.total_price)}</span>
              </div>
            </div>
            {detail.note && <div className="text-muted text-[0.85em] mt-2">注解：{detail.note}</div>}
          </div>
        )}
      </Modal>
    </div>
  )
}
