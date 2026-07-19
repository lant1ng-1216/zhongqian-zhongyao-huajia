import { useEffect, useRef, useState } from 'react'
import type { Herb } from '../../../shared/types'

/**
 * 通用药品搜索下拉（键盘可用）。用于进货、调价、常用方等模块。
 * 开方划价页有专门的顺序录入实现，不用此组件。
 */
export function HerbSelect({
  onPick,
  placeholder = '输入药名 / 拼音简码搜索…',
  autoFocus
}: {
  onPick: (herb: Herb) => void
  placeholder?: string
  autoFocus?: boolean
}): JSX.Element {
  const [q, setQ] = useState('')
  const [list, setList] = useState<Herb[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    // 只有输入了内容才搜索/弹出，避免空框铺开整张列表遮挡视野
    if (!open || q.trim() === '') {
      setList([])
      return
    }
    window.api.herbs.search(q).then((res) => {
      if (!cancelled && res.ok && res.data) {
        setList(res.data)
        setActive(0)
      }
    })
    return () => {
      cancelled = true
    }
  }, [q, open])

  useEffect(() => {
    const onDoc = (e: MouseEvent): void => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = (h: Herb): void => {
    onPick(h)
    setQ('')
    setOpen(false)
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="input"
        placeholder={placeholder}
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (!open || q.trim() === '') return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, list.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (list[active]) pick(list[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && list.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 card shadow-xl max-h-64 overflow-auto">
          {list.map((h, i) => (
            <div
              key={h.id}
              onMouseDown={() => pick(h)}
              onMouseEnter={() => setActive(i)}
              className={`px-3 py-2 cursor-pointer flex justify-between items-center ${
                i === active ? 'bg-brand/10 text-brand' : 'hover:bg-surface'
              }`}
            >
              <span>
                <span className="font-medium">{h.name}</span>
                <span className="text-muted text-[0.8em] ml-2">{h.pinyin_code}</span>
              </span>
              <span className="text-muted text-[0.8em]">
                库存 {h.stock_qty}kg · ￥{h.retail_price}/kg
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
