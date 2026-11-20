import { useMemo, useState } from 'react'
import type { Agent } from '@shared/types'
import { ImagePlus, Loader2, Save, WandSparkles } from 'lucide-react'
import { useApp } from '../store'
import { Modal } from './Modal'
import { Avatar } from './Avatar'

interface Props {
  agent?: Agent | null
  onClose: () => void
  onSaved?: (agent: Agent) => void
}

export function AgentEditor({ agent, onClose, onSaved }: Props) {
  const providers = useApp((s) => s.providers)
  const toast = useApp((s) => s.toast)
  const refreshAll = useApp((s) => s.refreshAll)
  const [name, setName] = useState(agent?.name ?? '')
  const [summary, setSummary] = useState(agent?.summary ?? '')
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt ?? '')
  const [providerId, setProviderId] = useState(agent?.providerId ?? providers[0]?.id ?? '')
  const [modelId, setModelId] = useState(agent?.modelId ?? '')
  const [temperature, setTemperature] = useState(agent?.temperature ?? 0.8)
  const [maxTokens, setMaxTokens] = useState(agent?.maxTokens ?? 900)
  const [memoryEnabled, setMemoryEnabled] = useState(agent?.memoryEnabled ?? true)
  const [greeting, setGreeting] = useState(agent?.greeting ?? '')
  const [avatarPath, setAvatarPath] = useState<string | null>(agent?.avatarPath ?? null)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)

  const provider = useMemo(() => providers.find((p) => p.id === providerId), [providers, providerId])

  async function pickAvatar() {
    setPicking(true)
    try {
      const picked = await window.tea.chooseAvatar()
      if (picked.ok && picked.sourcePath) {
        const imported = await window.tea.importAvatar(picked.sourcePath)
        if (imported.ok) setAvatarPath(imported.data)
        else toast(imported.error, 'error')
      } else if (picked.error) {
        toast(picked.error, 'error')
      }
    } finally {
      setPicking(false)
    }
  }

  async function save() {
    if (!name.trim()) { toast('先给她取个名字吧', 'error'); return }
    if (!systemPrompt.trim()) { toast('人格设定不能为空', 'error'); return }
    setSaving(true)
    try {
      const res = await window.tea.saveAgent({
        id: agent?.id,
        name: name.trim(),
        avatarPath,
        summary: summary.trim(),
        systemPrompt: systemPrompt.trim(),
        providerId: providerId || null,
        modelId: modelId || null,
        temperature,
        maxTokens,
        memoryEnabled,
        greeting: greeting.trim(),
        sourceCharacter: agent?.sourceCharacter ?? null
      })
      if (!res.ok) { toast(res.error, 'error'); return }
      toast(agent ? 'Agent 已更新' : 'Agent 已创建', 'success')
      await refreshAll()
      onSaved?.(res.data)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={agent ? '编辑 Agent' : '新建 Agent'}
      subtitle="人格、模型与头像互相独立，换模型不会丢掉她的记忆"
      onClose={onClose}
      width={680}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>取消</button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
            保存
          </button>
        </>
      }
    >
      <div className="agent-editor-top">
        <div className="avatar-picker">
          <Avatar name={name || '新朋友'} path={avatarPath} size={76} glow />
          <button className="mini-action" onClick={pickAvatar} disabled={picking}>
            {picking ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} 更换头像
          </button>
        </div>
        <div className="grow">
          <label className="field">
            <span>名字</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="比如：GPT 娘" maxLength={40} />
          </label>
          <label className="field">
            <span>一句话简介</span>
            <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="她是个什么样的孩子？" maxLength={120} />
          </label>
        </div>
      </div>

      <div className="form-grid two">
        <label className="field">
          <span>Provider</span>
          <select value={providerId} onChange={(e) => { setProviderId(e.target.value); setModelId('') }}>
            <option value="">未绑定（稍后设置）</option>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isLocal ? ' · 本地' : ''}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Model ID</span>
          <input list="agent-model-options" value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="模型 ID" />
          <datalist id="agent-model-options">
            {(provider?.models ?? []).map((m) => <option key={m} value={m} />)}
          </datalist>
        </label>
      </div>

      <div className="form-grid three">
        <label className="field">
          <span>Temperature · {temperature.toFixed(2)}</span>
          <input type="range" min={0} max={1.5} step={0.05} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Max Tokens</span>
          <input type="number" min={64} max={8000} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} />
        </label>
        <label className="field checkbox-field">
          <span>独立记忆</span>
          <label className="switch-row">
            <input type="checkbox" checked={memoryEnabled} onChange={(e) => setMemoryEnabled(e.target.checked)} />
            <span>{memoryEnabled ? '已开启' : '已关闭'}</span>
          </label>
        </label>
      </div>

      <label className="field">
        <span>开场白（可选）</span>
        <input value={greeting} onChange={(e) => setGreeting(e.target.value)} placeholder="第一次见面时她说的第一句话" maxLength={200} />
      </label>

      <label className="field">
        <span className="field-row"><span>System Prompt / 人格设定</span><span className="hint"><WandSparkles size={12} /> 支持 Markdown</span></span>
        <textarea className="tall" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="写下她的身份、性格、说话方式和边界……" />
      </label>
    </Modal>
  )
}
