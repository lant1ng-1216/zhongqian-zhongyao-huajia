import { BrowserWindow, app } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { getSettings, getPrescription, dailySequence, quote } from './services'
import type { Prescription, DispensePayload, PrinterInfo } from '../shared/types'

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

// ---------- 打印实现（重写：真实文件加载 + 等字体就绪 + 指定打印机 + 复用窗口） ----------

// 复用一个常驻隐藏打印窗口，避免每次新建/销毁造成卡顿
let printWin: BrowserWindow | null = null
// 打印串行化：同一时间只处理一个打印任务，避免连点产生多个任务
let printing: Promise<unknown> = Promise.resolve()

function getPrintWindow(): BrowserWindow {
  if (printWin && !printWin.isDestroyed()) return printWin
  printWin = new BrowserWindow({
    show: false,
    width: 300,
    height: 900,
    webPreferences: { offscreen: false }
  })
  return printWin
}

// 把 HTML 写到临时文件再 loadFile（比 data: URL 渲染更可靠），并等待渲染 + 字体就绪
async function loadReceipt(win: BrowserWindow, html: string): Promise<void> {
  const tmp = join(app.getPath('temp'), `zhongqian-receipt-${Date.now()}.html`)
  writeFileSync(tmp, html, 'utf-8')
  await win.loadFile(tmp)
  // 等待字体加载完成，避免“白纸/缺字”
  try {
    await win.webContents.executeJavaScript(
      'document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true'
    )
  } catch {
    /* 忽略 */
  }
  // 再给一小段渲染时间
  await new Promise((r) => setTimeout(r, 150))
}

async function doPrint(
  html: string,
  mode: '58mm' | 'a5',
  deviceName: string
): Promise<{ ok: boolean; error?: string }> {
  const win = getPrintWindow()
  await loadReceipt(win, html)
  return await new Promise((resolve) => {
    const opts: Electron.WebContentsPrintOptions = {
      silent: mode === '58mm', // 58mm 走静默；A5 弹系统对话框
      printBackground: true,
      margins: { marginType: 'none' },
      color: false
    }
    // 指定了打印机就明确打给它（治“打到默认的错机器/不吐纸”）
    if (deviceName) opts.deviceName = deviceName
    win.webContents.print(opts, (success, failureReason) => {
      if (success) resolve({ ok: true })
      else resolve({ ok: false, error: failureReason || '打印被取消或失败' })
    })
  })
}

// 串行执行，返回本次任务结果
function enqueuePrint(
  task: () => Promise<{ ok: boolean; error?: string }>
): Promise<{ ok: boolean; error?: string }> {
  const run = printing.then(task, task)
  printing = run.catch(() => undefined)
  return run
}

export async function printReceipt(
  prescriptionId: number
): Promise<{ ok: boolean; error?: string }> {
  const settings = getSettings()
  const mode = settings.printer_mode
  const html = buildReceiptHtml(prescriptionId, mode)
  return enqueuePrint(async () => {
    try {
      return await doPrint(html, mode, settings.printer_device)
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })
}

// 列出系统打印机（供设置里选择）
export async function listPrinters(): Promise<PrinterInfo[]> {
  const win = getPrintWindow()
  const printers = await win.webContents.getPrintersAsync()
  return printers.map((p) => ({
    name: p.name,
    displayName: p.displayName || p.name,
    isDefault: p.isDefault
  }))
}

// 测试打印：打一张样张，用指定打印机（不传则用已保存的）
export async function testPrint(
  deviceName?: string
): Promise<{ ok: boolean; error?: string }> {
  const settings = getSettings()
  const mode = settings.printer_mode
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const sample: Prescription = {
    id: 0,
    patient_id: null,
    patient_name: '测试顾客',
    patient_gender: '男',
    patient_age: '30',
    doctor_name: '测试',
    note: '打印测试',
    doses_count: 7,
    usage_method: '水煎服，日一剂',
    acupuncture_fee: 50,
    other_fee: 0,
    herb_total: 50.4,
    total_price: 100.4,
    status: 'confirmed',
    created_at: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
    items: [
      { herb_id: 0, herb_name: '当归', dose_per_unit_g: 9, unit_price_snapshot: 60, subtotal: 3.78 },
      { herb_id: 0, herb_name: '黄芪', dose_per_unit_g: 12, unit_price_snapshot: 45, subtotal: 3.78 }
    ]
  }
  const html = renderReceipt(sample, mode, 8888)
  return enqueuePrint(async () => {
    try {
      return await doPrint(html, mode, deviceName ?? settings.printer_device)
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })
}
