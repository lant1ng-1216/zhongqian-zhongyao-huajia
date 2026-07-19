import * as XLSX from 'xlsx'
import { getDb } from './db'
import { createHerb, listHerbs, listPatients, listPrescriptions } from './services'
import type { HerbInput, ImportPreviewRow } from '../shared/types'

// 满天星导出字段映射：药名/规格/库存/零售价/成本价/新进价
const FIELD_ALIASES: Record<keyof HerbInput | string, string[]> = {
  name: ['药名', '名称', '品名', 'name'],
  spec: ['规格', 'spec'],
  stock_qty: ['库存', '库存量', 'stock', 'stock_qty'],
  retail_price: ['零售价', '零售单价', 'retail', 'retail_price'],
  cost_price: ['成本价', '成本单价', 'cost', 'cost_price'],
  last_purchase_price: ['新进价', '最近进货价', '进货价', 'last_purchase_price']
}

function pick(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const key of Object.keys(row)) {
    const norm = key.trim()
    if (aliases.some((a) => a === norm)) return row[key]
  }
  return undefined
}

export function parseImportFile(filePath: string): {
  columns: string[]
  rows: ImportPreviewRow[]
} {
  const wb = XLSX.readFile(filePath)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const columns = json.length ? Object.keys(json[0]) : []
  const rows: ImportPreviewRow[] = json.map((r) => ({
    name: String(pick(r, FIELD_ALIASES.name) ?? '').trim(),
    spec: String(pick(r, FIELD_ALIASES.spec) ?? '').trim(),
    stock_qty: Number(pick(r, FIELD_ALIASES.stock_qty)) || 0,
    retail_price: Number(pick(r, FIELD_ALIASES.retail_price)) || 0,
    cost_price: Number(pick(r, FIELD_ALIASES.cost_price)) || 0,
    last_purchase_price: Number(pick(r, FIELD_ALIASES.last_purchase_price)) || 0
  }))
  return { columns, rows: rows.filter((r) => r.name) }
}

export function commitImport(rows: ImportPreviewRow[]): { inserted: number; skipped: number } {
  const db = getDb()
  let inserted = 0
  let skipped = 0
  const tx = db.transaction(() => {
    for (const r of rows) {
      const exists = db.prepare('SELECT id FROM herbs WHERE name = ?').get(r.name)
      if (exists) {
        skipped++
        continue
      }
      createHerb({
        name: r.name,
        pinyin_code: '',
        pinyin_full: '',
        spec: r.spec,
        unit: 'kg',
        retail_price: r.retail_price,
        cost_price: r.cost_price,
        stock_qty: r.stock_qty,
        stock_warning_line: 0,
        last_purchase_price: r.last_purchase_price,
        is_disabled: 0
      })
      inserted++
    }
  })
  tx()
  return { inserted, skipped }
}

export function exportAll(filePath: string): void {
  const wb = XLSX.utils.book_new()

  const herbs = listHerbs().map((h) => ({
    药名: h.name,
    简码: h.pinyin_code,
    规格: h.spec,
    单位: h.unit,
    零售价: h.retail_price,
    成本价: h.cost_price,
    库存: h.stock_qty,
    预警线: h.stock_warning_line,
    最近进货价: h.last_purchase_price
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(herbs), '药品')

  const patients = listPatients().map((p) => ({
    姓名: p.name,
    联系方式: p.contact,
    备注: p.note,
    建档时间: p.created_at
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(patients), '顾客')

  const pres = listPrescriptions(undefined, 5000).map((p) => ({
    编号: p.id,
    顾客: p.patient_name || '散客',
    性别: p.patient_gender || '',
    年龄: p.patient_age || '',
    医师: p.doctor_name,
    付数: p.doses_count,
    药费: p.herb_total,
    针灸费: p.acupuncture_fee,
    其它费: p.other_fee,
    总价: p.total_price,
    状态: p.status === 'voided' ? '已作废' : '正常',
    时间: p.created_at
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pres), '处方')

  XLSX.writeFile(wb, filePath)
}
