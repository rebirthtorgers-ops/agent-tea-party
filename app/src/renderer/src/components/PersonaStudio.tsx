import { useEffect, useMemo, useState } from 'react'
import type { Agent, CharacterPack, PersonaResult, ProviderConfig } from '@shared/types'
import { PERSONA_QUESTIONS, suggestedNameFromMarkdown } from '@shared/persona'
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, FileText, ImagePlus, Loader2,
  MessageCircleQuestion, PenLine, Sparkles, Upload, Users, WandSparkles
} from 'lucide-react'
import { useApp } from '../store'
import { Modal } from './Modal'
import { Avatar } from './Avatar'
import { MarkdownView } from './MarkdownView'

type Mode = 'characters' | 'questions' | 'markdown' | 'free'
type GenMode = 'questions' | 'markdown' | 'free'

interface PreviewState {
  markdown: string
  name: string
  avatarPath: string | null
  sourceCharacter: string | null
  providerId: string
  modelId: string
  generated: boolean
}

interface Props {
  onCreated: (agent: Agent) => void
  onConfigProvider?: () => void
  initialMode?: Mode
}

const MODE_META: { id: Mode; label: string; desc: string; icon: typeof Users }[] = [
  { id: 'characters', label: '社区娘化 AI', desc: '开箱即用的本地角色模板', icon: Users },
  { id: 'questions', label: '十道题', desc: '一问一答，慢慢捏出她', icon: MessageCircleQuestion },
  { id: 'markdown', label: '导入 Markdown', desc: '把你写好的设定交给她', icon: FileText },
  { id: 'free', label: '自由输入', desc: '直接粘贴完整人格', icon: PenLine }
]

export function PersonaStudio({ onCreated, onConfigProvider, initialMode = 'characters' }: Props) {
  const providers = useApp((s) => s.providers)
  const characters = useApp((s) => s.characters)
  const loadCharacters = useApp((s) => s.loadCharacters)
  const toast = useApp((s) => s.toast)
  const refreshAll = useApp((s) => s.refreshAll)

  const [mode, setMode] = useState<Mode>(initialMode)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [freeText, setFreeText] = useState('')
  const [markdownText, setMarkdownText] = useState('')
  const [markdownName, setMarkdownName] = useState('')
  const [freeAnswers, setFreeAnswers] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [previewTab, setPreviewTab] = useState<'edit' | 'view'>('view')
  const [providerId, setProviderId] = useState(() => providers.find((p) => p.hasKey)?.id ?? providers[0]?.id ?? '')
  const [modelId, setModelId] = useState('')
  const [costOpen, setCostOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [detail, setDetail] = useState<CharacterPack | null>(null)
  const [creating, setCreating] = useState(false)
  const [charProvider, setCharProvider] = useState('')
  const [charModel, setCharModel] = useState('')

  useEffect(() => { if (!characters.length) void loadCharacters() }, [characters.length])

  const provider = useMemo<ProviderConfig | undefined>(() => providers.find((p) => p.id === providerId), [providers, providerId])

  useEffect(() => {
    if (!providerId && providers.length) setProviderId(providers[0].id)
  }, [providers.length])

  useEffect(() => {
    if (!modelId && provider?.models?.length) setModelId(provider.models[0])
  }, [providerId, provider?.models])

  async function createFromCharacter(pack: CharacterPack) {
    if (!charProvider || !charModel) { toast('先选择 Provider 和 Model', 'error'); return }
    setCreating(true)
    try {
      const res = await window.tea.createAgentFromCharacter({
        characterId: pack.manifest.id,
        providerId: charProvider,
        modelId: charModel
      })
      if (!res.ok) { toast(res.error, 'error'); return }
      await refreshAll()
      toast(`${res.data.name} 已经入座了`, 'success')
      setDetail(null)
      onCreated(res.data)
    } finally {
      setCreating(false)
    }
  }

  function openCharacter(pack: CharacterPack) {
    setDetail(pack)
    const preferred = providers.find((p) => p.preset === pack.manifest.defaultProvider && p.hasKey)
      ?? providers.find((p) => p.hasKey) ?? providers[0]
    setCharProvider(preferred?.id ?? '')
    setCharModel(preferred?.models?.find((m) => m === pack.manifest.defaultModel) ?? preferred?.models?.[0] ?? pack.manifest.defaultModel ?? '')
  }

  function setSelected(qid: string, value: string, multi: boolean) {
    setAnswers((prev) => {
      const current = prev[qid] ?? []
      const next = multi
        ? (current.includes(value) ? current.filter((v) => v !== value) : [...current, value])
        : [value]
      return { ...prev, [qid]: next }
    })
  }

  function compiledAnswers(): Record<string, string[]> {
    const out: Record<string, string[]> = {}
    for (const q of PERSONA_QUESTIONS) {
      const selected = answers[q.id] ?? []
      const free = freeAnswers[q.id]?.trim()
      if (selected.length) out[q.id] = selected
      if (free) out[q.id] = [...(out[q.id] ?? []), free]
    }
    return out
  }

  async function importMarkdown() {
    const res = await window.tea.readMarkdownFile()
    if (!res.ok) { toast(res.error ?? '读取失败', 'error'); return }
    if (res.canceled) return
    setMarkdownText(res.content ?? '')
    setMarkdownName(res.name ?? '')
    toast('Markdown 已在本地读取，尚未上传', 'success')
  }

  function startPreview(markdown: string, name: string, generated: boolean, sourceCharacter?: string | null) {
    setPreview({
      markdown,
      name: name || suggestedNameFromMarkdown(markdown),
      avatarPath: null,
      sourceCharacter: sourceCharacter ?? null,
      providerId: generated ? providerId : '',
      modelId: generated ? modelId : '',
      generated
    })
    setPreviewTab('view')
    setCostOpen(false)
    setGenerating(false)
  }

  async function generate(genMode: GenMode) {
    if (!providerId || !modelId) {
      toast('请先选择一个可用的 Provider 和 Model', 'error')
      return
    }
    setCostOpen(false)
    setGenerating(true)
    setGenError(null)
    try {
      const input = genMode === 'questions'
        ? { mode: genMode, answers: compiledAnswers(), providerId, modelId, agentNameHint: '' }
        : { mode: genMode, rawText: genMode === 'markdown' ? markdownText : freeText, providerId, modelId, agentNameHint: genMode === 'markdown' ? markdownName : '' }
      const res = await window.tea.generatePersona(input, true)
      if (!res.ok) { setGenError(res.error); toast('人格生成失败', 'error'); return }
      const data: PersonaResult = res.data
      startPreview(data.markdown, data.suggestedName, true)
      toast('人格草稿已生成，请确认或继续修改', 'success')
    } finally {
      setGenerating(false)
    }
  }

  function useExistingMarkdown() {
    if (!markdownText.trim()) { toast('先导入或粘贴一份人格 Markdown', 'error'); return }
    startPreview(markdownText, suggestedNameFromMarkdown(markdownText, markdownName || '新朋友'), false)
  }

  async function pickPreviewAvatar() {
    const picked = await window.tea.chooseAvatar()
    if (!picked.ok) { if (picked.error) toast(picked.error, 'error'); return }
    if (!picked.sourcePath) return
    const imported = await window.tea.importAvatar(picked.sourcePath)
    if (!imported.ok) { toast(imported.error, 'error'); return }
    setPreview((p) => p ? { ...p, avatarPath: imported.data } : p)
  }

  async function exportMarkdown() {
    if (!preview) return
    const res = await window.tea.saveMarkdown(preview.name || 'persona', preview.markdown)
    if (res.ok) toast(`已导出到 ${res.data}`, 'success')
    else if (res.error) toast(res.error, 'error')
  }

  async function deploy() {
    if (!preview) return
    if (!preview.name.trim()) { toast('她还没有名字', 'error'); return }
    setDeploying(true)
    try {
      const res = await window.tea.saveAgent({
        name: preview.name.trim(),
        avatarPath: preview.avatarPath,
        summary: preview.markdown.replace(/^#.*$/m, '').replace(/[*#>`]/g, '').trim().slice(0, 90),
        systemPrompt: preview.markdown,
        providerId: preview.providerId || null,
        modelId: preview.modelId || null,
        temperature: 0.85,
        maxTokens: 900,
        memoryEnabled: true,
        greeting: '',
        sourceCharacter: preview.sourceCharacter
      })
      if (!res.ok) { toast(res.error, 'error'); return }
      await refreshAll()
      toast(`${res.data.name} 已经入座了`, 'success')
      setConfirmOpen(false)
      setPreview(null)
      onCreated(res.data)
    } finally {
      setDeploying(false)
    }
  }

  function resetQuestions() {
    setAnswers({})
    setFreeAnswers({})
    setStep(0)
  }

  const activeQuestion = PERSONA_QUESTIONS[step]
  const answeredCount = Object.values(answers).filter((v) => v.length > 0).length

  const modelPicker = (pid: string, mid: string, onP: (v: string) => void, onM: (v: string) => void) => {
    const p = providers.find((x) => x.id === pid)
    return (
      <div className="model-picker">
        <label className="field">
          <span>Provider</span>
          <select value={pid} onChange={(e) => { onP(e.target.value); const np = providers.find((x) => x.id === e.target.value); onM(np?.models?.[0] ?? '') }}>
            <option value="">选择 Provider</option>
            {providers.map((x) => <option key={x.id} value={x.id}>{x.name}{x.isLocal ? ' · 本地' : ''}{x.hasKey ? '' : ' · 无 Key'}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Model</span>
          <input list="persona-model-list" value={mid} onChange={(e) => onM(e.target.value)} placeholder="模型 ID" />
          <datalist id="persona-model-list">{(p?.models ?? []).map((m) => <option key={m} value={m} />)}</datalist>
        </label>
      </div>
    )
  }

  const communityCharacters = characters.filter((pack) => pack.manifest.collection)
  const originalCharacters = characters.filter((pack) => !pack.manifest.collection)

  const renderCharacterCard = (pack: CharacterPack) => (
    <article key={pack.manifest.id} className="character-card" onClick={() => openCharacter(pack)}>
      <div className="character-cover">
        <img src={pack.avatarUrl} alt={pack.manifest.name} draggable={false} />
        <span className="badge">{pack.manifest.aiModel ?? `v${pack.manifest.version}`}</span>
      </div>
      <div className="character-body">
        <h4>{pack.manifest.name}</h4>
        <p>{pack.manifest.description}</p>
        <div className="tag-row">{(pack.manifest.tags ?? []).slice(0, 4).map((t) => <span key={t} className="tag">{t}</span>)}</div>
        <button className="btn soft full">查看人格 <ChevronRight size={14} /></button>
      </div>
    </article>
  )

  return (
    <div className="persona-studio">
      <div className="mode-tabs">
        {MODE_META.map((m) => {
          const Icon = m.icon
          return (
            <button key={m.id} className={`mode-tab ${mode === m.id ? 'active' : ''}`} onClick={() => { setMode(m.id); setPreview(null) }}>
              <Icon size={18} />
              <span><strong>{m.label}</strong><small>{m.desc}</small></span>
            </button>
          )
        })}
      </div>

      {!providers.length ? (
        <div className="notice">
          <Sparkles size={16} />
          <p>还没有配置模型 Provider。浏览社区预设和编辑人格不受影响，但「用模型生成人格」和在线聊天需要先配置。{onConfigProvider ? <button className="link-inline" onClick={onConfigProvider}>去配置 →</button> : null}</p>
        </div>
      ) : null}

      {preview ? (
        <section className="preview-panel">
          <header className="preview-head">
            <div className="preview-identity">
              <div className="avatar-picker small">
                <Avatar name={preview.name} path={preview.avatarPath} size={62} glow />
                <button className="mini-action" onClick={pickPreviewAvatar}><ImagePlus size={12} /> 头像</button>
              </div>
              <label className="field">
                <span>她的名字</span>
                <input value={preview.name} onChange={(e) => setPreview({ ...preview, name: e.target.value })} maxLength={40} />
              </label>
            </div>
            <div className="preview-actions">
              <button className="btn ghost" onClick={() => setPreview(null)}><ArrowLeft size={15} /> 返回修改</button>
              <button className="btn ghost" onClick={exportMarkdown}><FileText size={15} /> 导出</button>
              {preview.generated ? <button className="btn soft" onClick={() => setCostOpen(true)} disabled={generating}><WandSparkles size={15} /> 重新生成</button> : null}
            </div>
          </header>

          <div className="segment">
            <button className={previewTab === 'view' ? 'active' : ''} onClick={() => setPreviewTab('view')}>预览</button>
            <button className={previewTab === 'edit' ? 'active' : ''} onClick={() => setPreviewTab('edit')}>编辑</button>
          </div>

          {previewTab === 'edit' ? (
            <textarea className="persona-editor" value={preview.markdown} onChange={(e) => setPreview({ ...preview, markdown: e.target.value })} spellCheck={false} />
          ) : (
            <div className="persona-preview-scroll"><MarkdownView content={preview.markdown} /></div>
          )}

          {!preview.providerId ? (
            <div className="inline-provider">
              <span>帮她绑定模型（可稍后在 Agent 管理里设置）</span>
              {modelPicker(preview.providerId, preview.modelId, (v) => setPreview({ ...preview, providerId: v }), (v) => setPreview({ ...preview, modelId: v }))}
            </div>
          ) : null}

          <footer className="preview-foot">
            <p>这就是你期待的她吗？确认后会创建 Agent，之后仍可以随时编辑人格与模型</p>
            <button className="btn primary large" onClick={() => setConfirmOpen(true)}><Check size={17} /> 这就是她，入座吧</button>
          </footer>
        </section>
      ) : null}

      {!preview && mode === 'characters' ? (
        <div className="character-sections">
          {communityCharacters.length ? (
            <section>
              <div className="section-line">
                <h3>社区 AI 娘 · {communityCharacters.length} 位</h3>
                <span className="hint">社区二创设定重绘，非官方；不含 API Key</span>
              </div>
              <div className="character-grid">{communityCharacters.map(renderCharacterCard)}</div>
            </section>
          ) : null}
          {originalCharacters.length ? (
            <section>
              <div className="section-line">
                <h3>原创角色 · {originalCharacters.length} 位</h3>
                <span className="hint">Agent 茶话会原创预设</span>
              </div>
              <div className="character-grid">{originalCharacters.map(renderCharacterCard)}</div>
            </section>
          ) : null}
          {!characters.length ? <p className="hint">没有找到角色包，请检查 resources/characters</p> : null}
        </div>
      ) : null}

      {!preview && mode === 'questions' ? (
        <section className="question-panel">
          <div className="question-top">
            <div>
              <div className="eyebrow">第 {activeQuestion.index} / 10 题 · 已回答 {answeredCount}</div>
              <h3>{activeQuestion.title}</h3>
              <p>{activeQuestion.subtitle}</p>
            </div>
            <button className="btn ghost tiny-btn" onClick={resetQuestions}>重答</button>
          </div>
          <div className="progress-line"><span style={{ width: `${((step + 1) / 10) * 100}%` }} /></div>
          <div className="option-grid">
            {activeQuestion.options.map((opt) => {
              const active = (answers[activeQuestion.id] ?? []).includes(opt.value)
              return (
                <button key={opt.value} className={`option-card ${active ? 'active' : ''}`} onClick={() => setSelected(activeQuestion.id, opt.value, activeQuestion.multi)}>
                  <strong>{opt.label}</strong>
                  {opt.hint ? <small>{opt.hint}</small> : null}
                  <span className="option-mark">{active ? '✓' : ''}</span>
                </button>
              )
            })}
          </div>
          {activeQuestion.allowFreeText ? (
            <label className="field">
              <span>自由补充（可选）</span>
              <textarea value={freeAnswers[activeQuestion.id] ?? ''} onChange={(e) => setFreeAnswers((prev) => ({ ...prev, [activeQuestion.id]: e.target.value }))} rows={3} placeholder={activeQuestion.placeholder} />
            </label>
          ) : null}
          <div className="question-nav">
            <button className="btn ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ArrowLeft size={15} /> 上一题</button>
            {step < 9 ? (
              <button className="btn primary" onClick={() => setStep((s) => Math.min(9, s + 1))}>下一题 <ArrowRight size={15} /></button>
            ) : (
              <button className="btn primary" onClick={() => setCostOpen(true)}><Sparkles size={15} /> 生成完整人格</button>
            )}
          </div>
          <div className="question-dots">
            {PERSONA_QUESTIONS.map((q, i) => (
              <button key={q.id} className={`dot ${i === step ? 'active' : ''} ${(answers[q.id] ?? []).length ? 'done' : ''}`} onClick={() => setStep(i)} title={q.title}>{i + 1}</button>
            ))}
          </div>
          <div className="model-strip">
            <span>生成使用的模型</span>
            {modelPicker(providerId, modelId, setProviderId, setModelId)}
          </div>
        </section>
      ) : null}

      {!preview && mode === 'markdown' ? (
        <section className="markdown-panel">
          <div className="two-col">
            <div className="col-card">
              <h3><Upload size={17} /> 导入 .md 文件</h3>
              <p className="hint">文件只在本地读取，不会自动上传。导入后可以先用模型整理，也可以直接使用。</p>
              <button className="btn soft full" onClick={importMarkdown}><FileText size={15} /> 选择 Markdown 文件</button>
              {markdownName ? <p className="file-chip">{markdownName} · {markdownText.length} 字符</p> : null}
              <label className="field grow-field">
                <span>内容预览 / 直接粘贴</span>
                <textarea className="persona-editor small" value={markdownText} onChange={(e) => setMarkdownText(e.target.value)} placeholder="# 她的名字&#10;……" spellCheck={false} />
              </label>
              {markdownText ? (
                <div className="analysis-line">
                  <BookOpen size={14} /> 检测到 {markdownText.split('\n').filter((l) => l.startsWith('##')).length} 个小节 · {markdownText.length} 字符
                </div>
              ) : null}
              <div className="panel-actions">
                <button className="btn ghost" onClick={useExistingMarkdown} disabled={!markdownText.trim()}>直接使用这份人格</button>
                <button className="btn primary" onClick={() => setCostOpen(true)} disabled={!markdownText.trim()}><WandSparkles size={15} /> 用模型整理</button>
              </div>
            </div>
            <div className="col-card preview-col">
              <h3>实时预览</h3>
              <div className="persona-preview-scroll">{markdownText ? <MarkdownView content={markdownText} /> : <p className="hint">导入或粘贴后在这里预览</p>}</div>
            </div>
          </div>
          <div className="model-strip"><span>整理使用的模型</span>{modelPicker(providerId, modelId, setProviderId, setModelId)}</div>
        </section>
      ) : null}

      {!preview && mode === 'free' ? (
        <section className="free-panel">
          <label className="field">
            <span className="field-row"><span>把她完整地写下来</span><span className="hint">身份、性格、说话方式、边界……都可以</span></span>
            <textarea className="persona-editor" value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="例如：&#10;她叫阿灯，是在旧城区修理收音机的人。&#10;说话很慢，喜欢用天气开头……" spellCheck={false} />
          </label>
          <div className="free-foot">
            <span className="hint">{freeText.length} 字符</span>
            <div className="row-actions">
              <button className="btn ghost" onClick={() => { if (!freeText.trim()) { toast('先写点什么吧', 'error'); return } startPreview(freeText, '新朋友', false) }} disabled={!freeText.trim()}>直接使用</button>
              <button className="btn primary" onClick={() => setCostOpen(true)} disabled={!freeText.trim()}><WandSparkles size={15} /> 交给模型整理</button>
            </div>
          </div>
          <div className="model-strip"><span>整理使用的模型</span>{modelPicker(providerId, modelId, setProviderId, setModelId)}</div>
        </section>
      ) : null}

      {genError ? (
        <div className="notice error">
          <p>生成失败：{genError}</p>
        </div>
      ) : null}

      {detail ? (
        <Modal
          title={`${detail.manifest.name} · 角色档案`}
          subtitle={`${detail.manifest.aiModel ? detail.manifest.aiModel + ' · ' : ''}${detail.manifest.author} · v${detail.manifest.version} · ${detail.manifest.license ?? '授权未注明'}`}
          onClose={() => setDetail(null)}
          width={760}
          footer={
            <>
              <button className="btn ghost" onClick={() => setDetail(null)}>再想想</button>
              <button className="btn primary" onClick={() => void createFromCharacter(detail)} disabled={creating || !charProvider || !charModel}>
                {creating ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} 创建这位 Agent
              </button>
            </>
          }
        >
          <div className="character-detail-head">
            <Avatar name={detail.manifest.name} src={detail.avatarUrl} size={92} glow />
            <div>
              <p>{detail.manifest.description}</p>
              <div className="tag-row">{(detail.manifest.tags ?? []).map((t) => <span key={t} className="tag">{t}</span>)}</div>
              {detail.manifest.source ? <p className="hint">来源：{detail.manifest.source}</p> : null}
              {detail.manifest.disclaimer ? <p className="hint">{detail.manifest.disclaimer}</p> : null}
            </div>
          </div>
          <div className="model-strip vertical">
            <span>选择模型（角色模板不自带 API Key）</span>
            {modelPicker(charProvider, charModel, setCharProvider, setCharModel)}
          </div>
          <div className="personality-scroll"><MarkdownView content={detail.personality} /></div>
        </Modal>
      ) : null}

      {costOpen ? (
      <Modal
        title="调用模型生成人格"
        subtitle="只有你确认后才会发送请求"
        onClose={() => { if (!generating) setCostOpen(false) }}
        width={520}
        footer={
          <>
            <button className="btn ghost" onClick={() => setCostOpen(false)} disabled={generating}>取消</button>
            <button className="btn primary" onClick={() => {
              const m: GenMode = mode === 'questions' ? 'questions' : mode === 'markdown' ? 'markdown' : 'free'
              void generate(m)
            }} disabled={generating}>
              {generating ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} 我确认，开始生成
            </button>
          </>
        }
      >
        <div className="notice warn">
          <p>人格生成需要调用你配置的 AI 模型，可能产生 API Token 消耗及费用，具体取决于所使用的模型和生成内容长度</p>
        </div>
        <div className="cost-summary">
          <div><span>Provider</span><strong>{provider?.name ?? '未选择'}</strong></div>
          <div><span>Model</span><strong>{modelId || '未选择'}</strong></div>
          <div><span>发送内容</span><strong>{mode === 'questions' ? '十道题答案 + 已选补充' : mode === 'markdown' ? 'Markdown 文本' : '自由输入文本'}</strong></div>
        </div>
        {!providerId || !modelId ? <p className="hint">还没有选择模型，请先在下方选择。</p> : null}
      </Modal>
      ) : null}

      {confirmOpen ? (
      <Modal
        title="让她正式入座？"
        subtitle="创建后仍可编辑人格、头像和模型"
        onClose={() => setConfirmOpen(false)}
        width={460}
        footer={
          <>
            <button className="btn ghost" onClick={() => setConfirmOpen(false)} disabled={deploying}>再改改</button>
            <button className="btn primary" onClick={deploy} disabled={deploying}>
              {deploying ? <Loader2 size={16} className="spin" /> : <Check size={16} />} 确认创建
            </button>
          </>
        }
      >
        <div className="confirm-agent">
          <Avatar name={preview?.name ?? ''} path={preview?.avatarPath} size={72} glow />
          <div>
            <h3>{preview?.name}</h3>
            <p>{preview?.providerId ? `使用 ${providers.find((p) => p.id === preview.providerId)?.name ?? ''} · ${preview.modelId}` : '暂未绑定模型，可在 Agent 管理里补充'}</p>
          </div>
        </div>
        <p className="hint">这就是你期待的她吗？确认后将写入本地数据库，不会覆盖任何已有 Agent。</p>
      </Modal>
      ) : null}
    </div>
  )
}