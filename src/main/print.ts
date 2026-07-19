import { BrowserWindow } from 'electron'
import { getSettings, getPrescription, dailySequence, quote } from './services'
import type { Prescription, DispensePayload } from '../shared/types'

function esc(s: string): string {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)
}

function pad4(n: number): string {
  return String(n).padStart(4, '0')
}

// 日期精确到分钟
function fmtMinute(s: string): string {
  return (s || '').slice(0, 16)
}

function buildReceiptHtml(prescriptionId: number, mode: '58mm' | 'a5'): string {
  const p = getPrescription(prescriptionId)
  if (!p) return '<html><body>处方不存在</body></html>'
  const seq = dailySequence(prescriptionId)
  return renderReceipt(p, mode, seq)
}

// 从处方对象渲染小票（供正式打印与预览共用）
function renderReceipt(p: Prescription, mode: '58mm' | 'a5', noSeq: number): string {
  const settings = getSettings()
  const width = mode === '58mm' ? '58mm' : '148mm'
  const fontSize = mode === '58mm' ? '12px' : '14px'
  const doses = p.doses_count || 1
  const perDose = (p.herb_total || 0) / doses // 单价 = 每付药费

  // 药材双列排布
  const items = p.items || []
  let herbRows = ''
  for (let i = 0; i < items.length; i += 2) {
    const left = items[i]
    const right = items[i + 1]
    const cell = (it?: (typeof items)[number]): string =>
      it ? `<span class="hb">${esc(it.herb_name || '')}</span> ${it.dose_per_unit_g}g` : ''
    herbRows += `<div class="hrow"><div class="hcell">${cell(left)}</div><div class="hcell">${cell(
      right
    )}</div></div>`
  }

  // 费用双列区（去掉诊金/非饮片，只保留针灸/其它）
  const feeGrid = `
    <div class="frow"><div class="fcell">单价:${perDose.toFixed(2)}元</div><div class="fcell">针灸:${(
      p.acupuncture_fee || 0
    ).toFixed(2)}元</div></div>
    <div class="frow"><div class="fcell">贴数:${doses}贴</div><div class="fcell">其它:${(
      p.other_fee || 0
    ).toFixed(2)}元</div></div>
    <div class="frow"><div class="fcell total">总价:${p.total_price.toFixed(2)}元</div><div class="fcell">医师:${esc(
      p.doctor_name || ''
    )}</div></div>`

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  @page { size: ${mode === '58mm' ? '58mm auto' : 'A5'}; margin: ${mode === '58mm' ? '2mm' : '10mm'}; }
  * { box-sizing: border-box; }
  body { width: ${width}; margin: 0 auto; font-family: "SimSun","宋体",monospace; font-size: ${fontSize}; color:#000; line-height:1.5; }
  .center { text-align:center; }
  .title { font-size: ${mode === '58mm' ? '17px' : '20px'}; font-weight:bold; margin: 4px 0 6px; letter-spacing:2px; }
  .hr { border-top: 1px dashed #000; margin: 5px 0; }
  .meta { margin: 1px 0; }
  .cols { display:flex; gap:8px; }
  .cols > span { white-space:nowrap; }
  .hrow, .frow { display:flex; }
  .hcell, .fcell { flex:1; padding: 2px 0; }
  .hb { font-weight:bold; }
  .total { font-weight:bold; }
  .thanks { margin-top: 6px; }
  .usage { margin-top:4px; }
</style></head>
<body>
  <div class="center title">${esc(settings.clinic_name)}</div>
  <div class="cols"><span>NO: ${pad4(noSeq)}</span><span>日期: ${esc(fmtMinute(p.created_at))}</span></div>
  <div class="cols">
    <span>姓名: ${esc(p.patient_name || '散客')}</span>
    <span>性别: ${esc(p.patient_gender || '')}</span>
    <span>年龄: ${esc(p.patient_age || '')}</span>
  </div>
  <div class="hr"></div>
  ${herbRows || '<div class="center">（无药材）</div>'}
  <div class="hr"></div>
  ${feeGrid}
  ${p.usage_method ? `<div class="usage">用法: ${esc(p.usage_method)}</div>` : ''}
  ${p.note ? `<div class="meta">备注: ${esc(p.note)}</div>` : ''}
  <div class="hr"></div>
  <div class="center thanks">谢谢惠顾</div>
</body></html>`
}

// 预览：从当前草稿（暂存清单）生成小票 HTML，不落库，供“打印前预览”
export function previewDraftHtml(payload: DispensePayload): string {
  const settings = getSettings()
  // 复用 services.quote 计算药材小计与合计
  const q = quote(payload)
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const created = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`
  const pres: Prescription = {
    id: 0,
    patient_id: payload.patient_id,
    patient_name: payload.patient_name || '散客',
    patient_gender: payload.patient_gender || '',
    patient_age: payload.patient_age || '',
    doctor_name: payload.doctor_name || '',
    note: payload.note || '',
    doses_count: payload.doses_count || 1,
    usage_method: payload.usage_method || '',
    acupuncture_fee: q.acupuncture_fee,
    other_fee: q.other_fee,
    herb_total: q.herb_total,
    total_price: q.total,
    status: 'draft',
    created_at: created,
    items: q.items.map((it) => ({
      herb_id: it.herb_id,
      herb_name: it.herb_name,
      dose_per_unit_g: it.dose_per_unit_g,
      unit_price_snapshot: it.unit_price_snapshot,
      subtotal: it.subtotal
    }))
  }
  return renderReceipt(pres, settings.printer_mode, 0)
}

export async function printReceipt(
  prescriptionId: number
): Promise<{ ok: boolean; error?: string }> {
  const settings = getSettings()
  const mode = settings.printer_mode
  const html = buildReceiptHtml(prescriptionId, mode)

  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false }
  })

  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    await new Promise((r) => setTimeout(r, 250))

    return await new Promise((resolve) => {
      win.webContents.print(
        {
          silent: mode === '58mm',
          printBackground: true,
          margins: { marginType: 'none' }
        },
        (success, failureReason) => {
          if (!win.isDestroyed()) win.close()
          if (success) resolve({ ok: true })
          else resolve({ ok: false, error: failureReason })
        }
      )
    })
  } catch (e) {
    if (!win.isDestroyed()) win.close()
    return { ok: false, error: (e as Error).message }
  }
}
