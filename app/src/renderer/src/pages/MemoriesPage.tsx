import { useEffect, useState } from 'react'
import type { MemoryItem } from '@shared/types'
import { BrainCircuit, Loader2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { useApp } from '../store'
import { PageShell } from '../components/PageShell'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { TIER_LABELS, relativeTime } from '../utils'

type Tier = MemoryItem['tier']

export function MemoriesPage() {
  const agents = useApp((s) => s.agents)
  const toast = useApp((s) => s.toast)
  const [items, setItems] = useState<MemoryItem[]>([])
  const [agentFilter, setAgentFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<MemoryItem | null>(null)
  const [deleting, setDeleting] = useState<MemoryItem | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setItems(await window.tea.listMemories(agentFilter || undefined, tierFilter || undefined))
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [agentFilter, tierFilter])

  async function saveMemory(form: { agentId: string; tier: Tier; content: string; importance: number }) {
    setBusy(true)
    try {
      if (editing) {
        const res = await window.tea.updateMemory(editing.id, { content: form.content, tier: form.tier, importance: form.importance })
        if (!res.ok) { toast(res.error, 'error'); return }
        toast('记忆已更新', 'success')
      } else {
        const res = await window.tea.addMemory({ agentId: form.agentId, roomId: null, tier: form.tier, content: form.content, importance: form.importance })
        if (!res.ok) { toast(res.error, 'error'); return }
        toast('新的记忆已写下', 'success')
      }
      setAdding(false); setEditing(null)
      await load()
    } finally { setBusy(false) }
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      const res = await window.tea.deleteMemory(deleting.id)
      if (!res.ok) { toast(res.error, 'error'); return }
      toast('记忆已删除', 'success')
      setDeleting(null)
      await load()
    } finally { setBusy(false) }
  }

  return (
    <PageShell
      title="本地记忆"
      eyebrow="LOCAL MEMORY"
      subtitle="每位 Agent 拥有短期、中期、长期与私有记忆。只有相关的记忆会被路由进上下文，不会把全部历史灌给所有人。"
      actions={<div className="row-actions"><button className="btn ghost" onClick={() => void load()}><RefreshCw size={15} /> 刷新</button><button className="btn primary" onClick={() => setAdding(true)} disabled={!agents.length}><Plus size={16} /> 写一条记忆</button></div>}
      wide
    >
      <div className="filter-row">
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
          <option value="">全部 Agent</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
          <option value="">全部层级</option>
          {Object.entries(TIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="hint">共 {items.length} 条</span>
      </div>

      {loading ? <div className="loading-line"><Loader2 size={18} className="spin" /> 正在读取本地记忆…</div> : items.length ? (
        <div className="memory-list">
          {items.map((item) => {
            const agent = agents.find((a) => a.id === item.agentId)
            return (
              <article key={item.id} className="memory-card">
                <div className="memory-head">
                  <span className={`tier tier-${item.tier}`}>{TIER_LABELS[item.tier]}</span>
                  <div className="memory-agent">{agent?.avatarPath ? null : null}{agent?.name ?? '已删除的 Agent'}</div>
                  <span className="hint">{relativeTime(item.createdAt)}</span>
                  <div className="memory-actions">
                    <button className="icon-btn ghost tiny" onClick={() => setEditing(item)}><Save size={13} /></button>
                    <button className="icon-btn ghost tiny danger-text" onClick={() => setDeleting(item)}><Trash2 size={13} /></button>
                  </div>
                </div>
                <p>{item.content}</p>
                <div className="memory-foot">
                  <span>重要度 {'●'.repeat(item.importance)}{'○'.repeat(Math.max(0, 5 - item.importance))}</span>
                  {item.roomId ? <span>绑定茶会</span> : <span>跨茶会</span>}
                  {item.lastUsedAt ? <span>最近使用 {relativeTime(item.lastUsedAt)}</span> : <span>尚未使用</span>}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={<BrainCircuit size={30} />} title="还没有记忆" description="开启独立记忆后，聊天会自动沉淀短期记忆；你也可以手动写下重要的事" action={<button className="btn soft" onClick={() => setAdding(true)} disabled={!agents.length}><Plus size={15} /> 写一条</button>} />
      )}

      <div className="page-note">长期记忆不会自动遗忘；删除 Agent 时其记忆会一并删除。上下文压缩产生的摘要不计入这里。</div>

      {adding || editing ? <MemoryModal agents={agents} item={editing} onClose={() => { setAdding(false); setEditing(null) }} onSave={saveMemory} busy={busy} /> : null}

      {deleting ? (
      <Modal title="删除这条记忆？" subtitle="删除后无法恢复" onClose={() => setDeleting(null)} width={420}
        footer={<><button className="btn ghost" onClick={() => setDeleting(null)} disabled={busy}>取消</button><button className="btn danger" onClick={() => void confirmDelete()} disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} 删除</button></>}>
        <p className="memory-preview">{deleting?.content}</p>
      </Modal>
      ) : null}
    </PageShell>
  )
}

function MemoryModal({ agents, item, onClose, onSave, busy }: {
  agents: { id: string; name: string }[]
  item: MemoryItem | null
  onClose: () => void
  onSave: (form: { agentId: string; tier: Tier; content: string; importance: number }) => void
  busy: boolean
}) {
  const [agentId, setAgentId] = useState(item?.agentId ?? agents[0]?.id ?? '')
  const [tier, setTier] = useState<Tier>(item?.tier ?? 'long')
  const [content, setContent] = useState(item?.content ?? '')
  const [importance, setImportance] = useState(item?.importance ?? 3)

  return (
    <Modal title={item ? '编辑记忆' : '写下一条记忆'} subtitle="记忆是 Agent 自己的东西，不会自动同步给其他 Agent" onClose={onClose} width={520}
      footer={<><button className="btn ghost" onClick={onClose} disabled={busy}>取消</button><button className="btn primary" onClick={() => content.trim() && onSave({ agentId, tier, content: content.trim(), importance })} disabled={busy || !content.trim()}>{busy ? <Loader2 size={15} className="spin" /> : <Save size={15} />} 保存</button></>}>
      {!item ? <label className="field"><span>属于哪位 Agent</span><select value={agentId} onChange={(e) => setAgentId(e.target.value)}>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label> : null}
      <div className="form-grid two">
        <label className="field"><span>记忆层级</span><select value={tier} onChange={(e) => setTier(e.target.value as Tier)}>{Object.entries(TIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span>重要度 · {importance}</span><input type="range" min={1} max={5} value={importance} onChange={(e) => setImportance(Number(e.target.value))} /></label>
      </div>
      <label className="field"><span>内容</span><textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="例如：用户喜欢在深夜聊天，讨厌被催促" /></label>
    </Modal>
  )
}
