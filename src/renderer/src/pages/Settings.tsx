import { useEffect, useState } from 'react'
import type { AppSettings, PrinterInfo } from '../../../shared/types'
import { PageHeader } from '../components/ui'
import { useToast } from '../components/Toast'
import { useTheme, THEME_LABELS, type ThemeId } from '../theme/ThemeProvider'

export function Settings({ onClinicNameChange }: { onClinicNameChange: (n: string) => void }): JSX.Element {
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [clinicName, setClinicName] = useState('')
  const [backupPath, setBackupPath] = useState('')
  const [printerMode, setPrinterMode] = useState<'58mm' | 'a5'>('58mm')
  const [printerDevice, setPrinterDevice] = useState('')
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [testing, setTesting] = useState(false)
  const [zoom, setZoom] = useState(1)

  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')

  useEffect(() => {
    window.api.settings.get().then((res) => {
      if (res.ok && res.data) {
        setSettings(res.data)
        setClinicName(res.data.clinic_name)
        setBackupPath(res.data.backup_folder_path)
        setPrinterMode(res.data.printer_mode)
        setPrinterDevice(res.data.printer_device)
        setZoom(res.data.ui_zoom || 1)
      }
    })
    window.api.printers.list().then((res) => {
      if (res.ok && res.data) setPrinters(res.data)
    })
  }, [])

  const saveBasic = async (): Promise<void> => {
    const res = await window.api.settings.save({
      clinic_name: clinicName,
      printer_mode: printerMode,
      printer_device: printerDevice,
      backup_folder_path: backupPath
    })
    if (res.ok) {
      toast('设置已保存', 'ok')
      onClinicNameChange(clinicName)
    } else toast(res.error || '保存失败', 'error')
  }

  const doTestPrint = async (): Promise<void> => {
    setTesting(true)
    // 先保存当前选择的打印机，确保测试用的是它
    await window.api.settings.save({ printer_mode: printerMode, printer_device: printerDevice })
    const res = await window.api.printers.test(printerDevice)
    setTesting(false)
    if (res.ok && res.data?.ok) toast('测试小票已发送，请查看打印机', 'ok')
    else toast('测试打印失败：' + (res.data?.error || res.error || '未知'), 'error')
  }

  const applyZoom = async (z: number): Promise<void> => {
    setZoom(z)
    await window.api.ui.setZoom(z)
  }

  const chooseBackupFolder = async (): Promise<void> => {
    const res = await window.api.dialog.selectFolder()
    if (res.ok && res.data) setBackupPath(res.data)
  }

  const runBackup = async (): Promise<void> => {
    const res = await window.api.backup.run()
    if (res.ok && res.data?.ok) toast('已备份到：' + res.data.path, 'ok')
    else toast('备份失败：' + (res.data?.error || res.error || ''), 'error')
  }

  const clearSamples = async (): Promise<void> => {
    if (!confirm('清除系统首次预置的示例药品？（仅删除未被处方/进货使用的示例药，不影响你自己录入或导入的药品）')) return
    const res = await window.api.herbs.clearSamples()
    if (res.ok && res.data) {
      toast(`已清除 ${res.data.deleted} 味示例药${res.data.kept ? `，${res.data.kept} 味因已使用而保留` : ''}`, 'ok')
    } else toast(res.error || '清除失败', 'error')
  }

  const changePassword = async (): Promise<void> => {
    if (newPwd.length < 4) return toast('新密码至少 4 位', 'error')
    if (newPwd !== confirmPwd) return toast('两次新密码不一致', 'error')
    const res = await window.api.auth.changePassword(oldPwd, newPwd)
    if (res.ok && res.data) {
      toast('密码已修改', 'ok')
      setOldPwd('')
      setNewPwd('')
      setConfirmPwd('')
    } else toast('旧密码错误', 'error')
  }

  if (!settings) return <div className="p-6 text-muted">加载中…</div>

  return (
    <div className="min-h-full flex flex-col">
      <PageHeader title="设置" desc="诊所信息、界面主题、打印、备份与密码" />
      <div className="p-6 grid grid-cols-2 gap-4">
        {/* 界面主题 */}
        <div className="card p-5 col-span-2">
          <h3 className="font-semibold mb-1">界面主题</h3>
          <p className="text-muted text-[0.82em] mb-3">
            切换只改变配色、字体、字号等表现层，按钮位置与操作逻辑完全一致，切换即时生效、不影响当前操作。
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(THEME_LABELS) as ThemeId[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`card p-4 text-left transition-all ${
                  theme === t ? 'ring-2 ring-brand border-brand' : 'hover:border-brand/50'
                }`}
              >
                <div className="font-semibold">{THEME_LABELS[t]}</div>
                <div className="text-muted text-[0.8em] mt-1">
                  {t === 'modern' && '青绿主色 · 适中字号（默认）'}
                  {t === 'chinese' && '朱红描金 · 楷体宣纸'}
                  {t === 'large' && '高对比 · 大字号'}
                </div>
                {theme === t && <div className="text-brand text-[0.8em] mt-2">✓ 当前使用</div>}
              </button>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-line">
            <h3 className="font-semibold mb-1">界面缩放（平板/小屏适配）</h3>
            <p className="text-muted text-[0.82em] mb-3">
              整体等比缩放界面。屏幕小、内容挤在一起时，往左拖调小即可装下；也可用快捷键 Ctrl 加号 / Ctrl 减号 / Ctrl 0。
            </p>
            <div className="flex items-center gap-4">
              <button className="btn-ghost btn-sm" onClick={() => applyZoom(Math.max(0.5, +(zoom - 0.1).toFixed(2)))}>
                A-
              </button>
              <input
                type="range"
                min={0.5}
                max={1.3}
                step={0.05}
                value={zoom}
                onChange={(e) => applyZoom(parseFloat(e.target.value))}
                className="flex-1"
              />
              <button className="btn-ghost btn-sm" onClick={() => applyZoom(Math.min(1.3, +(zoom + 0.1).toFixed(2)))}>
                A+
              </button>
              <span className="w-14 text-right font-semibold">{Math.round(zoom * 100)}%</span>
              <button className="btn-ghost btn-sm" onClick={() => applyZoom(1)}>
                重置
              </button>
            </div>
          </div>
        </div>

        {/* 基础设置 */}
        <div className="card p-5">
          <h3 className="font-semibold mb-3">诊所与打印</h3>
          <div className="space-y-3">
            <div>
              <label className="label">诊所 / 店铺名称（小票抬头）</label>
              <input className="input" value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
            </div>
            <div>
              <label className="label">打印机（选定你的小票机，避免打到别的设备）</label>
              <div className="flex gap-2">
                <select
                  className="input"
                  value={printerDevice}
                  onChange={(e) => setPrinterDevice(e.target.value)}
                >
                  <option value="">（系统默认打印机）</option>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName}
                      {p.isDefault ? '（默认）' : ''}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-ghost whitespace-nowrap"
                  onClick={() =>
                    window.api.printers.list().then((res) => res.ok && res.data && setPrinters(res.data))
                  }
                >
                  刷新
                </button>
              </div>
            </div>
            <div>
              <label className="label">打印机模式</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={printerMode === '58mm'}
                    onChange={() => setPrinterMode('58mm')}
                  />
                  58mm 热敏（静默打印）
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={printerMode === 'a5'} onChange={() => setPrinterMode('a5')} />
                  A5 普通（弹打印对话框）
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={saveBasic}>
                保存
              </button>
              <button className="btn-accent" onClick={doTestPrint} disabled={testing}>
                {testing ? '打印中…' : '测试打印'}
              </button>
            </div>
            <p className="text-muted text-[0.8em]">
              打不出来时：先在此选对你的小票打印机 → 点"测试打印"看是否出纸出字；仍不行可切到 A5 模式用系统对话框打印。
            </p>
          </div>
        </div>

        {/* 备份 */}
        <div className="card p-5">
          <h3 className="font-semibold mb-3">数据备份</h3>
          <div className="space-y-3">
            <div>
              <label className="label">自动备份目录（启动/关闭时自动备份，保留最近10份）</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  value={backupPath}
                  onChange={(e) => setBackupPath(e.target.value)}
                  placeholder="留空则备份到应用数据目录"
                />
                <button className="btn-ghost whitespace-nowrap" onClick={chooseBackupFolder}>
                  选择
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={saveBasic}>
                保存路径
              </button>
              <button className="btn-accent" onClick={runBackup}>
                立即备份
              </button>
            </div>
            <div className="pt-2 border-t border-line">
              <div className="text-[0.85em] text-muted mb-1">初次使用维护</div>
              <button className="btn-ghost btn-sm" onClick={clearSamples}>
                清除预置示例药品
              </button>
            </div>
          </div>
        </div>

        {/* 修改密码 */}
        <div className="card p-5 col-span-2">
          <h3 className="font-semibold mb-3">修改登录密码</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">旧密码</label>
              <input type="password" className="input" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
            </div>
            <div>
              <label className="label">新密码</label>
              <input type="password" className="input" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            </div>
            <div>
              <label className="label">确认新密码</label>
              <input
                type="password"
                className="input"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
              />
            </div>
          </div>
          <button className="btn-primary mt-3" onClick={changePassword}>
            修改密码
          </button>
          <p className="text-muted text-[0.8em] mt-2">
            忘记密码时，可在登录页通过开发者提供的恢复密钥重置。
          </p>
        </div>
      </div>
    </div>
  )
}
