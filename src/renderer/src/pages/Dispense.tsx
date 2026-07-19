import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Herb, RecipeTemplate, Prescription, Patient } from '../../../shared/types'
import { PageHeader, money } from '../components/ui'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'

interface StagedItem {
  herb_id: number
  herb_name: string
  dose_per_unit_g: number
  unit_price_snapshot: number
}

interface QuoteRow {
  herb_id: number
  herb_name: string
  dose_per_unit_g: number
  subtotal: number
  total_g: number
  stock_short: boolean
}

interface QuoteState {
  rows: QuoteRow[]
  herbTotal: number
  total: number
}

export function Dispense({
  preloadId,
  onPreloadConsumed
}: {
  preloadId?: number | null
  onPreloadConsumed?: () => void
}): JSX.Element {
  const { toast } = useToast()

  // 处方级字段（整张处方共用，只填一次）
  const [patientId, setPatientId] = useState<number | null>(null)
  const [patientName, setPatientName] = useState('')
  const [gender, setGender] = useState('')
  const [age, setAge] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [doses, setDoses] = useState(1)
  const [usage, setUsage] = useState('')
  const [note, setNote] = useState('')
  const [acupFee, setAcupFee] = useState('') // 针灸费
  const [otherFee, setOtherFee] = useState('') // 其它费

  // 顾客选择（可选已有档案，自动带出性别/年龄）
  const [patientMatches, setPatientMatches] = useState<Patient[]>([])
  const [showPatientDrop, setShowPatientDrop] = useState(false)
  const suppressPatientSearch = useRef(false)

  // 暂存清单（询价）
  const [items, setItems] = useState<StagedItem[]>([])
  const [quote, setQuote] = useState<QuoteState>({ rows: [], herbTotal: 0, total: 0 })

  // 顺序录入状态
  const [stage, setStage] = useState<'name' | 'dose'>('name')
  const [nameQuery, setNameQuery] = useState('')
  const [candidates, setCandidates] = useState<Herb[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [pickedHerb, setPickedHerb] = useState<Herb | null>(null)
  const [doseValue, setDoseValue] = useState('')

  // 行编辑
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editDose, setEditDose] = useState('')

  // 弹窗
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<RecipeTemplate[]>([])
  const [showSaveTpl, setShowSaveTpl] = useState(false)
  const [tplName, setTplName] = useState('')
  const [lastPrescription, setLastPrescription] = useState<Prescription | null>(null)
  const [showDone, setShowDone] = useState(false)
  // 结算弹窗（小票预览 + 打印并划价 / 仅划价 / 返回修改）
  const [showCheckout, setShowCheckout] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')

  const nameRef = useRef<HTMLInputElement>(null)
  const doseRef = useRef<HTMLInputElement>(null)
  const editRef = useRef<HTMLInputElement>(null)

  // 候选搜索：仅在输入了内容时才搜索/弹出，空框不铺开列表（避免遮挡清单）
  useEffect(() => {
    let cancelled = false
    if (stage !== 'name' || nameQuery.trim() === '') {
      setCandidates([])
      return
    }
    window.api.herbs.search(nameQuery).then((res) => {
      if (!cancelled && res.ok && res.data) {
        setCandidates(res.data)
        setActiveIdx(0)
      }
    })
    return () => {
      cancelled = true
    }
  }, [nameQuery, stage])

  // 实时询价
  const buildPayload = useCallback(
    () => ({
      patient_id: patientId,
      patient_name: patientName,
      patient_gender: gender,
      patient_age: age,
      doctor_name: doctorName,
      note,
      doses_count: doses,
      usage_method: usage,
      acupuncture_fee: Math.max(0, parseFloat(acupFee) || 0),
      other_fee: Math.max(0, parseFloat(otherFee) || 0),
      items: items.map((i) => ({ herb_id: i.herb_id, dose_per_unit_g: i.dose_per_unit_g }))
    }),
    [items, doses, patientId, patientName, gender, age, doctorName, note, usage, acupFee, otherFee]
  )

  // 询价：只依赖影响价格的字段（药材/付数/费用），并做轻量防抖，
  // 避免在顾客姓名/医师/注解里打字时触发无谓的后端计算
  const recompute = useCallback(async () => {
    const acup = Math.max(0, parseFloat(acupFee) || 0)
    const other = Math.max(0, parseFloat(otherFee) || 0)
    if (items.length === 0) {
      setQuote({ rows: [], herbTotal: 0, total: acup + other })
      return
    }
    const res = await window.api.dispense.quote({
      patient_id: null,
      patient_name: '',
      patient_gender: '',
      patient_age: '',
      doctor_name: '',
      note: '',
      doses_count: doses,
      usage_method: '',
      acupuncture_fee: acup,
      other_fee: other,
      items: items.map((i) => ({ herb_id: i.herb_id, dose_per_unit_g: i.dose_per_unit_g }))
    })
    if (res.ok && res.data) {
      setQuote({
        rows: res.data.items.map((it) => ({
          herb_id: it.herb_id,
          herb_name: it.herb_name,
          dose_per_unit_g: it.dose_per_unit_g,
          subtotal: it.subtotal,
          total_g: it.total_g,
          stock_short: it.stock_short
        })),
        herbTotal: res.data.herb_total,
        total: res.data.total
      })
    }
  }, [items, doses, acupFee, otherFee])

  useEffect(() => {
    const t = setTimeout(recompute, 120)
    return () => clearTimeout(t)
  }, [recompute])

  useEffect(() => {
    if (editIdx !== null) editRef.current?.focus()
  }, [editIdx])

  // 顾客姓名输入时搜索已有档案
  useEffect(() => {
    if (suppressPatientSearch.current) {
      suppressPatientSearch.current = false
      return
    }
    if (!showPatientDrop || patientName.trim() === '') {
      setPatientMatches([])
      return
    }
    let cancelled = false
    window.api.patients.list(patientName.trim()).then((res) => {
      if (!cancelled && res.ok && res.data) setPatientMatches(res.data.slice(0, 8))
    })
    return () => {
      cancelled = true
    }
  }, [patientName, showPatientDrop])

  const pickPatient = (p: Patient): void => {
    suppressPatientSearch.current = true
    setPatientId(p.id)
    setPatientName(p.name)
    setGender(p.gender || '')
    setAge(p.age || '')
    setShowPatientDrop(false)
    setPatientMatches([])
  }

  // ---- 复诊：调取历史方到划价页 ----
  useEffect(() => {
    if (!preloadId) return
    let cancelled = false
    window.api.prescriptions.get(preloadId).then((res) => {
      if (cancelled || !res.ok || !res.data) return
      const p = res.data
      setPatientId(p.patient_id)
      setPatientName(p.patient_name || '')
      setGender(p.patient_gender || '')
      setAge(p.patient_age || '')
      setDoctorName(p.doctor_name || '')
      setDoses(p.doses_count || 1)
      setUsage(p.usage_method || '')
      setNote(p.note || '')
      setAcupFee(p.acupuncture_fee ? String(p.acupuncture_fee) : '')
      setOtherFee(p.other_fee ? String(p.other_fee) : '')
      // 用量沿用历史，单价按当前药价重新计算（quote 以当前库存价为准）
      setItems(
        (p.items || []).map((it) => ({
          herb_id: it.herb_id,
          herb_name: it.herb_name || '',
          dose_per_unit_g: it.dose_per_unit_g,
          unit_price_snapshot: it.unit_price_snapshot
        }))
      )
      toast(`已调取处方 #${p.id} 到划价页，可修改后重新划价`, 'ok')
      onPreloadConsumed?.()
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadId])

  // ---- 顺序录入核心 ----
  const confirmName = (herb: Herb): void => {
    setPickedHerb(herb)
    setStage('dose')
    setNameQuery('')
    setCandidates([])
    setDoseValue('')
    setTimeout(() => doseRef.current?.focus(), 0)
  }

  const onNameKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((a) => Math.min(a + 1, candidates.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (candidates[activeIdx]) confirmName(candidates[activeIdx])
    }
  }

  const appendItem = (): void => {
    if (!pickedHerb) return
    const g = parseFloat(doseValue)
    if (!g || g <= 0) {
      toast('请输入有效的单付用量（克）', 'error')
      return
    }
    setItems((prev) => [
      ...prev,
      {
        herb_id: pickedHerb.id,
        herb_name: pickedHerb.name,
        dose_per_unit_g: g,
        unit_price_snapshot: pickedHerb.retail_price
      }
    ])
    // 清空并把焦点交还药名框，可直接录入下一味
    setPickedHerb(null)
    setStage('name')
    setDoseValue('')
    setNameQuery('')
    setTimeout(() => nameRef.current?.focus(), 0)
  }

  const onDoseKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      appendItem()
    } else if (e.key === 'Escape') {
      // 放弃当前药名，回到药名录入
      e.preventDefault()
      setPickedHerb(null)
      setStage('name')
      setTimeout(() => nameRef.current?.focus(), 0)
    }
  }

  const removeItem = (idx: number): void => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const startEdit = (idx: number): void => {
    setEditIdx(idx)
    setEditDose(String(items[idx].dose_per_unit_g))
  }

  const saveEdit = (): void => {
    if (editIdx === null) return
    const g = parseFloat(editDose)
    if (!g || g <= 0) {
      toast('用量无效', 'error')
      return
    }
    setItems((prev) => prev.map((it, i) => (i === editIdx ? { ...it, dose_per_unit_g: g } : it)))
    setEditIdx(null)
  }

  const clearAll = (): void => {
    setItems([])
    setPatientId(null)
    setPatientName('')
    setGender('')
    setAge('')
    setDoctorName('')
    setUsage('')
    setNote('')
    setDoses(1)
    setAcupFee('')
    setOtherFee('')
    setStage('name')
    setPickedHerb(null)
    setTimeout(() => nameRef.current?.focus(), 0)
  }

  // ---- 结算 ----
  // 点“确认划价·去结算”：校验后拉取小票预览并打开结算弹窗
  const openCheckout = async (): Promise<void> => {
    const fees = (parseFloat(acupFee) || 0) + (parseFloat(otherFee) || 0)
    if (items.length === 0 && fees <= 0)
      return toast('清单为空，且未填写针灸/其它费用', 'error')
    const res = await window.api.dispense.previewHtml(buildPayload())
    setPreviewHtml(res.ok && res.data ? res.data : '')
    setShowCheckout(true)
  }

  const confirmDispense = async (print: boolean): Promise<void> => {
    setShowCheckout(false)
    const res = await window.api.dispense.confirm(buildPayload())
    if (!res.ok || !res.data) return toast(res.error || '划价失败', 'error')
    const pres = res.data
    setLastPrescription(pres)
    toast('划价完成，库存已扣减', 'ok')
    if (print) {
      const pr = await window.api.dispense.print(pres.id)
      if (pr.ok && pr.data?.ok) toast('已发送打印', 'ok')
      else toast('打印失败：' + (pr.data?.error || pr.error || '未知'), 'error')
    }
    setShowDone(true)
  }

  const finishAndClear = (): void => {
    setShowDone(false)
    clearAll()
  }

  // ---- 常用方 ----
  const openTemplates = async (): Promise<void> => {
    const res = await window.api.templates.list()
    if (res.ok && res.data) setTemplates(res.data)
    setShowTemplates(true)
  }

  const applyTemplate = async (t: RecipeTemplate): Promise<void> => {
    // 需要药品当前价格，逐个取
    const herbsRes = await window.api.herbs.list(false)
    const herbMap = new Map<number, Herb>()
    if (herbsRes.ok && herbsRes.data) herbsRes.data.forEach((h) => herbMap.set(h.id, h))
    const newItems: StagedItem[] = (t.items || [])
      .filter((it) => herbMap.has(it.herb_id))
      .map((it) => {
        const h = herbMap.get(it.herb_id)!
        return {
          herb_id: it.herb_id,
          herb_name: h.name,
          dose_per_unit_g: it.dose_per_unit_g,
          unit_price_snapshot: h.retail_price
        }
      })
    setItems((prev) => [...prev, ...newItems])
    if (t.usage_method) setUsage(t.usage_method)
    setShowTemplates(false)
    const dropped = (t.items || []).length - newItems.length
    if (dropped > 0)
      toast(`已套用「${t.name}」，但有 ${dropped} 味药已停用/删除被跳过`, 'error')
    else toast(`已套用「${t.name}」`, 'ok')
  }

  const saveTemplate = async (): Promise<void> => {
    if (!tplName.trim()) return toast('请填写常用方名称', 'error')
    if (items.length === 0) return toast('清单为空', 'error')
    const res = await window.api.templates.create(
      tplName.trim(),
      usage,
      items.map((i) => ({ herb_id: i.herb_id, dose_per_unit_g: i.dose_per_unit_g }))
    )
    if (res.ok) {
      toast('已存为常用方', 'ok')
      setShowSaveTpl(false)
      setTplName('')
    } else toast(res.error || '保存失败', 'error')
  }

  const hasShort = useMemo(() => quote.rows.some((r) => r.stock_short), [quote])

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="开方划价"
        desc="顺序录入：药名 → 回车 → 单付用量 → 回车，自动追加。付数为整张处方统一设置。"
        right={
          <>
            <button className="btn-ghost btn-sm" onClick={openTemplates}>
              套用常用方
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setShowSaveTpl(true)}>
              存为常用方
            </button>
            <button className="btn-ghost btn-sm" onClick={clearAll}>
              清空
            </button>
          </>
        }
      />

      <div className="flex-1 grid grid-cols-[minmax(0,1fr)_400px] gap-4 p-6 min-h-0">
        {/* 左栏：药方单（展示 + 底部汇总） */}
        <div className="flex flex-col gap-4 min-h-0">
          <div className="card overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="px-4 py-2 bg-surface font-semibold text-[0.9em] text-muted flex justify-between items-center shrink-0">
              <span>药方单 · 询价中（未扣库存）</span>
              <span>
                {quote.rows.length} 味 · {doses} 付
              </span>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full border-collapse">
                <thead className="bg-surface sticky top-0">
                  <tr>
                    <th className="th w-10">#</th>
                    <th className="th">药名</th>
                    <th className="th text-right">单付(g)</th>
                    <th className="th text-right">共重(g)</th>
                    <th className="th text-right">小计</th>
                    <th className="th w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {quote.rows.length === 0 && (
                    <tr>
                      <td className="td text-center text-muted py-10" colSpan={6}>
                        暂无药材，请在右侧录入台录入
                      </td>
                    </tr>
                  )}
                  {quote.rows.map((r, idx) => (
                    <tr
                      key={idx}
                      className={`${r.stock_short ? 'bg-danger/5' : ''} hover:bg-surface cursor-pointer`}
                      onClick={() => editIdx === null && startEdit(idx)}
                    >
                      <td className="td text-muted">{idx + 1}</td>
                      <td className="td font-medium">
                        {r.herb_name}
                        {r.stock_short && (
                          <span className="ml-2 text-danger text-[0.75em]">⚠ 库存不足</span>
                        )}
                      </td>
                      <td className="td text-right" onClick={(e) => e.stopPropagation()}>
                        {editIdx === idx ? (
                          <input
                            ref={editRef}
                            className="input py-1 w-20 text-right inline-block"
                            value={editDose}
                            onChange={(e) => setEditDose(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit()
                              if (e.key === 'Escape') setEditIdx(null)
                            }}
                          />
                        ) : (
                          r.dose_per_unit_g
                        )}
                      </td>
                      <td className="td text-right text-muted">{r.total_g}</td>
                      <td className="td text-right font-medium">{money(r.subtotal)}</td>
                      <td className="td text-right" onClick={(e) => e.stopPropagation()}>
                        {editIdx === idx ? (
                          <button className="btn-primary btn-sm" onClick={saveEdit}>
                            保存
                          </button>
                        ) : (
                          <button
                            className="text-danger hover:underline text-[0.85em]"
                            onClick={() => removeItem(idx)}
                          >
                            删除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 底部实时汇总 */}
          <div className="card p-4 shrink-0">
            {hasShort && (
              <div className="mb-3 text-danger text-[0.82em] bg-danger/5 rounded p-2">
                ⚠ 有药材库存不足，可继续划价（允许负库存）
              </div>
            )}
            <div className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end">
              <div>
                <div className="text-muted text-[0.8em]">
                  药费 · 单价 {money(quote.herbTotal / (doses || 1))}/付
                </div>
                <div className="text-[1.15em] font-semibold">{money(quote.herbTotal)}</div>
              </div>
              <div>
                <div className="text-muted text-[0.8em]">针灸 + 其它</div>
                <div className="text-[1.15em] font-semibold">
                  {money((parseFloat(acupFee) || 0) + (parseFloat(otherFee) || 0))}
                </div>
              </div>
              <div className="text-right">
                <div className="text-muted text-[0.8em]">总价</div>
                <div className="text-brand font-bold text-[2em] leading-none">{money(quote.total)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 右栏：操作台（录入 + 付数 + 信息 + 结算） */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="flex-1 overflow-auto flex flex-col gap-3 min-h-0 pr-1">
          {/* 录入区 */}
          <div className="card p-4">
            <div className="text-brand font-semibold text-[0.9em] mb-2">录入台 · 全程键盘</div>
            <div className="relative mb-3">
              <label className="label">
                {stage === 'name' ? '① 药名（拼音简码 / 全拼 / 汉字）' : '① 药名'}
              </label>
              {stage === 'name' ? (
                <input
                  ref={nameRef}
                  className="input text-[1.15em]"
                  placeholder="如输入 dg → 当归，回车确认"
                  value={nameQuery}
                  autoFocus
                  onChange={(e) => setNameQuery(e.target.value)}
                  onKeyDown={onNameKey}
                />
              ) : (
                <div className="input flex items-center bg-brand/5 text-brand font-semibold text-[1.15em]">
                  {pickedHerb?.name}
                  <span className="ml-2 text-muted text-[0.65em] font-normal">
                    回车确认用量 · Esc 重选
                  </span>
                </div>
              )}
              {stage === 'name' && candidates.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 card shadow-xl max-h-72 overflow-auto">
                  {candidates.map((h, i) => (
                    <div
                      key={h.id}
                      onMouseDown={() => confirmName(h)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`px-3 py-2 cursor-pointer flex justify-between items-center ${
                        i === activeIdx ? 'bg-brand/10 text-brand' : 'hover:bg-surface'
                      }`}
                    >
                      <span>
                        <span className="font-medium text-[1.05em]">{h.name}</span>
                        <span className="text-muted text-[0.8em] ml-2">{h.pinyin_code}</span>
                      </span>
                      <span
                        className={`text-[0.8em] ${h.stock_qty <= 0 ? 'text-danger' : 'text-muted'}`}
                      >
                        库存 {h.stock_qty}kg · ￥{h.retail_price}/kg
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">② 单付用量（g）</label>
                <input
                  ref={doseRef}
                  className="input text-[1.15em]"
                  placeholder="克数，回车追加"
                  value={doseValue}
                  disabled={stage !== 'dose'}
                  onChange={(e) => setDoseValue(e.target.value)}
                  onKeyDown={onDoseKey}
                />
              </div>
              <div>
                <label className="label font-semibold text-brand">付数（贴数）· 全局</label>
                <input
                  type="number"
                  min={1}
                  className="input font-semibold text-[1.15em]"
                  value={doses}
                  onChange={(e) => setDoses(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
            </div>
            <p className="text-muted text-[0.75em] mt-2">
              药名回车 → 光标跳到用量 → 回车追加到左侧药方、焦点回药名框，连录下一味。
            </p>
          </div>

          {/* 顾客信息 */}
          <div className="card p-4">
            <div className="text-muted text-[0.85em] mb-2">顾客信息（可留空/散客）</div>
            <div className="relative mb-3">
              <label className="label">姓名（输入可匹配已有档案）</label>
              <input
                className="input"
                value={patientName}
                placeholder="散客可留空；输入可匹配档案"
                onChange={(e) => {
                  setPatientName(e.target.value)
                  setPatientId(null)
                  setShowPatientDrop(true)
                }}
                onFocus={() => setShowPatientDrop(true)}
                onBlur={() => setTimeout(() => setShowPatientDrop(false), 150)}
              />
              {patientId && (
                <span className="absolute right-2 top-[30px] text-ok text-[0.7em]">✓已关联档案</span>
              )}
              {showPatientDrop && patientMatches.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 card shadow-xl max-h-56 overflow-auto">
                  {patientMatches.map((p) => (
                    <div
                      key={p.id}
                      onMouseDown={() => pickPatient(p)}
                      className="px-3 py-2 cursor-pointer hover:bg-surface flex justify-between"
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted text-[0.8em]">
                        {[p.gender, p.age && `${p.age}岁`, p.contact].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">性别</label>
                <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">—</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>
              <div>
                <label className="label">年龄</label>
                <input className="input" value={age} onChange={(e) => setAge(e.target.value)} placeholder="如 35" />
              </div>
              <div>
                <label className="label">医师</label>
                <input className="input" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
              </div>
            </div>
          </div>

          {/* 费用与说明 */}
          <div className="card p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">针灸费（元）</label>
                <input
                  type="number"
                  className="input"
                  value={acupFee}
                  onChange={(e) => setAcupFee(e.target.value)}
                  placeholder="无则留空"
                />
              </div>
              <div>
                <label className="label">其它费（元）</label>
                <input
                  type="number"
                  className="input"
                  value={otherFee}
                  onChange={(e) => setOtherFee(e.target.value)}
                  placeholder="无则留空"
                />
              </div>
            </div>
            <div>
              <label className="label">用法（煎服说明）</label>
              <input className="input" value={usage} onChange={(e) => setUsage(e.target.value)} placeholder="如：水煎服，日一剂" />
            </div>
            <div>
              <label className="label">处方注解</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
            </div>
          </div>
          </div>

          {/* 确认 · 去结算（固定在右栏底部，始终可见） */}
          <button
            className="btn-primary w-full text-[1.15em] py-3 shrink-0"
            onClick={openCheckout}
          >
            确认划价 · 去结算 →
          </button>
          <p className="text-muted text-[0.75em] text-center leading-relaxed">
            确认后弹出结算：可预览小票、打印并划价或仅划价。扣库存后可到「顾客档案 / 报表」作废恢复。
          </p>
        </div>
      </div>

      {/* 结算（小票预览 + 打印并划价 / 仅划价 / 返回修改） */}
      <Modal
        open={showCheckout}
        title="确认划价 · 结算"
        onClose={() => setShowCheckout(false)}
        width="max-w-3xl"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setShowCheckout(false)}>
              返回修改
            </button>
            <button className="btn-accent" onClick={() => confirmDispense(false)}>
              仅划价（不打印）
            </button>
            <button className="btn-primary" onClick={() => confirmDispense(true)}>
              打印并划价
            </button>
          </>
        }
      >
        <div className="grid grid-cols-[1fr_auto] gap-5">
          <div className="space-y-2">
            <div className="text-[1.1em]">
              顾客：<span className="font-medium">{patientName || '散客'}</span>
              {gender ? ` · ${gender}` : ''}
              {age ? ` · ${age}岁` : ''}
            </div>
            <div>
              药材 <span className="font-medium">{quote.rows.length}</span> 味 ·{' '}
              <span className="font-medium">{doses}</span> 付
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-muted">总价</span>
              <span className="text-brand font-bold text-[1.8em] leading-none">{money(quote.total)}</span>
            </div>
            <div className="text-muted text-[0.85em] mt-1">
              药费 {money(quote.herbTotal)}
              {(parseFloat(acupFee) || 0) > 0 && ` · 针灸 ${money(parseFloat(acupFee) || 0)}`}
              {(parseFloat(otherFee) || 0) > 0 && ` · 其它 ${money(parseFloat(otherFee) || 0)}`}
            </div>
            <div className="text-muted text-[0.82em] bg-surface rounded p-2 mt-2">
              确认后将生成处方记录并<strong>扣减库存</strong>。划错可到「顾客档案 / 报表」作废恢复库存。
            </div>
          </div>
          <div>
            <div className="text-muted text-[0.78em] mb-1 text-center">小票预览</div>
            <div className="bg-surface p-2 rounded">
              <iframe
                title="receipt-preview"
                srcDoc={previewHtml}
                className="bg-white border border-line"
                style={{ width: 300, height: 440 }}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* 常用方选择 */}
      <Modal open={showTemplates} title="套用常用方" onClose={() => setShowTemplates(false)}>
        {templates.length === 0 ? (
          <p className="text-muted">暂无常用方，可在录入后点击「存为常用方」创建。</p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="card p-3 flex justify-between items-center hover:bg-surface cursor-pointer"
                onClick={() => applyTemplate(t)}
              >
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-muted text-[0.8em]">
                    {(t.items || []).map((i) => `${i.herb_name}${i.dose_per_unit_g}g`).join('、')}
                  </div>
                </div>
                <button className="btn-primary btn-sm">套用</button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* 存为常用方 */}
      <Modal
        open={showSaveTpl}
        title="存为常用方"
        onClose={() => setShowSaveTpl(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setShowSaveTpl(false)}>
              取消
            </button>
            <button className="btn-primary" onClick={saveTemplate}>
              保存
            </button>
          </>
        }
      >
        <label className="label">常用方名称</label>
        <input
          className="input"
          value={tplName}
          onChange={(e) => setTplName(e.target.value)}
          placeholder="如：四君子汤"
          autoFocus
        />
        <div className="mt-3 text-muted text-[0.85em]">
          将保存当前 {items.length} 味药及用量组合（不含顾客与价格）。
        </div>
      </Modal>

      {/* 划价完成 */}
      <Modal
        open={showDone}
        title="划价完成"
        onClose={finishAndClear}
        footer={
          <>
            <button
              className="btn-ghost"
              onClick={async () => {
                if (lastPrescription) {
                  const pr = await window.api.dispense.print(lastPrescription.id)
                  if (pr.ok && pr.data?.ok) toast('已发送打印', 'ok')
                  else toast('打印失败', 'error')
                }
              }}
            >
              重新打印小票
            </button>
            <button className="btn-primary" onClick={finishAndClear}>
              新开一张
            </button>
          </>
        }
      >
        {lastPrescription && (
          <div className="space-y-1">
            <div className="text-[1.1em]">
              处方 #{lastPrescription.id} 已生成，合计{' '}
              <span className="text-brand font-bold">{money(lastPrescription.total_price)}</span>
            </div>
            <div className="text-muted text-[0.9em]">
              顾客：{lastPrescription.patient_name || '散客'} · {lastPrescription.doses_count} 付 · 库存已扣减
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
