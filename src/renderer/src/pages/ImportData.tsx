import { useState } from 'react'
import type { ImportPreviewRow } from '../../../shared/types'
import { PageHeader } from '../components/ui'
import { useToast } from '../components/Toast'

export function ImportData(): JSX.Element {
  const { toast } = useToast()
  const [rows, setRows] = useState<ImportPreviewRow[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [filePath, setFilePath] = useState('')

  const pickFile = async (): Promise<void> => {
    const res = await window.api.dialog.openExcel()
    if (!res.ok || !res.data) return
    setFilePath(res.data)
    const parsed = await window.api.excel.parseImport(res.data)
    if (parsed.ok && parsed.data) {
      setColumns(parsed.data.columns)
      setRows(parsed.data.rows)
      toast(`解析出 ${parsed.data.rows.length} 条药品`, 'ok')
    } else toast(parsed.error || '解析失败', 'error')
  }

  const commit = async (): Promise<void> => {
    if (rows.length === 0) return toast('无可导入数据', 'error')
    const res = await window.api.excel.commitImport(rows)
    if (res.ok && res.data) {
      toast(`导入完成：新增 ${res.data.inserted}，跳过（已存在）${res.data.skipped}`, 'ok')
      setRows([])
      setFilePath('')
    } else toast(res.error || '导入失败', 'error')
  }

  const exportAll = async (): Promise<void> => {
    const res = await window.api.dialog.saveExcel(`仲谦数据备份-${new Date().toISOString().slice(0, 10)}.xlsx`)
    if (!res.ok || !res.data) return
    const ex = await window.api.excel.exportAll(res.data)
    if (ex.ok) toast('已导出 Excel', 'ok')
    else toast(ex.error || '导出失败', 'error')
  }

  return (
    <div className="min-h-full flex flex-col">
      <PageHeader
        title="数据导入 / 导出"
        desc="导入满天星导出的 Excel（药名/规格/库存/零售价/成本价/新进价），或导出可读性 Excel 备份"
        right={
          <button className="btn-ghost" onClick={exportAll}>
            导出全部数据(Excel)
          </button>
        }
      />
      <div className="p-6 space-y-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <button className="btn-primary" onClick={pickFile}>
              选择 Excel 文件
            </button>
            {filePath && <span className="text-muted text-[0.85em] truncate">{filePath}</span>}
          </div>
          {columns.length > 0 && (
            <p className="text-muted text-[0.82em] mt-3">
              识别到列：{columns.join(' / ')}。系统已按字段别名自动映射，请在下方预览确认后导入。
            </p>
          )}
        </div>

        {rows.length > 0 && (
          <>
            <div className="card overflow-hidden">
              <div className="px-4 py-2 bg-surface font-semibold text-[0.9em] text-muted">
                导入预览（{rows.length} 条，已存在的药名会自动跳过）
              </div>
              <table className="w-full border-collapse">
                <thead className="bg-surface">
                  <tr>
                    <th className="th">药名</th>
                    <th className="th">规格</th>
                    <th className="th text-right">库存kg</th>
                    <th className="th text-right">零售价</th>
                    <th className="th text-right">成本价</th>
                    <th className="th text-right">新进价</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((r, i) => (
                    <tr key={i}>
                      <td className="td font-medium">{r.name}</td>
                      <td className="td text-muted">{r.spec || '—'}</td>
                      <td className="td text-right">{r.stock_qty}</td>
                      <td className="td text-right">{r.retail_price}</td>
                      <td className="td text-right">{r.cost_price}</td>
                      <td className="td text-right">{r.last_purchase_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn-primary" onClick={commit}>
              确认导入 {rows.length} 条
            </button>
          </>
        )}
      </div>
    </div>
  )
}
