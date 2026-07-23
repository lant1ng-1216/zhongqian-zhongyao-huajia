import { app, screen, type BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// 记住窗口大小/位置/最大化状态，并保证初始尺寸不超出屏幕（边框够得着、可拖动）

interface WState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized?: boolean
}

const stateFile = (): string => join(app.getPath('userData'), 'window-state.json')

export function getInitialState(): WState {
  const wa = screen.getPrimaryDisplay().workAreaSize
  const defW = Math.min(1280, wa.width - 40)
  const defH = Math.min(820, wa.height - 40)

  try {
    const s = JSON.parse(readFileSync(stateFile(), 'utf-8')) as WState
    if (s.width && s.height) {
      // 尺寸不超出屏幕可用区
      const width = Math.max(480, Math.min(s.width, wa.width))
      const height = Math.max(360, Math.min(s.height, wa.height))
      // 位置需落在某个显示器可见区内，否则丢弃（让系统居中）
      let x = s.x
      let y = s.y
      if (x !== undefined && y !== undefined) {
        const onScreen = screen.getAllDisplays().some((d) => {
          const b = d.workArea
          return x! >= b.x - 50 && y! >= b.y - 10 && x! < b.x + b.width - 50 && y! < b.y + b.height - 40
        })
        if (!onScreen) {
          x = undefined
          y = undefined
        }
      }
      return { width, height, x, y, isMaximized: !!s.isMaximized }
    }
  } catch {
    /* 无历史状态，用默认 */
  }
  return { width: defW, height: defH }
}

export function trackWindow(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null
  const save = (): void => {
    if (win.isDestroyed()) return
    const isMax = win.isMaximized()
    // 最大化时用还原后的常规尺寸，避免记住整屏
    const b = win.getNormalBounds()
    const data: WState = { width: b.width, height: b.height, x: b.x, y: b.y, isMaximized: isMax }
    try {
      writeFileSync(stateFile(), JSON.stringify(data))
    } catch {
      /* 忽略写入失败 */
    }
  }
  const debounced = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(save, 400)
  }
  win.on('resize', debounced)
  win.on('move', debounced)
  win.on('close', save)
}
