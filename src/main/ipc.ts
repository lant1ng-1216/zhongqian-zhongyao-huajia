import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as svc from './services'
import * as auth from './auth'
import * as excel from './excel'
import { runBackup } from './backup'
import { printReceipt, previewDraftHtml } from './print'
import type { ApiResult } from '../shared/types'

function wrap<T>(fn: () => T): ApiResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

async function wrapAsync<T>(fn: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export function registerIpc(): void {
  // ---- 认证 ----
  ipcMain.handle('auth:status', () => wrap(() => ({ hasPassword: auth.hasPassword() })))
  ipcMain.handle('auth:setup', (_e, clinicName: string, password: string) =>
    wrap(() => {
      auth.setupPassword(clinicName, password)
      return true
    })
  )
  ipcMain.handle('auth:login', (_e, password: string) => wrap(() => auth.login(password)))
  ipcMain.handle('auth:changePassword', (_e, oldP: string, newP: string) =>
    wrap(() => auth.changePassword(oldP, newP))
  )
  ipcMain.handle('auth:resetWithKey', (_e, key: string, newP: string) =>
    wrap(() => auth.resetPasswordWithRecoveryKey(key, newP))
  )

  // ---- 药品 ----
  ipcMain.handle('herbs:list', (_e, includeDisabled: boolean) =>
    wrap(() => svc.listHerbs(includeDisabled))
  )
  ipcMain.handle('herbs:search', (_e, q: string) => wrap(() => svc.searchHerbs(q)))
  ipcMain.handle('herbs:create', (_e, input) => wrap(() => svc.createHerb(input)))
  ipcMain.handle('herbs:update', (_e, id: number, input) => wrap(() => svc.updateHerb(id, input)))
  ipcMain.handle('herbs:delete', (_e, id: number) => wrap(() => svc.deleteHerb(id)))
  ipcMain.handle('herbs:makePinyin', (_e, name: string) => wrap(() => svc.makePinyin(name)))
  ipcMain.handle('herbs:clearSamples', () => wrap(() => svc.clearSampleHerbs()))

  // ---- 划价 ----
  ipcMain.handle('dispense:quote', (_e, payload) => wrap(() => svc.quote(payload)))
  ipcMain.handle('dispense:confirm', (_e, payload) => wrap(() => svc.confirmDispense(payload)))
  ipcMain.handle('dispense:print', (_e, id: number) => wrapAsync(() => printReceipt(id)))
  ipcMain.handle('dispense:previewHtml', (_e, payload) => wrap(() => previewDraftHtml(payload)))

  // ---- 处方历史 ----
  ipcMain.handle('prescriptions:list', (_e, patientId?: number) =>
    wrap(() => svc.listPrescriptions(patientId))
  )
  ipcMain.handle('prescriptions:get', (_e, id: number) => wrap(() => svc.getPrescription(id)))
  ipcMain.handle('prescriptions:void', (_e, id: number) => wrap(() => svc.voidPrescription(id)))

  // ---- 顾客 ----
  ipcMain.handle('patients:list', (_e, q?: string) => wrap(() => svc.listPatients(q)))
  ipcMain.handle('patients:create', (_e, input) => wrap(() => svc.createPatient(input)))
  ipcMain.handle('patients:update', (_e, id: number, input) =>
    wrap(() => svc.updatePatient(id, input))
  )
  ipcMain.handle('patients:delete', (_e, id: number) => wrap(() => svc.deletePatient(id)))

  // ---- 进货 ----
  ipcMain.handle('purchases:create', (_e, herbId: number, qty: number, price: number) =>
    wrap(() => svc.createPurchase(herbId, qty, price))
  )
  ipcMain.handle('purchases:list', () => wrap(() => svc.listPurchases()))

  // ---- 调价 ----
  ipcMain.handle('prices:adjust', (_e, herbId: number, newPrice: number) =>
    wrap(() => svc.adjustPrice(herbId, newPrice))
  )
  ipcMain.handle('prices:history', () => wrap(() => svc.listPriceAdjustments()))

  // ---- 常用方 ----
  ipcMain.handle('templates:list', () => wrap(() => svc.listTemplates()))
  ipcMain.handle('templates:create', (_e, name: string, usage: string, items) =>
    wrap(() => svc.createTemplate(name, usage, items))
  )
  ipcMain.handle('templates:delete', (_e, id: number) => wrap(() => svc.deleteTemplate(id)))

  // ---- 报表 ----
  ipcMain.handle('reports:sales', (_e, from: string, to: string) =>
    wrap(() => svc.reportSales(from, to))
  )
  ipcMain.handle('reports:purchases', (_e, from: string, to: string) =>
    wrap(() => svc.reportPurchases(from, to))
  )

  // ---- 设置 ----
  ipcMain.handle('settings:get', () => wrap(() => svc.getSettings()))
  ipcMain.handle('settings:save', (_e, partial) => wrap(() => svc.saveSettings(partial)))

  // ---- 备份 ----
  ipcMain.handle('backup:run', () => wrap(() => runBackup()))

  // ---- 文件对话框 ----
  ipcMain.handle('dialog:selectFolder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'createDirectory'] })
    return wrap(() => (res.canceled ? '' : res.filePaths[0]))
  })
  ipcMain.handle('dialog:openExcel', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xls', 'csv'] }]
    })
    return wrap(() => (res.canceled ? '' : res.filePaths[0]))
  })
  ipcMain.handle('dialog:saveExcel', async (_e, defaultName: string) => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showSaveDialog(win!, {
      defaultPath: defaultName,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    return wrap(() => (res.canceled ? '' : res.filePath || ''))
  })

  // ---- Excel 导入/导出 ----
  ipcMain.handle('excel:parseImport', (_e, filePath: string) =>
    wrap(() => excel.parseImportFile(filePath))
  )
  ipcMain.handle('excel:commitImport', (_e, rows) => wrap(() => excel.commitImport(rows)))
  ipcMain.handle('excel:exportAll', (_e, filePath: string) =>
    wrap(() => {
      excel.exportAll(filePath)
      return true
    })
  )
}
