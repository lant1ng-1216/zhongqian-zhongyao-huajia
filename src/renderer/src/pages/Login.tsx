import { useEffect, useRef, useState } from 'react'
import { useToast } from '../components/Toast'
import { Modal } from '../components/Modal'

export function Login({ onSuccess }: { onSuccess: () => void }): JSX.Element {
  const { toast } = useToast()
  const [needSetup, setNeedSetup] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [clinicName, setClinicName] = useState('仲谦')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [recoveryKey, setRecoveryKey] = useState('')
  const [resetPwd, setResetPwd] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.auth.status().then((res) => {
      setNeedSetup(res.ok && res.data ? !res.data.hasPassword : true)
    })
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [needSetup])

  const doSetup = async (): Promise<void> => {
    if (password.length < 4) return toast('密码至少 4 位', 'error')
    if (password !== confirmPwd) return toast('两次密码不一致', 'error')
    const res = await window.api.auth.setup(clinicName || '仲谦', password)
    if (res.ok) {
      toast('设置完成', 'ok')
      onSuccess()
    } else toast(res.error || '设置失败', 'error')
  }

  const doLogin = async (): Promise<void> => {
    const res = await window.api.auth.login(password)
    if (res.ok && res.data) onSuccess()
    else toast('密码错误', 'error')
  }

  const doReset = async (): Promise<void> => {
    if (resetPwd.length < 4) return toast('新密码至少 4 位', 'error')
    const res = await window.api.auth.resetWithKey(recoveryKey.trim(), resetPwd)
    if (res.ok && res.data) {
      toast('密码已重置，请用新密码登录', 'ok')
      setShowReset(false)
      setRecoveryKey('')
      setResetPwd('')
      setPassword('')
    } else toast('恢复密钥不正确', 'error')
  }

  if (needSetup === null) return <div className="h-full flex items-center justify-center text-muted">加载中…</div>

  return (
    <div className="h-full flex items-center justify-center bg-surface">
      <div className="card w-[380px] p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="text-brand font-bold text-[2.2em] leading-none">仲谦</div>
          <div className="text-muted mt-1">中药划价软件</div>
        </div>

        {needSetup ? (
          <div className="space-y-3">
            <div className="text-center text-[0.9em] text-muted mb-2">首次使用，请设置</div>
            <div>
              <label className="label">诊所 / 店铺名称</label>
              <input className="input" value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
            </div>
            <div>
              <label className="label">登录密码</label>
              <input
                ref={inputRef}
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="label">确认密码</label>
              <input
                type="password"
                className="input"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSetup()}
              />
            </div>
            <button className="btn-primary w-full mt-2" onClick={doSetup}>
              开始使用
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="label">请输入登录密码</label>
              <input
                ref={inputRef}
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doLogin()}
              />
            </div>
            <button className="btn-primary w-full" onClick={doLogin}>
              进入系统
            </button>
            <button
              className="w-full text-center text-[0.85em] text-muted hover:text-brand mt-1"
              onClick={() => setShowReset(true)}
            >
              忘记密码？
            </button>
          </div>
        )}
      </div>

      <Modal
        open={showReset}
        title="重置登录密码"
        onClose={() => setShowReset(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setShowReset(false)}>
              取消
            </button>
            <button className="btn-primary" onClick={doReset}>
              重置密码
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[0.85em] text-muted">
            恢复密钥由软件开发者统一保管。忘记密码时请联系开发者获取恢复密钥。
          </p>
          <div>
            <label className="label">恢复密钥</label>
            <input className="input" value={recoveryKey} onChange={(e) => setRecoveryKey(e.target.value)} />
          </div>
          <div>
            <label className="label">新密码</label>
            <input
              type="password"
              className="input"
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
