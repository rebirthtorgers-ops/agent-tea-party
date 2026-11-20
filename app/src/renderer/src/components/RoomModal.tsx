import { useEffect, useMemo, useState } from 'react'
import type { Agent, Room } from '@shared/types'
import { Loader2, Save } from 'lucide-react'
import { useApp } from '../store'
import { Modal } from './Modal'
import { Avatar } from './Avatar'

interface Props {
  room?: Room | null
  onClose: () => void
  onSaved?: (room: Room) => void
}

export function RoomModal({ room, onClose, onSaved }: Props) {
  const agents = useApp((s) => s.agents)
  const toast = useApp((s) => s.toast)
  const refreshAll = useApp((s) => s.refreshAll)
  const [name, setName] = useState(room?.name ?? '')
  const [topic, setTopic] = useState(room?.topic ?? '')
  const [hostAgentId, setHostAgentId] = useState(room?.hostAgentId ?? '')
  const [maxRounds, setMaxRounds] = useState(room?.maxRounds ?? 3)
  const [maxTokens, setMaxTokens] = useState(room?.maxTokens ?? 20000)
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!room) {
      setSelected(agents.slice(0, 3).map((a) => a.id))
      return
    }
    void window.tea.listRoomAgents(room.id).then((list) => {
      setSelected(list.map((a) => a.id))
      if (!room.hostAgentId && list[0]) setHostAgentId(list[0].id)
    })
  }, [room?.id])

  const hostOptions = useMemo(() => agents.filter((a) => selected.includes(a.id)), [agents, selected])

  function toggleAgent(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      if (hostAgentId === id && !next.includes(id)) setHostAgentId(next[0] ?? '')
      return next
    })
  }

  async function save() {
    if (!name.trim()) { toast('给茶会起个名字吧', 'error'); return }
    if (selected.length === 0) { toast('至少邀请一位 Agent 入座', 'error'); return }
    setSaving(true)
    try {
      let target: Room
      if (room) {
        const res = await window.tea.updateRoom(room.id, {
          name: name.trim(), topic: topic.trim(), hostAgentId: hostAgentId || null,
          maxRounds, maxTokens, discussionMode: selected.length > 1
        })
        if (!res.ok) { toast(res.error, 'error'); return }
        target = res.data
        const current = await window.tea.listRoomAgents(room.id)
        const currentIds = current.map((a) => a.id)
        for (const id of selected.filter((x) => !currentIds.includes(x))) await window.tea.addAgentToRoom(room.id, id)
        for (const id of currentIds.filter((x) => !selected.includes(x))) await window.tea.removeAgentFromRoom(room.id, id)
      } else {
        const res = await window.tea.createRoom({
          name: name.trim(), topic: topic.trim(), hostAgentId: hostAgentId || null,
          maxRounds, maxTokens, agentIds: selected
        })
        if (!res.ok) { toast(res.error, 'error'); return }
        target = res.data
        if (selected.length > 1) await window.tea.updateRoom(target.id, { discussionMode: true })
      }
      toast(room ? '茶会已更新' : '茶会已开张', 'success')
      await refreshAll()
      onSaved?.(target)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={room ? '编辑茶会' : '举办新茶会'}
      subtitle="邀请几位 Agent 入座，设定讨论轮数上限，避免无限聊天烧 Token"
      onClose={onClose}
      width={640}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>取消</button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} {room ? '保存' : '开张'}
          </button>
        </>
      }
    >
      <div className="form-grid two">
        <label className="field">
          <span>茶会名称</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="比如：深夜谈心室" maxLength={40} />
        </label>
        <label className="field">
          <span>主持人</span>
          <select value={hostAgentId} onChange={(e) => setHostAgentId(e.target.value)}>
            <option value="">自动（轮转）</option>
            {hostOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span>话题</span>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="今晚聊点什么？" maxLength={120} />
      </label>
      <div className="form-grid two">
        <label className="field">
          <span>最大轮数 · {maxRounds}</span>
          <input type="range" min={1} max={8} step={1} value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Token 预算（估算上限）</span>
          <input type="number" min={1000} max={500000} step={1000} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} />
        </label>
      </div>

      <div className="field">
        <span>入座 Agent · 已选 {selected.length}</span>
        <div className="agent-pick-grid">
          {agents.map((agent: Agent) => {
            const active = selected.includes(agent.id)
            return (
              <button key={agent.id} className={`agent-pick ${active ? 'active' : ''}`} onClick={() => toggleAgent(agent.id)}>
                <Avatar name={agent.name} path={agent.avatarPath} size={38} />
                <span>
                  <strong>{agent.name}</strong>
                  <small>{agent.summary || '还没有简介'}</small>
                </span>
                <span className="pick-check">{active ? '✓' : '+'}</span>
              </button>
            )
          })}
        </div>
        {agents.length === 0 ? <p className="hint">还没有 Agent，先去创建一位吧</p> : null}
      </div>
    </Modal>
  )
}
