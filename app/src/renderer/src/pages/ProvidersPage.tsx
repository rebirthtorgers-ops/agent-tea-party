import { useState } from 'react'
import type { ProviderConfig, ProviderTestResult } from '@shared/types'
import { CheckCircle2, Cpu, FlaskConical, KeyRound, Loader2, Pencil, Plus, ShieldCheck, Trash2, XCircle } from 'lucide-react'
import { useApp } from '../store'
import { PageShell } from '../components/PageShell'
import { ProviderModal } from '../components/ProviderModal'
import { Modal } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'

export function ProvidersPage() {
  const providers = useApp((s) => s.providers)
  const agents = useApp((s) => s.agents)
  const settings = useApp((s) => s.settings)
  const toast = useApp((s) => s.toast)
  const refreshAll = useApp((s) => s.refreshAll)
  const [editing, setEditing] = useState<ProviderConfig | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<ProviderConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, ProviderTestResult>>({})

  async function test(provider: ProviderConfig) {
    setTestingId(provider.id)
    try {
      const res = await window.tea.testProvider(provider.id)
      setResults((prev) => ({ ...prev, [provider.id]: res }))
      toast(res.ok ? (res.generation ? `${provider.name} 连接与生成测试通过` : `${provider.name} 可达，但生成探测未通过`) : `${provider.name} 连接失败`, res.ok ? 'success' : 'error')
    } finally {
      setTestingId(null)
    }
  }

  async function toggle(provider: ProviderConfig) {
    const res = await window.tea.saveProvider({
      id: provider.id, name: provider.name, preset: provider.preset, kind: provider.kind,
      baseUrl: provider.baseUrl, models: provider.models, enabled: !provider.enabled,
      isLocal: provider.isLocal, allowPrivateNetwork: provider.allowPrivateNetwork, note: provider.note
    })
    if (!res.ok) { toast(res.error, 'error'); return }
    await refreshAll()
    toast(provider.enabled ? `${provider.name} 已停用` : `${provider.name} 已启用`, 'success')
  }

  async function removeKey(provider: ProviderConfig) {
    const res = await window.tea.removeProviderKey(provider.id)
    if (!res.ok) { toast(res.error, 'error'); return }
    await refreshAll()
    toast('已删除本地加密保存的 Key', 'success')
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      const res = await window.tea.deleteProvider(deleting.id)
      if (!res.ok) { toast(res.error, 'error'); return }
      await refreshAll()
      toast('Provider 已删除，Key 也从本地清除', 'success')
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell
      title="模型与 API"
      eyebrow="MODEL PROVIDERS"
      subtitle="你自己的 API Key，只保存在本机。支持在线 Provider 与本地 / 局域网推理服务；这里不会安装或启动任何模型。"
      actions={<button className="btn primary" onClick={() => setCreating(true)}><Plus size={16} /> 添加 Provider</button>}
      wide
    >
      <div className="security-banner">
        <ShieldCheck size={18} />
        <div>
          <strong>Key 存在 Windows 凭据保护里</strong>
          <p>使用 Electron safeStorage / DPAPI 加密后写入 credentials.vault，不进入普通 JSON、聊天记录或日志。导出备份不包含 Key。</p>
        </div>
      </div>

      {settings.demoMode ? (
        <div className="notice warn"><p>演示模式已开启：所有回复来自本地模拟，不会调用真实模型。你随时可以在设置里关闭。</p></div>
      ) : null}

      {providers.length ? (
        <div className="provider-grid">
          {providers.map((provider) => {
            const result = results[provider.id]
            const bound = agents.filter((a) => a.providerId === provider.id).length
            return (
              <article key={provider.id} className={`provider-card ${provider.enabled ? '' : 'disabled'}`}>
                <div className="provider-head">
                  <span className="provider-icon"><Cpu size={19} /></span>
                  <div>
                    <h3>{provider.name}</h3>
                    <p>{provider.isLocal ? '本地 / 局域网' : provider.kind === 'openai' ? 'OpenAI 兼容' : provider.kind === 'anthropic' ? 'Anthropic' : provider.kind === 'gemini' ? 'Gemini' : '演示（模拟）'}</p>
                  </div>
                  <button className={`switch ${provider.enabled ? 'on' : ''}`} onClick={() => void toggle(provider)} title={provider.enabled ? '停用' : '启用'}><span /></button>
                </div>
                <div className="provider-url">{provider.baseUrl || '本地模拟，无网络地址'}</div>
                <div className="provider-meta">
                  <span className={`key-state ${provider.hasKey ? 'ok' : ''}`}><KeyRound size={12} /> {provider.kind === 'mock' ? '无需 Key' : provider.hasKey ? 'Key 已加密保存' : '未保存 Key'}</span>
                  <span>{bound} 位 Agent 使用</span>
                </div>
                <div className="tag-row">{(provider.models ?? []).slice(0, 4).map((m) => <span key={m} className="tag mono">{m}</span>)}{(provider.models ?? []).length > 4 ? <span className="tag">+{provider.models.length - 4}</span> : null}</div>
                {result ? (
                  <div className={`inline-result ${result.ok ? 'ok' : 'bad'}`}>
                    {result.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    <span>{result.detail}</span>
                  </div>
                ) : null}
                <div className="provider-actions">
                  <button className="btn ghost tiny-btn" onClick={() => void test(provider)} disabled={testingId === provider.id}>
                    {testingId === provider.id ? <Loader2 size={13} className="spin" /> : <FlaskConical size={13} />} 测试
                  </button>
                  <button className="btn ghost tiny-btn" onClick={() => setEditing(provider)}><Pencil size={13} /> 编辑</button>
                  {provider.hasKey ? <button className="btn ghost tiny-btn" onClick={() => void removeKey(provider)}>清除 Key</button> : null}
                  <button className="icon-btn ghost tiny danger-text" onClick={() => setDeleting(provider)}><Trash2 size={13} /></button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Cpu size={30} />}
          title="还没有配置模型"
          description="接入 OpenAI、DeepSeek、Gemini、Claude，或你本机已经在运行的 Ollama / LM Studio"
          action={<button className="btn primary" onClick={() => setCreating(true)}><Plus size={16} /> 添加第一个 Provider</button>}
        />
      )}

      <div className="page-note">费用按公开单价估算；真实计费以各供应商账单为准。连接测试失败时应用不会伪造成功状态。</div>

      {creating ? <ProviderModal onClose={() => setCreating(false)} /> : null}
      {editing ? <ProviderModal provider={editing} onClose={() => setEditing(null)} /> : null}

      {deleting ? (
      <Modal
        title="删除这个 Provider？"
        subtitle="本地加密保存的 API Key 也会一起删除"
        onClose={() => setDeleting(null)}
        width={440}
        footer={
          <>
            <button className="btn ghost" onClick={() => setDeleting(null)} disabled={busy}>取消</button>
            <button className="btn danger" onClick={() => void confirmDelete()} disabled={busy}>
              {busy ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} 删除
            </button>
          </>
        }
      >
        <p>「{deleting?.name}」删除后，使用它的 Agent 会显示未绑定模型，但人格与头像不会丢失。</p>
      </Modal>
      ) : null}
    </PageShell>
  )
}
