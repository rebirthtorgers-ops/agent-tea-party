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
        background: url ? '#141020' : `linear-gradient(145deg, ${color}, ${color}b8)`,
        borderColor: `${color}aa`
      }}
      title={name}
    >
      {url ? <img src={url} alt={name} draggable={false} /> : <span style={{ color: '#fff', textShadow: '0 1px 8px rgba(36, 18, 62, 0.45)' }}>{agentInitial(name)}</span>}
    </span>
  )
}
