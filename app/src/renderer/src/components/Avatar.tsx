import { useMemo } from 'react'
import { useAvatar, agentInitial, pickAvatarColor, cx } from '../utils'

interface AvatarProps {
  name: string
  path?: string | null
  src?: string | null
  size?: number
  glow?: boolean
  className?: string
}

export function Avatar({ name, path, src, size = 40, glow = false, className }: AvatarProps) {
  const loaded = useAvatar(path)
  const url = src ?? loaded
  const color = useMemo(() => pickAvatarColor(name || 'agent'), [name])

  return (
    <span
      className={cx('avatar', glow && 'avatar-glow', className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, size * 0.36),
        background: url ? '#141020' : `linear-gradient(135deg, ${color}44, ${color}18)`,
        borderColor: `${color}55`
      }}
      title={name}
    >
      {url ? <img src={url} alt={name} draggable={false} /> : <span style={{ color }}>{agentInitial(name)}</span>}
    </span>
  )
}
