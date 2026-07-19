import bcrypt from 'bcryptjs'
import { getDb } from './db'

// 恢复密钥由开发者统一管理，构建时通过 __RECOVERY_KEY__ 注入（见 electron.vite.config.ts）。
// 真值放在 GitHub Actions 的 Secret ZHONGQIAN_RECOVERY_KEY 中，公开源码里只有占位符。
// 未注入时回退到占位符（仅供本地开发；正式分发务必在 CI 设置 Secret）。
declare const __RECOVERY_KEY__: string
export const DEVELOPER_RECOVERY_KEY =
  typeof __RECOVERY_KEY__ !== 'undefined' ? __RECOVERY_KEY__ : 'ZHONGQIAN-RESET-CHANGEME'

function getSetting(key: string): string {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? ''
}

function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value)
}

export function hasPassword(): boolean {
  return getSetting('password_hash').length > 0
}

export function setupPassword(clinicName: string, password: string): void {
  const hash = bcrypt.hashSync(password, 10)
  setSetting('password_hash', hash)
  if (clinicName && clinicName.trim()) {
    setSetting('clinic_name', clinicName.trim())
  }
}

export function login(password: string): boolean {
  const hash = getSetting('password_hash')
  if (!hash) return false
  return bcrypt.compareSync(password, hash)
}

export function changePassword(oldPassword: string, newPassword: string): boolean {
  if (!login(oldPassword)) return false
  setSetting('password_hash', bcrypt.hashSync(newPassword, 10))
  return true
}

export function resetPasswordWithRecoveryKey(recoveryKey: string, newPassword: string): boolean {
  if (recoveryKey.trim() !== DEVELOPER_RECOVERY_KEY) return false
  setSetting('password_hash', bcrypt.hashSync(newPassword, 10))
  return true
}
