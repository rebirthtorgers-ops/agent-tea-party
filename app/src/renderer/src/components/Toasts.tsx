import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'
import { useApp } from '../store'

export function Toasts() {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.kind === 'error' ? <AlertTriangle size={17} /> : t.kind === 'success' ? <CheckCircle2 size={17} /> : <Info size={17} />}
          <span>{t.text}</span>
          <button className="icon-btn ghost tiny" onClick={() => dismiss(t.id)}><X size={14} /></button>
        </div>
      ))}
    </div>
  )
}
