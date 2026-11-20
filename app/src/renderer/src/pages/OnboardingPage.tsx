import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Agent, ProviderConfig, ProviderTestResult } from '@shared/types'
import { PROVIDER_PRESETS } from '@shared/presets'
import {
  ArrowRight, CheckCircle2, ExternalLink, FlaskConical, Loader2, ShieldCheck,
  SkipForward, Sparkles, XCircle
} from 'lucide-react'
import { useApp } from '../store'
import { PersonaStudio } from '../components/PersonaStudio'

type Stage = 'api' | 'agent'

export function OnboardingPage() {
  const navigate = useNavigate()
  const providers = useApp((s) => s.providers)
  const rooms = useApp((s) => s.rooms)
  const refreshAll = useApp((s) => s.refreshAll)
  const toast = useApp((s) => s.toast)

  const [stage, setStage] = useState<Stage>('api')
  const [presetId, setPresetId] = useState('deepseek')
  const [name, setName] = useState('DeepSeek')
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com/v1')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('deepseek-chat')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState<ProviderConfig | null>(null)
  const [result, setResult] = useState<ProviderTestResult | null>(null)
  const [showKey, setShowKey] = useState(false)

  const preset = useMemo(() => PROVIDER_PRESETS.find((p) => p.id === presetId), [presetId])

  function applyPreset(id: string) {
    setPresetId(id)
    const p = PROVIDER_PRESETS.find((x) => x.id === id)
    if (!p) return
    setName(p.name)
    setBaseUrl(p.baseUrl)
    setModel(p.models[0] ?? '')
    setResult(null)
    setSaved(null)
  }

  async function saveProvider(apiKeyOverride?: string): Promise<ProviderConfig | null> {
    if (!name.trim() || (!baseUrl.trim() && presetId !== 'mock')) { toast('请填写 Provider 名称和 Base URL', 'error'); return null }
    const res = await window.tea.saveProvider({
      name: name.trim(), preset: presetId, kind: preset?.kind ?? 'openai', baseUrl: baseUrl.trim(),
      models: Array.from(new Set([model.trim(), ...(preset?.models ?? [])].filter(Boolean))),
      enabled: true, isLocal: Boolean(preset?.isLocal), allowPrivateNetwork: Boolean(preset?.isLocal),
      note: preset?.note ?? ''
    }, apiKeyOverride ?? (apiKey.trim() || undefined))
    if (!res.ok) { toast(res.error, 'error'); return null }
    setApiKey('')
    await refreshAll()
    return res.data
  }

  async function testAndSave() {
    setTesting(true)
    setResult(null)
    try {
      const p = await saveProvider()
      if (!p) return
      setSaved(p)
      const r = await window.tea.testProvider(p.id)
      setResult(r)
      if (r.ok && r.generation) toast('真实连接测试通过，可以开始创建她', 'success')
      else if (r.ok) toast('服务可达，但生成探测未通过，请检查模型 ID', 'info')
      else toast('连接测试未通过，详情见下方', 'error')
    } finally {
      setTesting(false)
    }
  }

  async function useDemo() {
    setSaving(true)
    try {
      const existing = providers.find((p) => p.kind === 'mock')
      let p: ProviderConfig | null = existing ?? null
      if (!p) {
        const res = await window.tea.saveProvider({
          name: '演示模式（模拟回复）', preset: 'mock', kind: 'mock', baseUrl: '',
          models: ['demo-model'], enabled: true, isLocal: false, allowPrivateNetwork: false,
          note: '本地模拟回复，不调用任何真实模型，仅用于体验界面'
        })
        if (!res.ok) { toast(res.error, 'error'); return }
        p = res.data
      }
      await window.tea.updateSettings({ demoMode: true })
      await refreshAll()
      setSaved(p)
      toast('已开启演示模式：回复均为本地模拟，可在设置里关闭', 'info')
      setStage('agent')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreated(agent: Agent) {
    if (!rooms.length) {
      await window.tea.createRoom({
        name: '初次茶会', topic: '第一次见面，先随便聊聊吧', hostAgentId: agent.id, maxRounds: 3, maxTokens: 20000, agentIds: [agent.id]
      })
    }
    await window.tea.updateSettings({ onboarded: true })
    await refreshAll()
    toast(`欢迎 ${agent.name} 来到茶话会`, 'success')
    navigate('/')
  }

  async function skipAll() {
    await window.tea.updateSettings({ onboarded: true })
    navigate('/')
  }

  return (
    <div className="onboarding">
      <div className="onboarding-bg" aria-hidden>
        <span className="blob blob-1" /><span className="blob blob-2" /><span className="blob blob-3" />
      </div>
      <header className="onboarding-top">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={19} /></div>
          <div><h1>Agent 茶话会</h1><p>你的本地多 Agent 聊天工作台</p></div>
        </div>
        <div className="steps">
          <span className={stage === 'api' ? 'active' : 'done'}><i>{stage === 'api' ? '1' : '✓'}</i> 配置模型 API</span>
          <em />
          <span className={stage === 'agent' ? 'active' : ''}><i>2</i> 创建第一位 AI 娘</span>
        </div>
      </header>

      {stage === 'api' ? (
        <main className="onboarding-main">
          <div className="onboarding-heading">
            <div className="eyebrow">STEP 01 · YOUR OWN API</div>
            <h2>先接入你自己的模型</h2>
            <p>Agent 茶话会不提供 API Key，也不会把对话发到我们的服务器。你配置哪家，请求就发往哪家。</p>
          </div>

          <div className="api-layout">
            <aside className="preset-pane">
              <div className="side-section-label">选择 Provider</div>
              <div className="preset-list">
                {PROVIDER_PRESETS.map((p) => (
                  <button key={p.id} className={`preset-row ${presetId === p.id ? 'active' : ''}`} onClick={() => applyPreset(p.id)}>
                    <span><strong>{p.name}</strong><small>{p.kind === 'gemini' ? 'Gemini 协议' : p.kind === 'anthropic' ? 'Anthropic 协议' : 'OpenAI 兼容'}</small></span>
                    {p.isLocal ? <span className="tag">本地</span> : null}
                  </button>
                ))}
              </div>
            </aside>

            <section className="api-form-card">
              <div className="api-form-head">
                <div>
                  <h3>{preset?.name ?? name}</h3>
                  <p>{preset?.note ?? '自定义 OpenAI 兼容服务'}</p>
                </div>
                {preset?.keyUrl ? (
                  <button className="link-line" onClick={() => void window.tea.openExternal(preset.keyUrl!)}><ExternalLink size={14} /> 获取 API Key</button>
                ) : null}
              </div>

              <div className="form-grid two">
                <label className="field"><span>Provider 名称</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
                <label className="field">
                  <span>Model ID</span>
                  <input list="onboard-models" value={model} onChange={(e) => setModel(e.target.value)} placeholder="例如 deepseek-chat" />
                  <datalist id="onboard-models">{(preset?.models ?? []).map((m) => <option key={m} value={m} />)}</datalist>
                </label>
              </div>
              <label className="field"><span>API Base URL</span><input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} spellCheck={false} placeholder="https://api.example.com/v1" /></label>
              <label className="field">
                <span className="field-row"><span>API Key</span><span className="hint"><ShieldCheck size={12} /> 使用 Windows DPAPI 加密保存</span></span>
                <div className="key-row">
                  <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={saved?.hasKey ? '已保存，留空不修改' : 'sk-...'} autoComplete="off" spellCheck={false} />
                  <button className="btn ghost tiny-btn" onClick={() => setShowKey((v) => !v)}>{showKey ? '隐藏' : '显示'}</button>
                </div>
              </label>

              <div className="notice soft">
                <ShieldCheck size={16} />
                <p>连接测试会真实请求你填写的地址：先拉取模型列表，再做一次极短的真实生成探测。测试结果不会伪造；连接成功不等于模型一定可用，两项都通过才最稳妥。</p>
              </div>

              {result ? (
                <div className={`test-result ${result.ok ? 'ok' : 'bad'}`}>
                  <div className="test-result-head">
                    {result.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    <strong>{result.ok ? '连接成功' : '连接失败'}</strong>
                    <span className="hint">{result.latencyMs} ms{result.httpStatus ? ` · HTTP ${result.httpStatus}` : ''}</span>
                  </div>
                  <p>{result.detail}</p>
                  <div className="test-flags">
                    <span className={result.reachable ? 'flag ok' : 'flag bad'}>服务可达 {result.reachable ? '✓' : '✕'}</span>
                    <span className={result.generation ? 'flag ok' : 'flag bad'}>真实生成 {result.generation ? '✓' : '✕'}</span>
                  </div>
                </div>
              ) : null}

              <div className="api-actions">
                <button className="btn ghost" onClick={() => setStage('agent')}><SkipForward size={15} /> 暂时跳过</button>
                <button className="btn soft" onClick={() => void useDemo()} disabled={saving || testing}><Sparkles size={15} /> 没有 Key，用演示模式</button>
                <button className="btn primary" onClick={() => void testAndSave()} disabled={testing || saving}>
                  {testing ? <Loader2 size={15} className="spin" /> : <FlaskConical size={15} />} 保存并测试
                </button>
                <button className="btn primary" onClick={() => setStage('agent')} disabled={!saved && !providers.length}>
                  下一步 <ArrowRight size={15} />
                </button>
              </div>
              {!saved && !providers.length ? <p className="hint center">也可以先跳过，但人格生成和在线聊天需要有效的模型配置</p> : null}
            </section>
          </div>
        </main>
      ) : (
        <main className="onboarding-main wide">
          <div className="onboarding-heading">
            <div className="eyebrow">STEP 02 · MEET YOUR AGENT</div>
            <h2>创建第一位 AI 娘</h2>
            <p>从社区预设快速开始，或者用十道题、Markdown、自由输入慢慢写下她。创建后仍可以随时修改。</p>
          </div>
          <PersonaStudio onCreated={(agent) => void handleCreated(agent)} onConfigProvider={() => setStage('api')} initialMode="characters" />
          <div className="onboarding-skip">
            <button className="link-line" onClick={() => void skipAll()}><SkipForward size={13} /> 先进入茶会，稍后再创建 Agent</button>
          </div>
        </main>
      )}
    </div>
  )
}
