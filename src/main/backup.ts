import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs'
import { join } from 'path'
import { getDb, getDbPath } from './db'

const KEEP_BACKUPS = 10

function getBackupFolder(): string {
  const row = getDb()
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get('backup_folder_path') as { value: string } | undefined
  const configured = row?.value?.trim()
  if (configured) return configured
  // 默认备份目录：userData/backups
  return join(app.getPath('userData'), 'backups')
}

function tsName(): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`
}

export function runBackup(): { ok: boolean; path?: string; error?: string } {
  try {
    const dbPath = getDbPath()
    if (!existsSync(dbPath)) return { ok: false, error: '数据库文件不存在' }

    // 确保 WAL 内容落盘，得到一致的备份
    try {
      getDb().pragma('wal_checkpoint(TRUNCATE)')
    } catch {
      /* 忽略 checkpoint 失败 */
    }

    const folder = getBackupFolder()
    if (!existsSync(folder)) mkdirSync(folder, { recursive: true })

    const target = join(folder, `zhongqian-${tsName()}.db`)
    copyFileSync(dbPath, target)

    // 清理旧备份，仅保留最近 N 份
    const files = readdirSync(folder)
      .filter((f) => f.startsWith('zhongqian-') && f.endsWith('.db'))
      .map((f) => ({ f, t: statSync(join(folder, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    for (const old of files.slice(KEEP_BACKUPS)) {
      try {
        unlinkSync(join(folder, old.f))
      } catch {
        /* 忽略删除失败 */
      }
    }

    return { ok: true, path: target }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
