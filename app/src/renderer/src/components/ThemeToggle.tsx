import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useApp } from '../store'
import { applyTheme, cx } from '../utils'

interface Props {
  compact?: boolean
  className?: string
}

export function ThemeToggle({ compact = false, className }: Props) {
  const theme = useApp((s) => s.settings.theme)
  const saveSettings = useApp((s) => s.saveSettings)
  const toast = useApp((s) => s.toast)
  const [busy, setBusy] = useState(false)

  const dark = theme === 'dark'
  const next = dark ? 'light' : 'dark'
  const label = dark ? '浅色模式' : '深色模式'

  async function toggle() {
    if (busy) return
    setBusy(true)
    try {
      applyTheme(next)
      await saveSettings({ theme: next })
      toast(`已切换到${label}`, 'success')
    } catch (error) {
      applyTheme(theme)
      toast(`主题切换失败：${String(error)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={cx('theme-toggle', compact && 'compact', className)}
      onClick={() => void toggle()}
      title={`切换到${label}`}
      aria-label={`切换到${label}`}
      disabled={busy}
    >
      <span className="theme-toggle-icon">{dark ? <Sun size={16} /> : <Moon size={16} />}</span>
      {compact ? null : <span>{label}</span>}
    </button>
  )
}
