import { useEffect, useState } from 'react'
import type { Agent } from '@shared/types'

export type ThemeMode = 'light' | 'dark'

export function applyTheme(theme?: string | null): ThemeMode {
  const next: ThemeMode = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.dataset.theme = next
  document.documentElement.style.colorScheme = next
  return next
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (sameDay) return `${hh}:${mm}`
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.round(n || 0))
}

export function formatMoney(usd: number): string {
  if (!usd) return '$0'
  if (usd < 0.0001) return '<$0.0001'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

export const TIER_LABELS: Record<string, string> = {
  short: '短期', mid: '中期', long: '长期', private: '私有'
}

export const avatarCache = new Map<string, string | null>()

export function useAvatar(path?: string | null): string | null {
  const [src, setSrc] = useState<string | null>(() => (path ? avatarCache.get(path) ?? null : null))
  useEffect(() => {
    let alive = true
    if (!path) { setSrc(null); return }
    if (avatarCache.has(path)) { setSrc(avatarCache.get(path) ?? null); return }
    void window.tea.avatarDataUrl(path).then((data) => {
      avatarCache.set(path, data)
      if (alive) setSrc(data)
    })
    return () => { alive = false }
  }, [path])
  return src
}

export function agentInitial(name: string): string {
  return name?.trim()?.[0] ?? '？'
}

export function agentModelLabel(agent: Agent, providerName?: string): string {
  if (!agent.modelId) return '未配置模型'
  return providerName ? `${providerName} · ${agent.modelId}` : agent.modelId
}

export function pickAvatarColor(seed: string): string {
  const colors = ['#ff7eb6', '#9b7bff', '#6ee7ff', '#ffd479', '#7ef2c0', '#ff9f7a']
  let hash = 0
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return colors[Math.abs(hash) % colors.length]
}

export function splitTags(tags?: string[]): string[] {
  return (tags ?? []).filter(Boolean).slice(0, 6)
}
