import { useEffect, useState } from 'react'
import { Login } from './pages/Login'
import { Dispense } from './pages/Dispense'
import { Herbs } from './pages/Herbs'
import { Inventory } from './pages/Inventory'
import { Patients } from './pages/Patients'
import { Templates } from './pages/Templates'
import { PriceAdjust } from './pages/PriceAdjust'
import { Reports } from './pages/Reports'
import { ImportData } from './pages/ImportData'
import { Settings } from './pages/Settings'

export type PageId =
  | 'dispense'
  | 'herbs'
  | 'inventory'
  | 'patients'
  | 'templates'
  | 'prices'
  | 'reports'
  | 'import'
  | 'settings'

interface NavItem {
  id: PageId
  label: string
  icon: string
  group: 1 | 2 | 3
}

const NAV: NavItem[] = [
  { id: 'dispense', label: '开方划价', icon: '➕', group: 1 },
  { id: 'herbs', label: '药品管理', icon: '🌿', group: 1 },
  { id: 'inventory', label: '库存进货', icon: '📦', group: 1 },
  { id: 'patients', label: '顾客档案', icon: '👥', group: 2 },
  { id: 'templates', label: '常用方', icon: '📋', group: 2 },
  { id: 'prices', label: '调价', icon: '🏷️', group: 2 },
  { id: 'reports', label: '进销存报表', icon: '📊', group: 3 },
  { id: 'import', label: '数据导入', icon: '📥', group: 3 },
  { id: 'settings', label: '设置', icon: '⚙️', group: 3 }
]

function App(): JSX.Element {
  const [authed, setAuthed] = useState(false)
  const [clinicName, setClinicName] = useState('仲谦')
  const [page, setPage] = useState<PageId>('dispense')
  // 复诊：从顾客档案调取历史方到划价页
  const [rxPreloadId, setRxPreloadId] = useState<number | null>(null)

  const reusePrescription = (id: number): void => {
    setRxPreloadId(id)
    setPage('dispense')
  }

  useEffect(() => {
    if (authed) {
      window.api.settings.get().then((res) => {
        if (res.ok && res.data) setClinicName(res.data.clinic_name)
      })
    }
  }, [authed])

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />

  return (
    <div className="flex h-full">
      {/* 侧边导航 */}
      <aside className="w-52 shrink-0 bg-panel border-r border-line flex flex-col">
        <div className="px-5 py-4 border-b border-line">
          <div className="text-brand font-bold text-[1.3em] leading-tight">仲谦</div>
          <div className="text-muted text-[0.8em]">{clinicName}</div>
        </div>
        <nav className="flex-1 overflow-auto py-2">
          {[1, 2, 3].map((g) => (
            <div key={g} className="mb-1">
              {NAV.filter((n) => n.group === g).map((n) => (
                <button
                  key={n.id}
                  onClick={() => setPage(n.id)}
                  className={`w-full flex items-center gap-2.5 px-5 py-2.5 text-left transition-colors ${
                    page === n.id
                      ? 'bg-brand/10 text-brand font-semibold border-r-[3px] border-brand'
                      : 'text-ink hover:bg-surface'
                  }`}
                >
                  <span className="text-[1.1em]">{n.icon}</span>
                  <span>{n.label}</span>
                </button>
              ))}
              {g < 3 && <div className="mx-5 my-1 border-t border-line" />}
            </div>
          ))}
        </nav>
        <div className="px-5 py-3 border-t border-line text-muted text-[0.75em]">
          单机版 · 数据本地存储
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto">
        {page === 'dispense' && (
          <Dispense preloadId={rxPreloadId} onPreloadConsumed={() => setRxPreloadId(null)} />
        )}
        {page === 'herbs' && <Herbs />}
        {page === 'inventory' && <Inventory />}
        {page === 'patients' && <Patients onReuse={reusePrescription} />}
        {page === 'templates' && <Templates />}
        {page === 'prices' && <PriceAdjust />}
        {page === 'reports' && <Reports />}
        {page === 'import' && <ImportData />}
        {page === 'settings' && <Settings onClinicNameChange={setClinicName} />}
      </main>
    </div>
  )
}

export default App
