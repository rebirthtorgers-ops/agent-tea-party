import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Agent } from '@shared/types'
import { Bot, Cpu, Loader2, Pencil, Plus, Sparkles, Trash2, Users } from 'lucide-react'
import { useApp } from '../store'
import { PageShell } from '../components/PageShell'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { AgentEditor } from '../components/AgentEditor'
import { Modal } from '../components/Modal'

export function AgentsPage() {
  const navigate = useNavigate()
  const agents = useApp((s) => s.agents)
  const providers = useApp((s) => s.providers)
  const rooms = useApp((s) => s.rooms)
  const toast = useApp((s) => s.toast)
  const refreshAll = useApp((s) => s.refreshAll)
  const [editing, setEditing] = useState<Agent | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Agent | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      const res = await window.tea.deleteAgent(deleting.id)
      if (!res.ok) { toast(res.error, 'error'); return }
      await refreshAll()
      toast('Agent 已删除', 'success')
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell
      title="Agent 管理"
      eyebrow="YOUR COMPANIONS"
      subtitle={`共有 ${agents.length} 位 Agent。人格、头像、记忆与模型分开保存，换模型不会丢掉她。`}
      actions={<button className="btn primary" onClick={() => setCreating(true)}><Plus size={16} /> 新建 Agent</button>}
      wide
    >
      {agents.length ? (
        <div className="agent-grid">
          {agents.map((agent) => {
            const provider = providers.find((p) => p.id === agent.providerId)
            const roomCount = rooms.length
            return (
              <article key={agent.id} className="agent-card">
                <div className="agent-card-top">
                  <Avatar name={agent.name} path={agent.avatarPath} size={66} glow />
                  <div className="agent-card-id">
                    <h3>{agent.name}</h3>
                    <span className="status-dot">{agent.status === 'active' ? '待命中' : '休息中'}</span>
                  </div>
                  <div className="agent-card-actions">
                    <button className="icon-btn ghost tiny" title="编辑" onClick={() => setEditing(agent)}><Pencil size={14} /></button>
                    <button className="icon-btn ghost tiny danger-text" title="删除" onClick={() => setDeleting(agent)}><Trash2 size={14} /></button>
                  </div>
                </div>
                <p className="agent-summary">{agent.summary || '还没有写下她的简介'}</p>
                <div className="agent-model">
                  <Cpu size={13} />
                  <span>{provider ? `${provider.name} · ${agent.modelId ?? '未选模型'}` : '未绑定模型'}</span>
                </div>
                <div className="agent-tags">
                  <span className="tag">温度 {agent.temperature.toFixed(2)}</span>
                  <span className="tag">{agent.memoryEnabled ? '独立记忆' : '无记忆'}</span>
                  {agent.sourceCharacter ? <span className="tag highlight">社区预设</span> : null}
                </div>
                <div className="agent-card-foot">
                  <span>创建于 {new Date(agent.createdAt).toLocaleDateString('zh-CN')}</span>
                  <span className="hint">{roomCount} 桌茶会可用</span>
                </div>
              </article>
            )
          })}
          <button className="agent-card add-card" onClick={() => setCreating(true)}>
            <span className="add-orb"><Plus size={22} /></span>
            <strong>再结识一位</strong>
            <small>社区预设、十道题或自由创作</small>
          </button>
        </div>
      ) : (
        <EmptyState
          icon={<Users size={30} />}
          title="还没有 Agent"
          description="先从社区娘化 AI 模板开始，或者用十道题慢慢写下她"
          action={<div className="row-actions center"><button className="btn primary" onClick={() => navigate('/persona')}><Sparkles size={16} /> 去创建</button><button className="btn ghost" onClick={() => setCreating(true)}><Plus size={16} /> 手动新建</button></div>}
        />
      )}

      <div className="page-note">
        <Bot size={14} /> 删除 Agent 不会删除已产生的聊天记录与 Token 统计，但她们会从所有茶会离席。
      </div>

      {editing ? <AgentEditor agent={editing} onClose={() => setEditing(null)} /> : null}
      {creating ? <AgentEditor onClose={() => setCreating(false)} /> : null}

      {deleting ? (
      <Modal
        title="删除这位 Agent？"
        subtitle="人格与头像会从本地删除，此操作不可撤销"
        onClose={() => setDeleting(null)}
        width={440}
        footer={
          <>
            <button className="btn ghost" onClick={() => setDeleting(null)} disabled={busy}>取消</button>
            <button className="btn danger" onClick={() => void confirmDelete()} disabled={busy}>
              {busy ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} 确认删除
            </button>
          </>
        }
      >
        <div className="confirm-agent">
          <Avatar name={deleting?.name ?? ''} path={deleting?.avatarPath} size={64} />
          <div><h3>{deleting?.name}</h3><p>{deleting?.summary || '她还没有留下简介'}</p></div>
        </div>
      </Modal>
      ) : null}
    </PageShell>
  )
}
