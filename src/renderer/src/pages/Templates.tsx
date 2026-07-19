import { useEffect, useState } from 'react'
import type { Herb, RecipeTemplate } from '../../../shared/types'
import { PageHeader } from '../components/ui'
import { Modal } from '../components/Modal'
import { HerbSelect } from '../components/HerbSelect'
import { useToast } from '../components/Toast'

interface Row {
  herb_id: number
  herb_name: string
  dose_per_unit_g: number
}

export function Templates(): JSX.Element {
  const { toast } = useToast()
  const [list, setList] = useState<RecipeTemplate[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [usage, setUsage] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [dose, setDose] = useState('')
  const [picked, setPicked] = useState<Herb | null>(null)

  const load = async (): Promise<void> => {
    const res = await window.api.templates.list()
    if (res.ok && res.data) setList(res.data)
  }
  useEffect(() => {
    load()
  }, [])

  const openNew = (): void => {
    setName('')
    setUsage('')
    setRows([])
    setPicked(null)
    setDose('')
    setOpen(true)
  }

  const addRow = (): void => {
    if (!picked) return toast('请选择药品', 'error')
    const g = parseFloat(dose)
    if (!g || g <= 0) return toast('用量无效', 'error')
    setRows((prev) => [...prev, { herb_id: picked.id, herb_name: picked.name, dose_per_unit_g: g }])
    setPicked(null)
    setDose('')
  }

  const save = async (): Promise<void> => {
    if (!name.trim()) return toast('请填写名称', 'error')
    if (rows.length === 0) return toast('请至少添加一味药', 'error')
    const res = await window.api.templates.create(
      name.trim(),
      usage,
      rows.map((r) => ({ herb_id: r.herb_id, dose_per_unit_g: r.dose_per_unit_g }))
    )
    if (res.ok) {
      toast('已保存', 'ok')
      setOpen(false)
      load()
    } else toast(res.error || '保存失败', 'error')
  }

  const remove = async (t: RecipeTemplate): Promise<void> => {
    if (!confirm(`删除常用方「${t.name}」？`)) return
    const res = await window.api.templates.remove(t.id)
    if (res.ok) {
      toast('已删除', 'ok')
      load()
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <PageHeader
        title="常用方模板"
        desc="医师自建方剂组合，划价时可整体套用到清单"
        right={
          <button className="btn-primary" onClick={openNew}>
            + 新建常用方
          </button>
        }
      />
      <div className="p-6 grid grid-cols-2 gap-4">
        {list.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex justify-between items-start">
              <div className="font-semibold text-[1.1em]">{t.name}</div>
              <button className="text-danger hover:underline text-[0.85em]" onClick={() => remove(t)}>
                删除
              </button>
            </div>
            {t.usage_method && <div className="text-muted text-[0.82em] mt-1">用法：{t.usage_method}</div>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(t.items || []).map((it, i) => (
                <span key={i} className="px-2 py-0.5 bg-surface rounded text-[0.85em]">
                  {it.herb_name} {it.dose_per_unit_g}g
                </span>
              ))}
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="text-muted col-span-2 text-center py-10">暂无常用方</div>}
      </div>

      <Modal
        open={open}
        title="新建常用方"
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
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">名称 *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：四君子汤" autoFocus />
            </div>
            <div>
              <label className="label">用法（可选）</label>
              <input className="input" value={usage} onChange={(e) => setUsage(e.target.value)} />
            </div>
          </div>

          <div className="card p-3">
            <label className="label">添加药材</label>
            <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-start">
              {picked ? (
                <div className="input flex justify-between items-center">
                  <span className="font-medium">{picked.name}</span>
                  <button className="text-brand text-[0.85em]" onClick={() => setPicked(null)}>
                    更换
                  </button>
                </div>
              ) : (
                <HerbSelect onPick={(h) => setPicked(h)} />
              )}
              <input
                type="number"
                className="input"
                placeholder="用量g"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRow()}
              />
              <button className="btn-primary" onClick={addRow}>
                添加
              </button>
            </div>
          </div>

          <table className="w-full border-collapse">
            <thead className="bg-surface">
              <tr>
                <th className="th">药名</th>
                <th className="th text-right">用量g</th>
                <th className="th w-16"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="td">{r.herb_name}</td>
                  <td className="td text-right">{r.dose_per_unit_g}</td>
                  <td className="td text-right">
                    <button
                      className="text-danger text-[0.85em]"
                      onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      移除
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="td text-center text-muted py-4" colSpan={3}>
                    尚未添加药材
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  )
}
