import iconv from 'iconv-lite'
import type { Prescription } from '../shared/types'
import { getSettings } from './services'

// ESC/POS 小票指令生成（复用满天星那类热敏机的原始直打方式）
// 58mm 热敏机：Font A 每行 32 个半角字符（汉字算 2 个）

const ESC = 0x1b
const GS = 0x1d
const FS = 0x1c
const COLS = 32

const cmd = (...b: number[]): Buffer => Buffer.from(b)
// 汉字字库用 GBK/GB18030 编码，发 UTF-8 会空白/乱码
const gbk = (s: string): Buffer => iconv.encode(s, 'gb18030')

function width(s: string): number {
  let w = 0
  for (const ch of s) w += ch.charCodeAt(0) > 255 ? 2 : 1
  return w
}
function padEndW(s: string, w: number): string {
  const d = w - width(s)
  return d > 0 ? s + ' '.repeat(d) : s
}
// 左右两列：左顶格、右靠右
function twoCol(l: string, r: string, total = COLS): string {
  const d = total - width(l) - width(r)
  return l + ' '.repeat(Math.max(1, d)) + r
}
function center(s: string, total = COLS): string {
  const d = Math.floor((total - width(s)) / 2)
  return (d > 0 ? ' '.repeat(d) : '') + s
}
const DASH = '-'.repeat(COLS)
const pad4 = (n: number): string => String(n).padStart(4, '0')

export function buildReceiptEscpos(p: Prescription, noSeq: number): Buffer {
  const s = getSettings()
  const doses = p.doses_count || 1
  const perDose = (p.herb_total || 0) / doses
  const chunks: Buffer[] = []
  const push = (b: Buffer): void => {
    chunks.push(b)
  }
  const line = (t: string): void => {
    push(gbk(t))
    push(cmd(0x0a))
  }

  push(cmd(ESC, 0x40)) // 初始化
  push(cmd(FS, 0x26)) // 进入汉字模式
  push(cmd(ESC, 0x74, 0xff)) // 选择中文代码页（GB18030）

  // 抬头：居中 + 倍高倍宽 + 加粗
  push(cmd(ESC, 0x61, 0x01)) // 居中
  push(cmd(GS, 0x21, 0x11)) // 倍宽倍高
  push(cmd(ESC, 0x45, 0x01)) // 加粗
  line(s.clinic_name || '仲谦')
  push(cmd(ESC, 0x45, 0x00)) // 取消加粗
  push(cmd(GS, 0x21, 0x00)) // 恢复正常字号
  push(cmd(ESC, 0x61, 0x00)) // 左对齐

  line(twoCol(`NO:${pad4(noSeq)}`, `日期:${(p.created_at || '').slice(0, 16)}`))
  const info = [p.patient_gender, p.patient_age ? `${p.patient_age}岁` : ''].filter(Boolean).join(' ')
  line(twoCol(`姓名:${p.patient_name || '散客'}`, info))
  line(DASH)

  const items = p.items || []
  const cell = (it?: (typeof items)[number]): string =>
    it ? `${it.herb_name || ''} ${it.dose_per_unit_g}g` : ''
  for (let i = 0; i < items.length; i += 2) {
    line(padEndW(cell(items[i]), 16) + cell(items[i + 1]))
  }
  if (items.length === 0) line(center('（无药材）'))
  line(DASH)

  line(twoCol(`单价:${perDose.toFixed(2)}元`, `针灸:${(p.acupuncture_fee || 0).toFixed(2)}元`))
  line(twoCol(`贴数:${doses}贴`, `其它:${(p.other_fee || 0).toFixed(2)}元`))
  push(cmd(ESC, 0x45, 0x01))
  line(twoCol(`总价:${p.total_price.toFixed(2)}元`, `医师:${p.doctor_name || ''}`))
  push(cmd(ESC, 0x45, 0x00))
  if (p.usage_method) line(`用法:${p.usage_method}`)
  if (p.note) line(`备注:${p.note}`)
  line(DASH)

  push(cmd(ESC, 0x61, 0x01)) // 居中
  line('谢谢惠顾')
  push(cmd(ESC, 0x61, 0x00))

  push(cmd(ESC, 0x64, 0x03)) // 走纸 3 行
  push(cmd(GS, 0x56, 0x00)) // 全切（无切刀则忽略，无害）

  return Buffer.concat(chunks)
}
