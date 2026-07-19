import { pinyin } from 'pinyin-pro'
import { getDb } from './db'
import type {
  Herb,
  HerbInput,
  Patient,
  PatientInput,
  DispensePayload,
  Prescription,
  PrescriptionItem,
  RecipeTemplate,
  RecipeTemplateItem,
  PurchaseRecord,
  PriceAdjustment,
  AppSettings
} from '../shared/types'

// ---------- 拼音简码 ----------
export function makePinyin(name: string): { code: string; full: string } {
  const full = pinyin(name, { toneType: 'none', type: 'array' }).join('')
  const firstLetters = pinyin(name, { pattern: 'first', toneType: 'none', type: 'array' }).join('')
  return { code: firstLetters.toLowerCase(), full: full.toLowerCase() }
}

// 为示例数据/历史数据补齐缺失的拼音码
export function backfillPinyin(): void {
  const db = getDb()
  const rows = db
    .prepare("SELECT id, name, pinyin_code, pinyin_full FROM herbs")
    .all() as Herb[]
  const upd = db.prepare('UPDATE herbs SET pinyin_code = ?, pinyin_full = ? WHERE id = ?')
  const tx = db.transaction(() => {
    for (const r of rows) {
      if (!r.pinyin_full || !r.pinyin_code) {
        const { code, full } = makePinyin(r.name)
        upd.run(r.pinyin_code || code, r.pinyin_full || full, r.id)
      }
    }
  })
  tx()
}

// ---------- 药品 ----------
export function listHerbs(includeDisabled = true): Herb[] {
  const db = getDb()
  const sql = includeDisabled
    ? 'SELECT * FROM herbs ORDER BY name'
    : 'SELECT * FROM herbs WHERE is_disabled = 0 ORDER BY name'
  return db.prepare(sql).all() as Herb[]
}

export function searchHerbs(query: string, limit = 12): Herb[] {
  const db = getDb()
  const q = query.trim().toLowerCase()
  if (!q) {
    return db
      .prepare('SELECT * FROM herbs WHERE is_disabled = 0 ORDER BY name LIMIT ?')
      .all(limit) as Herb[]
  }
  const like = `%${q}%`
  const rows = db
    .prepare(
      `SELECT * FROM herbs
       WHERE is_disabled = 0 AND (
         pinyin_code LIKE ? OR pinyin_full LIKE ? OR name LIKE ?
       )
       ORDER BY
         CASE
           WHEN pinyin_code = ? THEN 0
           WHEN name = ? THEN 1
           WHEN pinyin_code LIKE ? THEN 2
           WHEN name LIKE ? THEN 3
           ELSE 4
         END,
         name
       LIMIT ?`
    )
    .all(like, like, like, q, query.trim(), `${q}%`, `${query.trim()}%`, limit) as Herb[]
  return rows
}

export function createHerb(input: HerbInput): Herb {
  const db = getDb()
  let code = input.pinyin_code?.trim()
  let full = input.pinyin_full?.trim()
  if (!code || !full) {
    const g = makePinyin(input.name)
    code = code || g.code
    full = full || g.full
  }
  const info = db
    .prepare(
      `INSERT INTO herbs (name, pinyin_code, pinyin_full, spec, unit, retail_price, cost_price, stock_qty, stock_warning_line, last_purchase_price, is_disabled)
       VALUES (@name, @pinyin_code, @pinyin_full, @spec, @unit, @retail_price, @cost_price, @stock_qty, @stock_warning_line, @last_purchase_price, @is_disabled)`
    )
    .run({
      name: input.name,
      pinyin_code: code,
      pinyin_full: full,
      spec: input.spec || '',
      unit: input.unit || 'kg',
      retail_price: input.retail_price || 0,
      cost_price: input.cost_price || 0,
      stock_qty: input.stock_qty || 0,
      stock_warning_line: input.stock_warning_line || 0,
      last_purchase_price: input.last_purchase_price || 0,
      is_disabled: input.is_disabled ? 1 : 0
    })
  return db.prepare('SELECT * FROM herbs WHERE id = ?').get(info.lastInsertRowid) as Herb
}

export function updateHerb(id: number, input: HerbInput): Herb {
  const db = getDb()
  let code = input.pinyin_code?.trim()
  let full = input.pinyin_full?.trim()
  if (!code || !full) {
    const g = makePinyin(input.name)
    code = code || g.code
    full = full || g.full
  }
  db.prepare(
    `UPDATE herbs SET name=@name, pinyin_code=@pinyin_code, pinyin_full=@pinyin_full, spec=@spec, unit=@unit,
       retail_price=@retail_price, cost_price=@cost_price, stock_qty=@stock_qty, stock_warning_line=@stock_warning_line,
       last_purchase_price=@last_purchase_price, is_disabled=@is_disabled, updated_at=datetime('now','localtime')
     WHERE id=@id`
  ).run({
    id,
    name: input.name,
    pinyin_code: code,
    pinyin_full: full,
    spec: input.spec || '',
    unit: input.unit || 'kg',
    retail_price: input.retail_price || 0,
    cost_price: input.cost_price || 0,
    stock_qty: input.stock_qty || 0,
    stock_warning_line: input.stock_warning_line || 0,
    last_purchase_price: input.last_purchase_price || 0,
    is_disabled: input.is_disabled ? 1 : 0
  })
  return db.prepare('SELECT * FROM herbs WHERE id = ?').get(id) as Herb
}

export function deleteHerb(id: number): void {
  const db = getDb()
  const used = (
    db.prepare('SELECT COUNT(*) AS c FROM prescription_items WHERE herb_id = ?').get(id) as {
      c: number
    }
  ).c
  if (used > 0) {
    // 有历史处方引用则停用而非删除，避免破坏历史记录
    db.prepare("UPDATE herbs SET is_disabled = 1, updated_at=datetime('now','localtime') WHERE id = ?").run(id)
  } else {
    db.prepare('DELETE FROM herbs WHERE id = ?').run(id)
  }
}

// 首次运行预置的示例药品名单（供“一键清除示例数据”使用）
const SAMPLE_HERB_NAMES = [
  '当归', '黄芪', '党参', '白术', '茯苓', '甘草', '川芎', '熟地黄', '白芍', '陈皮'
]

// 清除示例药品：仅删除未被处方/进货引用的示例药，避免误删真实数据
export function clearSampleHerbs(): { deleted: number; kept: number } {
  const db = getDb()
  let deleted = 0
  let kept = 0
  const tx = db.transaction(() => {
    for (const name of SAMPLE_HERB_NAMES) {
      const h = db.prepare('SELECT id FROM herbs WHERE name = ?').get(name) as
        | { id: number }
        | undefined
      if (!h) continue
      const used = (
        db.prepare('SELECT COUNT(*) AS c FROM prescription_items WHERE herb_id = ?').get(h.id) as {
          c: number
        }
      ).c
      const purchased = (
        db.prepare('SELECT COUNT(*) AS c FROM purchase_records WHERE herb_id = ?').get(h.id) as {
          c: number
        }
      ).c
      if (used > 0 || purchased > 0) {
        kept++
        continue
      }
      db.prepare('DELETE FROM herbs WHERE id = ?').run(h.id)
      deleted++
    }
  })
  tx()
  return { deleted, kept }
}

// ---------- 计价 ----------
function calcSubtotal(retailPricePerKg: number, doseG: number, doses: number): number {
  // 单价按 kg 存储，换算为 g 单价：/1000
  return round2((retailPricePerKg / 1000) * doseG * doses)
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// 询价：仅计算，不落库、不扣库存
export function quote(payload: DispensePayload): {
  items: (PrescriptionItem & { herb_name: string; total_g: number; stock_short: boolean })[]
  herb_total: number // 药费合计
  per_dose_price: number // 单价（每付药费）
  acupuncture_fee: number
  other_fee: number
  total: number // 总价 = 药费 + 针灸 + 其它
} {
  const db = getDb()
  const doses = payload.doses_count || 1
  const items = payload.items.map((it) => {
    const herb = db.prepare('SELECT * FROM herbs WHERE id = ?').get(it.herb_id) as Herb
    const subtotal = calcSubtotal(herb.retail_price, it.dose_per_unit_g, doses)
    const total_g = round2(it.dose_per_unit_g * doses)
    const stock_short = herb.stock_qty * 1000 < total_g
    return {
      herb_id: herb.id,
      herb_name: herb.name,
      dose_per_unit_g: it.dose_per_unit_g,
      unit_price_snapshot: herb.retail_price,
      subtotal,
      total_g,
      stock_short
    }
  })
  const herb_total = round2(items.reduce((s, i) => s + i.subtotal, 0))
  const per_dose_price = round2(herb_total / doses)
  const acupuncture_fee = round2(payload.acupuncture_fee || 0)
  const other_fee = round2(payload.other_fee || 0)
  const total = round2(herb_total + acupuncture_fee + other_fee)
  return { items, herb_total, per_dose_price, acupuncture_fee, other_fee, total }
}

// 正式划价：写入处方 + 明细，扣减库存
export function confirmDispense(payload: DispensePayload): Prescription {
  const db = getDb()
  const doses = payload.doses_count || 1

  const tx = db.transaction(() => {
    // 处理顾客：如提供姓名但无 id，则自动建档；已存在则补充性别/年龄
    let patientId = payload.patient_id
    const pname = payload.patient_name?.trim()
    const gender = payload.patient_gender || ''
    const age = payload.patient_age || ''
    if (pname) {
      if (!patientId) {
        const existing = db.prepare('SELECT id FROM patients WHERE name = ? LIMIT 1').get(pname) as
          | { id: number }
          | undefined
        patientId = existing ? existing.id : undefined
      }
      if (patientId) {
        // 回填性别/年龄（仅当填了值时覆盖，避免清空已有资料）
        db.prepare(
          `UPDATE patients SET gender = CASE WHEN ?<>'' THEN ? ELSE gender END,
                               age = CASE WHEN ?<>'' THEN ? ELSE age END WHERE id = ?`
        ).run(gender, gender, age, age, patientId)
      } else {
        const info = db
          .prepare('INSERT INTO patients (name, gender, age) VALUES (?, ?, ?)')
          .run(pname, gender, age)
        patientId = Number(info.lastInsertRowid)
      }
    }

    const q = quote(payload)
    const presInfo = db
      .prepare(
        `INSERT INTO prescriptions (patient_id, patient_gender, patient_age, doctor_name, note, doses_count, usage_method,
           acupuncture_fee, other_fee, herb_total, total_price, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`
      )
      .run(
        patientId || null,
        gender,
        age,
        payload.doctor_name || '',
        payload.note || '',
        doses,
        payload.usage_method || '',
        q.acupuncture_fee,
        q.other_fee,
        q.herb_total,
        q.total
      )
    const presId = Number(presInfo.lastInsertRowid)

    const insItem = db.prepare(
      `INSERT INTO prescription_items (prescription_id, herb_id, dose_per_unit_g, unit_price_snapshot, subtotal)
       VALUES (?, ?, ?, ?, ?)`
    )
    const deductStock = db.prepare(
      "UPDATE herbs SET stock_qty = stock_qty - ?, updated_at=datetime('now','localtime') WHERE id = ?"
    )
    for (const it of q.items) {
      insItem.run(presId, it.herb_id, it.dose_per_unit_g, it.unit_price_snapshot, it.subtotal)
      deductStock.run(it.total_g / 1000, it.herb_id) // 扣减 kg
    }
    return presId
  })

  const presId = tx()
  return getPrescription(presId)!
}

// 小票 NO：按日流水号（当天第几张）
export function dailySequence(id: number): number {
  const db = getDb()
  const row = db.prepare('SELECT created_at FROM prescriptions WHERE id = ?').get(id) as
    | { created_at: string }
    | undefined
  if (!row) return id
  const r = db
    .prepare(
      'SELECT COUNT(*) AS c FROM prescriptions WHERE date(created_at) = date(?) AND id <= ?'
    )
    .get(row.created_at, id) as { c: number }
  return r.c
}

export function getPrescription(id: number): Prescription | null {
  const db = getDb()
  const p = db
    .prepare(
      `SELECT pr.*, pt.name AS patient_name FROM prescriptions pr
       LEFT JOIN patients pt ON pt.id = pr.patient_id WHERE pr.id = ?`
    )
    .get(id) as Prescription | undefined
  if (!p) return null
  p.items = db
    .prepare(
      `SELECT pi.*, h.name AS herb_name FROM prescription_items pi
       JOIN herbs h ON h.id = pi.herb_id WHERE pi.prescription_id = ?`
    )
    .all(id) as PrescriptionItem[]
  return p
}

// 作废已划价处方：恢复库存，标记为 voided（保留记录以便追溯，不物理删除）
export function voidPrescription(id: number): Prescription {
  const db = getDb()
  const pres = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(id) as
    | Prescription
    | undefined
  if (!pres) throw new Error('处方不存在')
  if (pres.status === 'voided') throw new Error('该处方已作废')

  const tx = db.transaction(() => {
    const items = db
      .prepare('SELECT * FROM prescription_items WHERE prescription_id = ?')
      .all(id) as PrescriptionItem[]
    const restore = db.prepare(
      "UPDATE herbs SET stock_qty = stock_qty + ?, updated_at=datetime('now','localtime') WHERE id = ?"
    )
    for (const it of items) {
      // 恢复库存：单付用量 × 付数 / 1000（g→kg）
      restore.run((it.dose_per_unit_g * pres.doses_count) / 1000, it.herb_id)
    }
    db.prepare("UPDATE prescriptions SET status = 'voided' WHERE id = ?").run(id)
  })
  tx()
  return getPrescription(id)!
}

export function listPrescriptions(patientId?: number, limit = 100): Prescription[] {
  const db = getDb()
  const base = `SELECT pr.*, pt.name AS patient_name FROM prescriptions pr
       LEFT JOIN patients pt ON pt.id = pr.patient_id`
  const rows = patientId
    ? (db
        .prepare(`${base} WHERE pr.patient_id = ? ORDER BY pr.created_at DESC LIMIT ?`)
        .all(patientId, limit) as Prescription[])
    : (db.prepare(`${base} ORDER BY pr.created_at DESC LIMIT ?`).all(limit) as Prescription[])
  return rows
}

// ---------- 顾客 ----------
export function listPatients(query?: string): Patient[] {
  const db = getDb()
  if (query && query.trim()) {
    const like = `%${query.trim()}%`
    return db
      .prepare('SELECT * FROM patients WHERE name LIKE ? OR contact LIKE ? ORDER BY created_at DESC')
      .all(like, like) as Patient[]
  }
  return db.prepare('SELECT * FROM patients ORDER BY created_at DESC').all() as Patient[]
}

export function createPatient(input: PatientInput): Patient {
  const db = getDb()
  const info = db
    .prepare('INSERT INTO patients (name, gender, age, contact, note) VALUES (?, ?, ?, ?, ?)')
    .run(input.name, input.gender || '', input.age || '', input.contact || '', input.note || '')
  return db.prepare('SELECT * FROM patients WHERE id = ?').get(info.lastInsertRowid) as Patient
}

export function updatePatient(id: number, input: PatientInput): Patient {
  const db = getDb()
  db.prepare('UPDATE patients SET name=?, gender=?, age=?, contact=?, note=? WHERE id=?').run(
    input.name,
    input.gender || '',
    input.age || '',
    input.contact || '',
    input.note || '',
    id
  )
  return db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as Patient
}

export function deletePatient(id: number): void {
  getDb().prepare('DELETE FROM patients WHERE id = ?').run(id)
}

// ---------- 进货 ----------
export function createPurchase(herbId: number, qtyKg: number, price: number): void {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO purchase_records (herb_id, qty_kg, purchase_price) VALUES (?, ?, ?)'
    ).run(herbId, qtyKg, price)
    db.prepare(
      "UPDATE herbs SET stock_qty = stock_qty + ?, last_purchase_price = ?, updated_at=datetime('now','localtime') WHERE id = ?"
    ).run(qtyKg, price, herbId)
  })
  tx()
}

export function listPurchases(limit = 200): PurchaseRecord[] {
  return getDb()
    .prepare(
      `SELECT p.*, h.name AS herb_name FROM purchase_records p
       JOIN herbs h ON h.id = p.herb_id ORDER BY p.purchased_at DESC LIMIT ?`
    )
    .all(limit) as PurchaseRecord[]
}

// ---------- 调价 ----------
export function adjustPrice(herbId: number, newPrice: number): void {
  const db = getDb()
  const herb = db.prepare('SELECT retail_price FROM herbs WHERE id = ?').get(herbId) as {
    retail_price: number
  }
  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO price_adjustments (herb_id, old_retail_price, new_retail_price) VALUES (?, ?, ?)'
    ).run(herbId, herb.retail_price, newPrice)
    db.prepare(
      "UPDATE herbs SET retail_price = ?, updated_at=datetime('now','localtime') WHERE id = ?"
    ).run(newPrice, herbId)
  })
  tx()
}

export function listPriceAdjustments(limit = 200): PriceAdjustment[] {
  return getDb()
    .prepare(
      `SELECT a.*, h.name AS herb_name FROM price_adjustments a
       JOIN herbs h ON h.id = a.herb_id ORDER BY a.adjusted_at DESC LIMIT ?`
    )
    .all(limit) as PriceAdjustment[]
}

// ---------- 常用方 ----------
export function listTemplates(): RecipeTemplate[] {
  const db = getDb()
  const templates = db
    .prepare('SELECT * FROM recipe_templates ORDER BY created_at DESC')
    .all() as RecipeTemplate[]
  const itemStmt = db.prepare(
    `SELECT ti.*, h.name AS herb_name FROM recipe_template_items ti
     JOIN herbs h ON h.id = ti.herb_id WHERE ti.template_id = ?`
  )
  for (const t of templates) {
    t.items = itemStmt.all(t.id) as RecipeTemplateItem[]
  }
  return templates
}

export function createTemplate(
  name: string,
  usageMethod: string,
  items: { herb_id: number; dose_per_unit_g: number }[]
): void {
  const db = getDb()
  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO recipe_templates (name, usage_method) VALUES (?, ?)')
      .run(name, usageMethod || '')
    const tid = Number(info.lastInsertRowid)
    const ins = db.prepare(
      'INSERT INTO recipe_template_items (template_id, herb_id, dose_per_unit_g) VALUES (?, ?, ?)'
    )
    for (const it of items) ins.run(tid, it.herb_id, it.dose_per_unit_g)
  })
  tx()
}

export function deleteTemplate(id: number): void {
  getDb().prepare('DELETE FROM recipe_templates WHERE id = ?').run(id)
}

// ---------- 设置 ----------
export function getSettings(): AppSettings {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as {
    key: string
    value: string
  }[]
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    clinic_name: map.clinic_name || '仲谦',
    printer_mode: (map.printer_mode as '58mm' | 'a5') || '58mm',
    backup_folder_path: map.backup_folder_path || '',
    theme: (map.theme as AppSettings['theme']) || 'modern',
    has_password: (map.password_hash || '').length > 0
  }
}

export function saveSettings(partial: Partial<AppSettings>): void {
  const db = getDb()
  const set = db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  )
  const tx = db.transaction(() => {
    if (partial.clinic_name !== undefined) set.run('clinic_name', partial.clinic_name)
    if (partial.printer_mode !== undefined) set.run('printer_mode', partial.printer_mode)
    if (partial.backup_folder_path !== undefined)
      set.run('backup_folder_path', partial.backup_folder_path)
    if (partial.theme !== undefined) set.run('theme', partial.theme)
  })
  tx()
}

// ---------- 报表 ----------
export function reportSales(from: string, to: string): {
  prescriptions: Prescription[]
  total: number
  herbTotal: number
  feeTotal: number
  cost: number
  profit: number
} {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT pr.*, pt.name AS patient_name FROM prescriptions pr
       LEFT JOIN patients pt ON pt.id = pr.patient_id
       WHERE pr.status='confirmed' AND date(pr.created_at) BETWEEN date(?) AND date(?)
       ORDER BY pr.created_at DESC`
    )
    .all(from, to) as Prescription[]
  const total = round2(rows.reduce((s, r) => s + (r.total_price || 0), 0))
  const herbTotal = round2(rows.reduce((s, r) => s + (r.herb_total || 0), 0))
  const feeTotal = round2(
    rows.reduce((s, r) => s + (r.acupuncture_fee || 0) + (r.other_fee || 0), 0)
  )
  // 药材成本（按当前成本价估算）：Σ 单付g × 付数 / 1000 × 成本价
  const costRow = db
    .prepare(
      `SELECT COALESCE(SUM(pi.dose_per_unit_g * pr.doses_count / 1000.0 * h.cost_price), 0) AS cost
       FROM prescription_items pi
       JOIN prescriptions pr ON pr.id = pi.prescription_id
       JOIN herbs h ON h.id = pi.herb_id
       WHERE pr.status='confirmed' AND date(pr.created_at) BETWEEN date(?) AND date(?)`
    )
    .get(from, to) as { cost: number }
  const cost = round2(costRow.cost)
  const profit = round2(total - cost)
  return { prescriptions: rows, total, herbTotal, feeTotal, cost, profit }
}

export function reportPurchases(from: string, to: string): {
  purchases: PurchaseRecord[]
  total: number
} {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT p.*, h.name AS herb_name FROM purchase_records p
       JOIN herbs h ON h.id = p.herb_id
       WHERE date(p.purchased_at) BETWEEN date(?) AND date(?)
       ORDER BY p.purchased_at DESC`
    )
    .all(from, to) as PurchaseRecord[]
  const total = round2(rows.reduce((s, r) => s + r.qty_kg * r.purchase_price, 0))
  return { purchases: rows, total }
}
