import { useMemo, useState } from 'react'
import type { ProviderConfig, ProviderKind, ProviderTestResult } from '@shared/types'
import { PROVIDER_PRESETS, KIND_LABELS } from '@shared/presets'
import { CheckCircle2, ExternalLink, FlaskConical, Loader2, Save, ShieldAlert, XCircle } from 'lucide-react'
import { useApp } from '../store'
import { Modal } from './Modal'

interface Props {
  provider?: ProviderConfig | null
  onClose: () => void
  onSaved?: (provider: ProviderConfig) => void
}

export function ProviderModal({ provider, onClose, onSaved }: Props) {
  const toast = useApp((s) => s.toast)
  const refreshAll = useApp((s) => s.refreshAll)
  const [presetId, setPresetId] = useState(provider?.preset ?? 'openai')
  const [name, setName] = useState(provider?.name ?? '')
  const [kind, setKind] = useState<ProviderKind>(provider?.kind ?? 'openai')
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '')
  const [modelsText, setModelsText] = useState((provider?.models ?? []).join(', '))
  const [apiKey, setApiKey] = useState('')
  const [isLocal, setIsLocal] = useState(provider?.isLocal ?? false)
  const [allowPrivateNetwork, setAllowPrivateNetwork] = useState(provider?.allowPrivateNetwork ?? false)
  const [note, setNote] = useState(provider?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<ProviderTestResult | null>(null)
  const [fetching, setFetching] = useState(false)

  const preset = useMemo(() => PROVIDER_PRESETS.find((p) => p.id === presetId), [presetId])
  const editing = Boolean(provider)

  function applyPreset(id: string) {
    setPresetId(id)
    const p = PROVIDER_PRESETS.find((x) => x.id === id)
    if (!p) return
    setName(p.name)
    setKind(p.kind)
    setBaseUrl(p.baseUrl)
    setModelsText(p.models.join(', '))
    setIsLocal(Boolean(p.isLocal))
    setNote(p.note)
    setResult(null)
  }

  async function persist(): Promise<ProviderConfig | null> {
    if (!name.trim()) { toast('Provider 名称不能为空', 'error'); return null }
    if (!baseUrl.trim()) { toast('API Base URL 不能为空', 'error'); return null }
    setSaving(true)
    try {
      const res = await window.tea.saveProvider({
        id: provider?.id,
        name: name.trim(),
        preset: presetId,
        kind,
        baseUrl: baseUrl.trim(),
        models: modelsText.split(',').map((s) => s.trim()).filter(Boolean),
        enabled: provider?.enabled ?? true,
        isLocal,
        allowPrivateNetwork,
        note: note.trim()
      }, apiKey.trim() || undefined)
      if (!res.ok) { toast(res.error, 'error'); return null }
      setApiKey('')
      await refreshAll()
      return res.data
    } finally {
      setSaving(false)
    }
  }

  async function save() {
    const saved = await persist()
    if (!saved) return
    toast(provider ? 'Provider 已更新' : 'Provider 已添加', 'success')
    onSaved?.(saved)
    onClose()
  }

  async function test() {
    setTesting(true)
    setResult(null)
    try {
      const saved = await persist()
      if (!saved) return
      const res = await window.tea.testProvider(saved.id)
      setResult(res)
      if (res.ok) toast(res.generation ? '连接与生成测试均通过' : '服务可达，但生成探测未通过', res.generation ? 'success' : 'info')
      else toast('连接测试未通过，详情见面板', 'error')
      await refreshAll()
    } finally {
      setTesting(false)
    }
  }

  async function fetchModels() {
    const saved = await persist()
    if (!saved) return
    setFetching(true)
    try {
      const res = await window.tea.fetchModels(saved.id)
      if (res.ok) {
        setModelsText(res.models.join(', '))
        toast(`拉取到 ${res.models.length} 个模型`, 'success')
      } else {
        toast(res.detail, 'error')
      }
    } finally {
      setFetching(false)
    }
  }

  return (
    <Modal
      title={editing ? `编辑 ${provider?.name}` : '添加模型 Provider'}
      subtitle="API Key 使用系统凭据（Windows DPAPI）加密保存，不写入聊天记录或日志"
      onClose={onClose}
      width={700}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>取消</button>
          <button className="btn soft" onClick={test} disabled={saving || testing}>
            {testing ? <Loader2 size={16} className="spin" /> : <FlaskConical size={16} />} 保存并测试
          </button>
          <button className="btn primary" onClick={save} disabled={saving || testing}>
            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} 保存
          </button>
        </>
      }
    >
      {!editing ? (
        <div className="field">
          <span>快速选择</span>
          <div className="preset-grid">
            {PROVIDER_PRESETS.map((p) => (
              <button key={p.id} className={`preset-chip ${presetId === p.id ? 'active' : ''}`} onClick={() => applyPreset(p.id)}>
                <strong>{p.name}</strong>
                {p.isLocal ? <small>本地</small> : null}
              </button>
            ))}
          </div>
          {preset?.note ? <p className="hint">{preset.note}</p> : null}
        </div>
      ) : null}

      <div className="form-grid two">
        <label className="field">
          <span>显示名称</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：DeepSeek 官方" />
        </label>
        <label className="field">
          <span>接口协议</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as ProviderKind)}>
            {(Object.keys(KIND_LABELS) as ProviderKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
        </label>
      </div>

      <label className="field">
        <span>API Base URL</span>
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" spellCheck={false} />
        <span className="hint">自定义地址会经过 SSRF 校验，默认禁止私网与云元数据地址</span>
      </label>

      <label className="field">
        <span>API Key {editing ? <em className="hint">{provider?.hasKey ? '（已加密保存，留空表示不修改）' : '（尚未保存）'}</em> : null}</span>
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={provider?.hasKey ? '••••••••（留空不修改）' : 'sk-...'} spellCheck={false} autoComplete="off" />
      </label>

      <label className="field">
        <span className="field-row">
          <span>模型列表（逗号分隔）</span>
          <button className="mini-action" onClick={fetchModels} disabled={fetching || saving}>
            {fetching ? <Loader2 size={12} className="spin" /> : null} 从服务拉取
          </button>
        </span>
        <input value={modelsText} onChange={(e) => setModelsText(e.target.value)} placeholder="deepseek-chat, deepseek-reasoner" />
      </label>

      <div className="form-grid two check-grid">
        <label className="check-line">
          <input type="checkbox" checked={isLocal} onChange={(e) => setIsLocal(e.target.checked)} />
          <span>本地 / 局域网服务（允许私网地址）</span>
        </label>
        <label className="check-line">
          <input type="checkbox" checked={allowPrivateNetwork} onChange={(e) => setAllowPrivateNetwork(e.target.checked)} />
          <span>显式允许私网地址（高级）</span>
        </label>
      </div>

      {isLocal ? (
        <div className="notice soft">
          <ShieldAlert size={16} />
          <p>这里只负责连接你已经在运行的模型服务，不会安装、下载或启动任何本地模型。连接到局域网或远程地址意味着对话数据会发送到该地址。</p>
        </div>
      ) : null}

      {preset?.keyUrl ? (
        <button className="link-line" onClick={() => void window.tea.openExternal(preset.keyUrl!)}>
          <ExternalLink size={14} /> 打开 {preset.name} API Key 页面
        </button>
      ) : null}

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
          {result.models.length ? <p className="hint">可用模型：{result.models.slice(0, 12).join('、')}{result.models.length > 12 ? '…' : ''}</p> : null}
        </div>
      ) : null}
    </Modal>
  )
}
