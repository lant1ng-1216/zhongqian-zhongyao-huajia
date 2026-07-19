import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeId = 'modern' | 'chinese' | 'large'

export const THEME_LABELS: Record<ThemeId, string> = {
  modern: '现代极简',
  chinese: '中式国风',
  large: '实用大字'
}

interface ThemeCtx {
  theme: ThemeId
  setTheme: (t: ThemeId) => void
}

const Ctx = createContext<ThemeCtx>({ theme: 'modern', setTheme: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [theme, setThemeState] = useState<ThemeId>('modern')

  // 应用主题到 <html data-theme>，并持久化到设置
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // 启动时从数据库读取已保存主题
  useEffect(() => {
    window.api.settings.get().then((res) => {
      if (res.ok && res.data) setThemeState(res.data.theme)
    })
  }, [])

  const setTheme = (t: ThemeId): void => {
    setThemeState(t)
    window.api.settings.save({ theme: t })
  }

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>
}

export function useTheme(): ThemeCtx {
  return useContext(Ctx)
}
