import { contextBridge, ipcRenderer } from 'electron'
import type {
  ApiResult,
  Herb,
  HerbInput,
  Patient,
  PatientInput,
  DispensePayload,
  Prescription,
  PrescriptionItem,
  RecipeTemplate,
  PurchaseRecord,
  PriceAdjustment,
  AppSettings,
  ImportPreviewRow
} from '../shared/types'

const api = {
  auth: {
    status: () => ipcRenderer.invoke('auth:status') as Promise<ApiResult<{ hasPassword: boolean }>>,
    setup: (clinicName: string, password: string) =>
      ipcRenderer.invoke('auth:setup', clinicName, password) as Promise<ApiResult<boolean>>,
    login: (password: string) =>
      ipcRenderer.invoke('auth:login', password) as Promise<ApiResult<boolean>>,
    changePassword: (oldP: string, newP: string) =>
      ipcRenderer.invoke('auth:changePassword', oldP, newP) as Promise<ApiResult<boolean>>,
    resetWithKey: (key: string, newP: string) =>
      ipcRenderer.invoke('auth:resetWithKey', key, newP) as Promise<ApiResult<boolean>>
  },
  herbs: {
    list: (includeDisabled = true) =>
      ipcRenderer.invoke('herbs:list', includeDisabled) as Promise<ApiResult<Herb[]>>,
    search: (q: string) => ipcRenderer.invoke('herbs:search', q) as Promise<ApiResult<Herb[]>>,
    create: (input: HerbInput) =>
      ipcRenderer.invoke('herbs:create', input) as Promise<ApiResult<Herb>>,
    update: (id: number, input: HerbInput) =>
      ipcRenderer.invoke('herbs:update', id, input) as Promise<ApiResult<Herb>>,
    remove: (id: number) => ipcRenderer.invoke('herbs:delete', id) as Promise<ApiResult<void>>,
    makePinyin: (name: string) =>
      ipcRenderer.invoke('herbs:makePinyin', name) as Promise<
        ApiResult<{ code: string; full: string }>
      >,
    clearSamples: () =>
      ipcRenderer.invoke('herbs:clearSamples') as Promise<
        ApiResult<{ deleted: number; kept: number }>
      >
  },
  dispense: {
    quote: (payload: DispensePayload) =>
      ipcRenderer.invoke('dispense:quote', payload) as Promise<
        ApiResult<{
          items: (PrescriptionItem & { herb_name: string; total_g: number; stock_short: boolean })[]
          herb_total: number
          per_dose_price: number
          acupuncture_fee: number
          other_fee: number
          total: number
        }>
      >,
    confirm: (payload: DispensePayload) =>
      ipcRenderer.invoke('dispense:confirm', payload) as Promise<ApiResult<Prescription>>,
    print: (id: number) =>
      ipcRenderer.invoke('dispense:print', id) as Promise<ApiResult<{ ok: boolean; error?: string }>>,
    previewHtml: (payload: DispensePayload) =>
      ipcRenderer.invoke('dispense:previewHtml', payload) as Promise<ApiResult<string>>
  },
  prescriptions: {
    list: (patientId?: number) =>
      ipcRenderer.invoke('prescriptions:list', patientId) as Promise<ApiResult<Prescription[]>>,
    get: (id: number) =>
      ipcRenderer.invoke('prescriptions:get', id) as Promise<ApiResult<Prescription>>,
    void: (id: number) =>
      ipcRenderer.invoke('prescriptions:void', id) as Promise<ApiResult<Prescription>>
  },
  patients: {
    list: (q?: string) => ipcRenderer.invoke('patients:list', q) as Promise<ApiResult<Patient[]>>,
    create: (input: PatientInput) =>
      ipcRenderer.invoke('patients:create', input) as Promise<ApiResult<Patient>>,
    update: (id: number, input: PatientInput) =>
      ipcRenderer.invoke('patients:update', id, input) as Promise<ApiResult<Patient>>,
    remove: (id: number) => ipcRenderer.invoke('patients:delete', id) as Promise<ApiResult<void>>
  },
  purchases: {
    create: (herbId: number, qty: number, price: number) =>
      ipcRenderer.invoke('purchases:create', herbId, qty, price) as Promise<ApiResult<void>>,
    list: () => ipcRenderer.invoke('purchases:list') as Promise<ApiResult<PurchaseRecord[]>>
  },
  prices: {
    adjust: (herbId: number, newPrice: number) =>
      ipcRenderer.invoke('prices:adjust', herbId, newPrice) as Promise<ApiResult<void>>,
    history: () => ipcRenderer.invoke('prices:history') as Promise<ApiResult<PriceAdjustment[]>>
  },
  templates: {
    list: () => ipcRenderer.invoke('templates:list') as Promise<ApiResult<RecipeTemplate[]>>,
    create: (name: string, usage: string, items: { herb_id: number; dose_per_unit_g: number }[]) =>
      ipcRenderer.invoke('templates:create', name, usage, items) as Promise<ApiResult<void>>,
    remove: (id: number) => ipcRenderer.invoke('templates:delete', id) as Promise<ApiResult<void>>
  },
  reports: {
    sales: (from: string, to: string) =>
      ipcRenderer.invoke('reports:sales', from, to) as Promise<
        ApiResult<{
          prescriptions: Prescription[]
          total: number
          herbTotal: number
          feeTotal: number
          cost: number
          profit: number
        }>
      >,
    purchases: (from: string, to: string) =>
      ipcRenderer.invoke('reports:purchases', from, to) as Promise<
        ApiResult<{ purchases: PurchaseRecord[]; total: number }>
      >
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get') as Promise<ApiResult<AppSettings>>,
    save: (partial: Partial<AppSettings>) =>
      ipcRenderer.invoke('settings:save', partial) as Promise<ApiResult<void>>
  },
  backup: {
    run: () =>
      ipcRenderer.invoke('backup:run') as Promise<
        ApiResult<{ ok: boolean; path?: string; error?: string }>
      >
  },
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder') as Promise<ApiResult<string>>,
    openExcel: () => ipcRenderer.invoke('dialog:openExcel') as Promise<ApiResult<string>>,
    saveExcel: (defaultName: string) =>
      ipcRenderer.invoke('dialog:saveExcel', defaultName) as Promise<ApiResult<string>>
  },
  excel: {
    parseImport: (filePath: string) =>
      ipcRenderer.invoke('excel:parseImport', filePath) as Promise<
        ApiResult<{ columns: string[]; rows: ImportPreviewRow[] }>
      >,
    commitImport: (rows: ImportPreviewRow[]) =>
      ipcRenderer.invoke('excel:commitImport', rows) as Promise<
        ApiResult<{ inserted: number; skipped: number }>
      >,
    exportAll: (filePath: string) =>
      ipcRenderer.invoke('excel:exportAll', filePath) as Promise<ApiResult<boolean>>
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
