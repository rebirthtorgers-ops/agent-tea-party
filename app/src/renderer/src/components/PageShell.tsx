import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MessagesSquare } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

interface Props {
  title: string
  eyebrow?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  wide?: boolean
}

export function PageShell({ title, eyebrow, subtitle, actions, children, wide = false }: Props) {
  const navigate = useNavigate()
  return (
    <div className="page-shell">
      <div className="page-aura" aria-hidden />
      <header className="page-top">
        <button className="back-pill" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> 回到茶会 <MessagesSquare size={15} />
        </button>
        <div className="page-top-right">
          <ThemeToggle />
          <div className="brand-mini">
            <span className="brand-dot" /> Agent 茶话会
          </div>
        </div>
      </header>
      <main className={`page-main ${wide ? 'wide' : ''}`}>
        <header className="page-heading">
          <div>
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className="heading-actions">{actions}</div> : null}
        </header>
        {children}
      </main>
    </div>
  )
}
