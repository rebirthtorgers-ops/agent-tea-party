import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Agent, Message, Room } from '@shared/types'
import {
  BarChart3, BookHeart, BrainCircuit, ChevronRight, CircleStop, Copy, Cpu, DoorOpen,
  Edit3, Loader2, MessageSquareQuote, MessagesSquare, Pause, Play, Plus, Quote,
  Send, Settings, SlidersHorizontal, Sparkles, Trash2, Upload, UserPlus, Users, X
} from 'lucide-react'
import { useApp } from '../store'
import { Avatar } from '../components/Avatar'
import { MarkdownView } from '../components/MarkdownView'
import { Modal } from '../components/Modal'
import { RoomModal } from '../components/RoomModal'
import { AgentEditor } from '../components/AgentEditor'
import { formatTime, cx } from '../utils'
import { EmptyState } from '../components/EmptyState'
import { ThemeToggle } from '../components/ThemeToggle'

const NAV = [
  { to: '/agents', label: 'Agent 管理', icon: Users },
  { to: '/persona', label: '人格工作室', icon: Sparkles },
  { to: '/characters', label: '社区娘化 AI', icon: BookHeart },
  { to: '/providers', label: '模型与 API', icon: Cpu },
  { to: '/stats', label: 'Token 统计', icon: BarChart3 },
  { to: '/memories', label: '本地记忆', icon: BrainCircuit },
  { to: '/settings', label: '设置', icon: Settings }
]

function useLocalRoom(): [string, (id: string) => void] {
  const [id, setId] = useState(() => localStorage.getItem('tea.activeRoom') ?? '')
  const set = (next: string) => { localStorage.setItem('tea.activeRoom', next); setId(next) }
  return [id, set]
}

export function ChatPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const rooms = useApp((s) => s.rooms)
  const agents = useApp((s) => s.agents)
  const providers = useApp((s) => s.providers)
  const messagesMap = useApp((s) => s.messages)
  const runs = useApp((s) => s.runs)
  const loadMessages = useApp((s) => s.loadMessages)
  const send = useApp((s) => s.send)
  const stopRun = useApp((s) => s.stopRun)
  const togglePause = useApp((s) => s.togglePause)
  const toast = useApp((s) => s.toast)
  const refreshAll = useApp((s) => s.refreshAll)

  const [roomId, setRoomId] = useLocalRoom()
  const [roomAgents, setRoomAgents] = useState<Agent[]>([])
  const [input, setInput] = useState('')
  const [targets, setTargets] = useState<string[]>([])
  const [quote, setQuote] = useState<Message | null>(null)
  const [roomModal, setRoomModal] = useState<'create' | Room | null>(null)
  const [editAgent, setEditAgent] = useState<Agent | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sending, setSending] = useState(false)
  const [nearBottom, setNearBottom] = useState(true)

  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const room = rooms.find((r) => r.id === roomId) ?? null
  const messages = roomId ? messagesMap[roomId] ?? [] : []
  const run = roomId ? runs[roomId] : undefined

  useEffect(() => {
    if (rooms.length && !rooms.some((r) => r.id === roomId)) setRoomId(rooms[0].id)
  }, [rooms, roomId])

  useEffect(() => {
    if (!roomId) return
    void loadMessages(roomId)
    let alive = true
    void window.tea.listRoomAgents(roomId).then((list) => { if (alive) setRoomAgents(list) })
    setTargets([])
    setQuote(null)
    return () => { alive = false }
  }, [roomId])

  useEffect(() => {
    if (inviteOpen) {
      void window.tea.listRoomAgents(roomId).then(setRoomAgents)
    }
  }, [inviteOpen, roomId])

  useEffect(() => {
    if (!nearBottom) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, messages[messages.length - 1]?.content, nearBottom])

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(180, el.scrollHeight)}px`
  }, [input])

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    setNearBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120)
  }

  const otherAgents = useMemo(() => agents.filter((a) => !roomAgents.some((r) => r.id === a.id)), [agents, roomAgents])

  function mentionedAgents(): Agent[] {
    return roomAgents.filter((a) => input.includes(`@${a.name}`))
  }

  async function submit() {
    if (!roomId) return
    const content = input.trim()
    if (!content) return
    if (!roomAgents.length) { toast('先邀请一位 Agent 入座吧', 'error'); return }
    if (sending) return
    setSending(true)
    try {
      const mentioned = mentionedAgents().map((a) => a.id)
      const effectiveTargets = mentioned.length ? mentioned : targets
      const ok = await send(roomId, content, effectiveTargets, quote?.id ?? null)
      if (ok) {
        setInput('')
        setQuote(null)
        setTargets([])
      }
    } finally {
      setSending(false)
    }
  }

  async function addToRoom(agent: Agent) {
    if (!roomId) return
    const res = await window.tea.addAgentToRoom(roomId, agent.id)
    if (!res.ok) { toast(res.error, 'error'); return }
    const list = await window.tea.listRoomAgents(roomId)
    setRoomAgents(list)
    await refreshAll()
    toast(`${agent.name} 已入座`, 'success')
  }

  async function removeFromRoom(agent: Agent) {
    if (!roomId) return
    const res = await window.tea.removeAgentFromRoom(roomId, agent.id)
    if (!res.ok) { toast(res.error, 'error'); return }
    const list = await window.tea.listRoomAgents(roomId)
    setRoomAgents(list)
    await refreshAll()
    setTargets((prev) => prev.filter((id) => id !== agent.id))
    toast(`${agent.name} 已离席`, 'success')
  }

  async function confirmDeleteRoom() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await window.tea.deleteRoom(deleteTarget.id)
      if (!res.ok) { toast(res.error, 'error'); return }
      await refreshAll()
      toast('茶会已散场', 'success')
      if (roomId === deleteTarget.id) setRoomId('')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const activeAgents = roomAgents.length ? roomAgents : []
  const quoteSource = quote ? messages.find((m) => m.id === quote.id) ?? quote : null

  return (
    <div className="chat-layout">
      <aside className="chat-side">
        <div className="side-brand">
          <div className="brand-mark"><Sparkles size={18} /></div>
          <div>
            <h1>Agent 茶话会</h1>
            <p>LOCAL · TEA PARTY</p>
          </div>
        </div>

        <button className="new-room-btn" onClick={() => {
          if (!agents.length) { toast('先创建一位 Agent，再举办茶会', 'info'); navigate('/persona') ; return }
          setRoomModal('create')
        }}>
          <Plus size={17} /> 举办新茶会
        </button>

        <div className="side-section-label">我的茶会 <span>{rooms.length}</span></div>
        <div className="room-list">
          {rooms.map((r) => (
            <div key={r.id} className={cx('room-row', r.id === roomId && 'active')} onClick={() => setRoomId(r.id)}>
              <span className="room-glyph"><MessagesSquare size={15} /></span>
              <span className="room-row-body">
                <strong>{r.name}</strong>
                <small>{r.topic || '还没有话题'} · {formatTime(r.updatedAt)}</small>
              </span>
              <button className="room-del" title="删除茶会" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r) }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {!rooms.length ? <p className="side-empty">还没有茶会，先开一桌吧</p> : null}
        </div>

        <nav className="side-nav">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.to} className={cx('side-link', location.pathname === item.to && 'active')} onClick={() => navigate(item.to)}>
                <Icon size={16} /> {item.label} <ChevronRight size={13} className="side-chev" />
              </button>
            )
          })}
        </nav>

        <div className="side-foot">
          <ThemeToggle compact />
          <div className="local-dot" /> 数据仅保存在本机
        </div>
      </aside>

      <main className="chat-main">
        {room ? (
          <>
            <header className="chat-head">
              <div className="chat-head-info">
                <div>
                  <div className="eyebrow">TEA ROOM · {roomAgents.length} 位在场</div>
                  <h2>{room.name}</h2>
                  <p>{room.topic || '在这里，她们可以自由地交换想法'}</p>
                </div>
                <div className="head-avatars">
                  {roomAgents.slice(0, 4).map((a) => <Avatar key={a.id} name={a.name} path={a.avatarPath} size={34} />)}
                  {roomAgents.length > 4 ? <span className="avatar-more">+{roomAgents.length - 4}</span> : null}
                </div>
              </div>
              <div className="chat-head-actions">
                <ThemeToggle compact />
                <button className="icon-btn" title="茶会设置" onClick={() => setRoomModal(room)}><SlidersHorizontal size={17} /></button>
                <button className="icon-btn" title="邀请 Agent" onClick={() => setInviteOpen(true)}><UserPlus size={17} /></button>
              </div>
            </header>

            <div className="message-scroll" ref={scrollRef} onScroll={onScroll}>
              <div className="message-inner">
                {!messages.length ? (
                  <div className="welcome-room">
                    <div className="welcome-orbit">
                      {roomAgents.slice(0, 3).map((a, i) => (
                        <div key={a.id} className={`orbit-avatar orbit-${i}`}><Avatar name={a.name} path={a.avatarPath} size={64} glow /></div>
                      ))}
                      <div className="orbit-core"><Sparkles size={22} /></div>
                    </div>
                    <h3>{room.name}</h3>
                    <p>{room.topic || '今晚的茶会，想聊点什么？'}</p>
                    {roomAgents.length ? (
                      <div className="welcome-chips">
                        {roomAgents.map((a) => (
                          <button key={a.id} className="welcome-chip" onClick={() => { setInput(`@${a.name} `); setTargets([a.id]); textRef.current?.focus() }}>
                            @{a.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button className="btn primary" onClick={() => setInviteOpen(true)}><UserPlus size={16} /> 邀请 Agent 入座</button>
                    )}
                    <span className="welcome-hint">试试用 @ 点名，或直接说「大家聊聊……」</span>
                  </div>
                ) : null}

                {messages.map((message) => {
                  const agent = activeAgents.find((a) => a.id === message.senderId) ?? agents.find((a) => a.id === message.senderId)
                  const quoted = message.quoteId ? messages.find((m) => m.id === message.quoteId) : null
                  const isUser = message.senderType === 'user'
                  const isSystem = message.senderType === 'system'
                  if (isSystem) return <div key={message.id} className="system-line">{message.content}</div>
                  return (
                    <div key={message.id} className={cx('msg-row', isUser ? 'mine' : 'theirs')}>
                      {!isUser ? <Avatar name={message.senderName} path={agent?.avatarPath} size={40} className="msg-avatar" /> : null}
                      <div className="msg-body">
                        <div className="msg-meta">
                          <strong>{message.senderName}</strong>
                          <span>{formatTime(message.createdAt)}</span>
                          {message.estimated ? <span className="mini-badge">估算</span> : null}
                        </div>
                        {quoted ? (
                          <div className="quote-block">
                            <Quote size={12} />
                            <span><b>{quoted.senderName}</b>：{quoted.content.slice(0, 90)}{quoted.content.length > 90 ? '…' : ''}</span>
                          </div>
                        ) : null}
                        <div className={cx('bubble', message.streaming && 'streaming')}>
                          {isUser ? <p className="plain-text">{message.content}</p> : <MarkdownView content={message.content || (message.streaming ? '…' : '')} />}
                          {message.streaming ? <span className="typing-caret" /> : null}
                        </div>
                        {message.meta?.error ? <p className="msg-error">{String(message.meta.error)}</p> : null}
                        {message.meta?.aborted ? <p className="msg-aborted">（本轮已中止）</p> : null}
                        <div className="msg-actions">
                          <button onClick={() => { setQuote(message); textRef.current?.focus() }}><MessageSquareQuote size={13} /> 引用</button>
                          <button onClick={() => void navigator.clipboard.writeText(message.content).then(() => toast('已复制', 'success'))}><Copy size={13} /> 复制</button>
                          {!isUser && agent ? <button onClick={() => setEditAgent(agent)}><Edit3 size={13} /> 编辑她</button> : null}
                          {message.tokensOut ? <span className="token-note">{message.tokensIn + message.tokensOut} tok</span> : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
            </div>

            <div className="composer-wrap">
              {run ? (
                <div className="run-bar">
                  <span className={cx('pulse-dot', run.status === 'paused' && 'paused')} />
                  <span>{run.status === 'paused' ? '讨论已暂停' : '她们正在思考…'}</span>
                  <button className="run-action" onClick={() => void togglePause(roomId)}>
                    {run.status === 'paused' ? <><Play size={13} /> 继续</> : <><Pause size={13} /> 暂停</>}
                  </button>
                  <button className="run-action stop" onClick={() => void stopRun(roomId)}><CircleStop size={13} /> 停止</button>
                </div>
              ) : null}

              {quoteSource ? (
                <div className="composer-quote">
                  <Quote size={13} />
                  <span>回复 <b>{quoteSource.senderName}</b>：{quoteSource.content.slice(0, 80)}{quoteSource.content.length > 80 ? '…' : ''}</span>
                  <button className="icon-btn ghost tiny" onClick={() => setQuote(null)}><X size={14} /></button>
                </div>
              ) : null}

              <div className="composer">
                <div className="composer-targets">
                  <button className={cx('target-chip', targets.length === 0 && 'active')} onClick={() => setTargets([])}>全体</button>
                  {roomAgents.map((a) => (
                    <button key={a.id} className={cx('target-chip', targets.includes(a.id) && 'active')} onClick={() => setTargets((prev) => prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id])}>
                      <Avatar name={a.name} path={a.avatarPath} size={16} /> {a.name}
                    </button>
                  ))}
                </div>
                <div className="composer-input-row">
                  <textarea
                    ref={textRef}
                    value={input}
                    rows={1}
                    placeholder={`和 ${room.name} 说点什么……  @名字 可以点名`}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit() } }}
                  />
                  <button className="send-btn" onClick={() => void submit()} disabled={sending || !input.trim() || Boolean(run)} title={run ? '等她们说完再发' : '发送'}>
                    {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                  </button>
                </div>
                <div className="composer-foot">
                  <span>Enter 发送 · Shift + Enter 换行</span>
                  <span>{targets.length ? `点名 ${targets.length} 位` : mentionedAgents().length ? `点名 ${mentionedAgents().map((a) => a.name).join('、')}` : '全体讨论'} · 最多 {room.maxRounds} 轮</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="no-room">
            <EmptyState
              icon={<MessagesSquare size={30} />}
              title={rooms.length ? '选一桌茶会吧' : '今晚，还没有茶会'}
              description={agents.length ? '在左侧选择已有茶会，或举办一桌新的' : '先创建你的第一位 AI 娘，再邀请她入座'}
              action={
                <div className="row-actions center">
                  <button className="btn ghost" onClick={() => navigate('/persona')}><Sparkles size={16} /> 创建 Agent</button>
                  <button className="btn primary" onClick={() => agents.length ? setRoomModal('create') : navigate('/persona')}><Plus size={16} /> 举办茶会</button>
                </div>
              }
            />
          </div>
        )}
      </main>

      <aside className="chat-rail">
        <div className="rail-head">
          <h3>在场 Agent <span>{roomAgents.length}</span></h3>
          <button className="icon-btn ghost tiny" title="邀请" onClick={() => setInviteOpen(true)} disabled={!roomId}><Plus size={15} /></button>
        </div>
        <div className="rail-agents">
          {roomAgents.map((agent) => {
            const provider = providers.find((p) => p.id === agent.providerId)
            return (
              <article key={agent.id} className="rail-agent" onClick={() => setEditAgent(agent)}>
                <Avatar name={agent.name} path={agent.avatarPath} size={44} />
                <div className="rail-agent-body">
                  <div className="rail-agent-name"><strong>{agent.name}</strong><span className="online-dot" /></div>
                  <small>{provider ? `${provider.name} · ${agent.modelId ?? '未选模型'}` : '未绑定模型'}</small>
                  <p>{agent.summary || '还没有写下她的简介'}</p>
                </div>
                <button className="rail-remove" title="移出茶会" onClick={(e) => { e.stopPropagation(); void removeFromRoom(agent) }}><DoorOpen size={13} /></button>
              </article>
            )
          })}
          {!roomAgents.length ? <p className="side-empty">还没有人入座</p> : null}
          <button className="invite-btn" onClick={() => setInviteOpen(true)} disabled={!roomId}><UserPlus size={15} /> 邀请更多 Agent</button>
        </div>

        {room ? (
          <div className="rail-meta">
            <h3>这一桌的规则</h3>
            <div className="meta-line"><span>主持人</span><strong>{agents.find((a) => a.id === room.hostAgentId)?.name ?? '自动轮转'}</strong></div>
            <div className="meta-line"><span>最大轮数</span><strong>{room.maxRounds} 轮</strong></div>
            <div className="meta-line"><span>Token 预算</span><strong>{room.maxTokens.toLocaleString()}</strong></div>
            <button className="btn ghost full" onClick={() => setRoomModal(room)}><Settings size={14} /> 调整茶会</button>
          </div>
        ) : null}

        <div className="rail-foot">
          <Cpu size={13} /> 模型由你配置 · 数据留在本地
        </div>
      </aside>

      {roomModal === 'create' ? (
        <RoomModal onClose={() => setRoomModal(null)} onSaved={(r) => setRoomId(r.id)} />
      ) : roomModal ? (
        <RoomModal room={roomModal} onClose={() => setRoomModal(null)} />
      ) : null}

      {editAgent ? <AgentEditor agent={editAgent} onClose={() => setEditAgent(null)} /> : null}

      {inviteOpen ? (
      <Modal
        title="邀请 Agent 入座"
        subtitle={room ? `当前茶会：${room.name}` : ''}
        onClose={() => setInviteOpen(false)}
        width={520}
      >
        <div className="invite-list">
          {otherAgents.map((agent) => (
            <div key={agent.id} className="invite-row">
              <Avatar name={agent.name} path={agent.avatarPath} size={38} />
              <div><strong>{agent.name}</strong><small>{agent.summary || '还没有简介'}</small></div>
              <button className="btn soft tiny-btn" onClick={() => void addToRoom(agent)}><Plus size={13} /> 邀请</button>
            </div>
          ))}
          {!otherAgents.length ? (
            <EmptyState icon={<Users size={24} />} title="其他 Agent 都已经在场了" description="想邀请新朋友？先创建一位新的 AI 娘" action={<button className="btn soft" onClick={() => { setInviteOpen(false); navigate('/persona') }}><Sparkles size={14} /> 去创建</button>} />
          ) : null}
        </div>
      </Modal>
      ) : null}

      {deleteTarget ? (
      <Modal
        title="散场并删除茶会？"
        subtitle="聊天记录会一起删除，此操作不可撤销"
        onClose={() => setDeleteTarget(null)}
        width={440}
        footer={
          <>
            <button className="btn ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>取消</button>
            <button className="btn danger" onClick={() => void confirmDeleteRoom()} disabled={deleting}>
              {deleting ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} 删除茶会
            </button>
          </>
        }
      >
        <p>确定要删除「{deleteTarget?.name}」吗？Agent 本身不会被删除。</p>
      </Modal>
      ) : null}
    </div>
  )
}
