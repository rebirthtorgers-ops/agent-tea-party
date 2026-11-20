import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { useApp } from './store'
import { applyTheme } from './utils'
import { Toasts } from './components/Toasts'
import { ChatPage } from './pages/ChatPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { AgentsPage } from './pages/AgentsPage'
import { CharactersPage } from './pages/CharactersPage'
import { PersonaPage } from './pages/PersonaPage'
import { ProvidersPage } from './pages/ProvidersPage'
import { StatsPage } from './pages/StatsPage'
import { MemoriesPage } from './pages/MemoriesPage'
import { SettingsPage } from './pages/SettingsPage'

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const onboarded = useApp((s) => s.settings.onboarded)
  const location = useLocation()
  if (!onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}

export default function App() {
  const ready = useApp((s) => s.ready)
  const bootError = useApp((s) => s.bootError)
  const theme = useApp((s) => s.settings.theme)
  const init = useApp((s) => s.init)

  useEffect(() => { void init() }, [init])
  useEffect(() => { applyTheme(theme) }, [theme])

  if (!ready) {
    return (
      <div className="boot-screen">
        <div className="boot-orb" />
        <div className="boot-brand">Agent 茶话会</div>
        <p className="boot-note"><Loader2 size={15} className="spin" /> 正在整理茶会的座位…</p>
      </div>
    )
  }

  if (bootError) {
    return (
      <div className="boot-screen error">
        <div className="boot-error-icon"><AlertTriangle size={28} /></div>
        <h1>茶会还没准备好</h1>
        <p>本地数据初始化失败。可以尝试重启应用；如果问题持续，请检查数据目录的读写权限。</p>
        <pre>{bootError}</pre>
        <button className="btn primary" onClick={() => window.location.reload()}><RotateCcw size={15} /> 重新加载</button>
      </div>
    )
  }

  return (
    <>
      <Toasts />
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<OnboardingGate><ChatPage /></OnboardingGate>} />
        <Route path="/agents" element={<OnboardingGate><AgentsPage /></OnboardingGate>} />
        <Route path="/characters" element={<OnboardingGate><CharactersPage /></OnboardingGate>} />
        <Route path="/persona" element={<OnboardingGate><PersonaPage /></OnboardingGate>} />
        <Route path="/providers" element={<OnboardingGate><ProvidersPage /></OnboardingGate>} />
        <Route path="/stats" element={<OnboardingGate><StatsPage /></OnboardingGate>} />
        <Route path="/memories" element={<OnboardingGate><MemoriesPage /></OnboardingGate>} />
        <Route path="/settings" element={<OnboardingGate><SettingsPage /></OnboardingGate>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
