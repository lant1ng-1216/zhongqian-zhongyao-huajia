// 共享类型定义（主进程 / 预加载 / 渲染进程通用）

export interface Herb {
  id: number
  name: string
  pinyin_code: string
  pinyin_full: string
  spec: string
  unit: string
  retail_price: number
  cost_price: number
  stock_qty: number
  stock_warning_line: number
  last_purchase_price: number
  is_disabled: number // 0 / 1
  created_at: string
  updated_at: string
}

export type HerbInput = Omit<Herb, 'id' | 'created_at' | 'updated_at'>

export interface Patient {
  id: number
  name: string
  gender: string // 男 / 女 / 空
  age: string // 年龄（存文本，允许留空）
  contact: string
  note: string
  created_at: string
}

export type PatientInput = Omit<Patient, 'id' | 'created_at'>

export interface PrescriptionItem {
  id?: number
  prescription_id?: number
  herb_id: number
  herb_name?: string
  dose_per_unit_g: number
  unit_price_snapshot: number
  subtotal: number
}

export interface Prescription {
  id: number
  patient_id: number | null
  patient_name?: string | null
  patient_gender: string // 性别快照
  patient_age: string // 年龄快照
  doctor_name: string
  note: string
  doses_count: number
  usage_method: string
  acupuncture_fee: number // 针灸费
  other_fee: number // 其它费
  herb_total: number // 药费合计（不含针灸/其它）
  total_price: number // 总价 = 药费 + 针灸 + 其它
  status: 'draft' | 'confirmed' | 'voided'
  created_at: string
  items?: PrescriptionItem[]
}

// 划价录入时提交的载荷
export interface DispensePayload {
  patient_id: number | null
  patient_name: string
  patient_gender: string
  patient_age: string
  doctor_name: string
  note: string
  doses_count: number
  usage_method: string
  acupuncture_fee: number
  other_fee: number
  items: {
    herb_id: number
    dose_per_unit_g: number
  }[]
}

export interface RecipeTemplate {
  id: number
  name: string
  usage_method: string
  created_at: string
  items?: RecipeTemplateItem[]
}

export interface RecipeTemplateItem {
  id?: number
  template_id?: number
  herb_id: number
  herb_name?: string
  dose_per_unit_g: number
}

export interface PurchaseRecord {
  id: number
  herb_id: number
  herb_name?: string
  qty_kg: number
  purchase_price: number
  purchased_at: string
}

export interface PriceAdjustment {
  id: number
  herb_id: number
  herb_name?: string
  old_retail_price: number
  new_retail_price: number
  adjusted_at: string
}

export interface AppSettings {
  clinic_name: string
  printer_mode: '58mm' | 'a5'
  backup_folder_path: string
  theme: 'modern' | 'chinese' | 'large'
  has_password: boolean
}

export interface ImportPreviewRow {
  name: string
  spec: string
  stock_qty: number
  retail_price: number
  cost_price: number
  last_purchase_price: number
}

export interface ApiResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}
