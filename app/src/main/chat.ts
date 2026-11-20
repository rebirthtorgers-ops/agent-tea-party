import type { BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import type { Agent, ChatEvent, ChatSendInput, Message, Result, Room, Usage } from '../shared/types'
import * as db from './db'
import { getCredential } from './credentials'
import { streamChat, type ChatMessage } from './providers'

interface RunState {
  id: string
  roomId: string
  stopped: boolean
  paused: boolean
  controller: AbortController | null
}

const runs = new Map<string, RunState>()

function emit(win: BrowserWindow, event: ChatEvent): void {
  if (!win.isDestroyed()) win.webContents.send('tea:chat-event', event)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function safeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw
    .replace(/[?&]key=[^&\s]+/g, '?key=***')
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
    .slice(0, 800)
}

function historyFor(agent: Agent, room: Room, messages: Message[], maxChars: number): ChatMessage[] {
  const selected: ChatMessage[] = []
  let used = 0
  for (const msg of [...messages].reverse()) {
    if (msg.senderType === 'system') continue
    let content = msg.content
    if (msg.quoteId) {
      const quoted = db.getMessage(msg.quoteId)
      if (quoted) content = `（引用 ${quoted.senderName}：「${quoted.content.slice(0, 160)}」）\n${content}`
    }
    const speaker = msg.senderType === 'user' ? '用户' : msg.senderName
    const line = msg.senderType === 'agent' && msg.senderId === agent.id
      ? content
      : `${speaker}：${content}`
    if (used + line.length > maxChars && selected.length > 0) break
    selected.push({ role: msg.senderType === 'user' ? 'user' : 'assistant', content: line })
    used += line.length
  }
  return selected.reverse()
}

function memoryContext(agent: Agent, roomId: string): string {
  const memories = db.listMemories(agent.id)
    .filter((m) => m.roomId === null || m.roomId === roomId)
    .sort((a, b) => b.importance - a.importance || b.createdAt - a.createdAt)
    .slice(0, 8)
  const summary = db.latestSummary(agent.id, roomId)
  const parts: string[] = []
  if (summary) parts.push(`【较早对话的本地摘要】\n${summary.content}`)
  if (memories.length) parts.push(`【你记得的事】\n${memories.map((m) => `- ${m.content}`).join('\n')}`)
  return parts.join('\n\n')
}

function buildSystem(agent: Agent, room: Room, agents: Agent[], roomId: string): string {
  const participants = agents.map((a) => a.name === agent.name ? `${a.name}（你）` : a.name).join('、')
  const memory = memoryContext(agent, roomId)
  return `${agent.systemPrompt}

---
## 茶会运行环境
你正在「Agent 茶话会」的多人聊天室里，以「${agent.name}」的身份参与对话。
聊天室：「${room.name}」${room.topic ? `，主题：${room.topic}` : ''}
在场：${participants}
${room.hostAgentId === agent.id ? '你是这场茶会的主持人，可以自然地推进话题、邀请别人发言。' : ''}

规则：
- 保持角色设定与说话风格，只输出角色真正说出口的内容，不要写分析、括号说明或「作为 AI」的旁白。
- 你可以回应用户，也可以回应其他 Agent；引用别人的观点时自然地说出来，不要伪造对方没说过的话。
- 一次发言聚焦一到两个点，长度适中，不要复述整段历史。
- 你是 AI 角色扮演，不冒充真人；涉及现实危险、医疗、法律等严肃问题时，先关心现实安全。
${memory ? `\n${memory}` : ''}`
}

function compressIfNeeded(agentId: string, roomId: string): void {
  const settings = db.getSettings()
  if (!settings.autoMemory) return
  const all = db.listMessages(roomId, 200)
  if (all.length < 50) return
  const cutIndex = all.length - 20
  const older = all.slice(0, cutIndex)
  const coversUpTo = older[older.length - 1]?.createdAt ?? 0
  const existing = db.latestSummary(agentId, roomId)
  if (existing && existing.coversUpTo >= coversUpTo) return
  const digest = older.slice(-30)
    .map((m) => `${m.senderName}：${m.content.replace(/\s+/g, ' ').slice(0, 80)}`)
    .join('\n')
    .slice(0, 1800)
  db.addSummary({ agentId, roomId, content: `（本地提取摘要，未调用模型）\n${digest}`, coversUpTo })
}

async function waitWhilePaused(run: RunState): Promise<void> {
  while (run.paused && !run.stopped) await sleep(180)
}

export function stopChat(runId: string): Result<null> {
  const run = runs.get(runId)
  if (!run) return { ok: false, error: '这场讨论已经结束' }
  run.stopped = true
  run.controller?.abort()
  return { ok: true, data: null }
}

export function pauseChat(runId: string, paused: boolean): Result<null> {
  const run = runs.get(runId)
  if (!run) return { ok: false, error: '这场讨论已经结束' }
  run.paused = paused
  return { ok: true, data: null }
}

export function stopAllChats(): void {
  for (const run of runs.values()) {
    run.stopped = true
    run.controller?.abort()
  }
}

export async function startChat(win: BrowserWindow, input: ChatSendInput): Promise<Result<{ runId: string; userMessage: Message }>> {
  const room = db.getRoom(input.roomId)
  if (!room) return { ok: false, error: '聊天室不存在' }
  const content = input.content.trim()
  if (!content) return { ok: false, error: '消息不能为空' }
  const roomAgents = db.listRoomAgents(room.id)
  if (!roomAgents.length) return { ok: false, error: '这个聊天室还没有 Agent，先从右侧邀请一位吧' }
  const targetIds = input.targetAgentIds.filter((id) => roomAgents.some((a) => a.id === id))
  const agents = targetIds.length ? roomAgents.filter((a) => targetIds.includes(a.id)) : roomAgents

  const userMessage = db.addMessage({
    roomId: room.id, senderType: 'user', senderName: db.getSettings().userName || '旅人',
    content, quoteId: input.quoteId ?? null
  })
  const runId = randomUUID()
  const run: RunState = { id: runId, roomId: room.id, stopped: false, paused: false, controller: null }
  runs.set(runId, run)
  emit(win, { type: 'user_message', roomId: room.id, message: userMessage })
  emit(win, { type: 'run_state', roomId: room.id, status: 'running' })

  void (async () => {
    let spent = 0
    let stoppedByUser = false
    const turns = agents.length === 1 ? 1 : Math.max(1, Math.min(room.maxRounds || 2, 8))
    try {
      for (let turn = 0; turn < turns; turn++) {
        if (run.stopped) { stoppedByUser = true; break }
        await waitWhilePaused(run)
        if (run.stopped) { stoppedByUser = true; break }
        const agent = agents[turn % agents.length]
        const provider = agent.providerId ? db.getProvider(agent.providerId) : null
        if (!provider) {
          emit(win, { type: 'error', roomId: room.id, agentId: agent.id, message: `${agent.name} 还没有绑定可用的 Provider，请先在右侧编辑配置` })
          break
        }
        if (!agent.modelId) {
          emit(win, { type: 'error', roomId: room.id, agentId: agent.id, message: `${agent.name} 还没有选择模型` })
          break
        }
        const apiKey = provider.kind === 'mock' ? undefined : getCredential(provider.id)
        if (provider.kind !== 'mock' && provider.kind !== 'openai' && provider.kind !== 'anthropic' && provider.kind !== 'gemini') {
          emit(win, { type: 'error', roomId: room.id, agentId: agent.id, message: 'Provider 类型不受支持' })
          break
        }
        if (provider.kind !== 'mock' && provider.isLocal !== true && !apiKey) {
          emit(win, { type: 'error', roomId: room.id, agentId: agent.id, message: `${provider.name} 还没有保存 API Key` })
          break
        }
        if (provider.kind === 'mock' && db.getSettings().demoMode === false) {
          // Demo provider is allowed, but always announced as simulated.
          emit(win, { type: 'info', roomId: room.id, message: '本次回复来自本地演示 Provider，未联网、未调用真实模型' })
        }

        compressIfNeeded(agent.id, room.id)
        const allMessages = db.listMessages(room.id, 80)
        const maxChars = Math.max(2000, db.getSettings().maxContextChars || 24000)
        const history = historyFor(agent, room, allMessages, maxChars)
        const messages: ChatMessage[] = [
          { role: 'system', content: buildSystem(agent, room, roomAgents, room.id) },
          ...history,
          { role: 'user', content: `[茶会调度] 现在轮到你以「${agent.name}」的身份发言。直接输出角色的话，不要加姓名前缀。` }
        ]
        const messageId = randomUUID()
        emit(win, { type: 'turn_start', roomId: room.id, agentId: agent.id, agentName: agent.name, messageId, round: turn + 1 })
        const controller = new AbortController()
        run.controller = controller
        let full = ''
        let usage: Usage | null = null
        let aborted = false
        try {
          const result = await streamChat(provider, apiKey, {
            providerId: provider.id, modelId: agent.modelId, system: messages[0].content,
            user: messages.slice(1).map((m) => m.content).join('\n\n'), messages,
            temperature: agent.temperature, maxTokens: agent.maxTokens, signal: controller.signal
          }, (delta) => {
            full += delta
            emit(win, { type: 'delta', roomId: room.id, agentId: agent.id, messageId, text: delta })
          })
          full = result.text || full
          usage = result.usage
        } catch (err) {
          aborted = controller.signal.aborted || run.stopped
          if (!aborted) {
            emit(win, { type: 'error', roomId: room.id, agentId: agent.id, message: `${agent.name} 的请求失败：${safeErrorMessage(err)}` })
          }
        }
        if (!full.trim()) {
          if (aborted) emit(win, { type: 'info', roomId: room.id, message: '已停止生成' })
          break
        }
        const estimated = usage?.estimated ?? true
        const turnUsage: Usage = usage ?? {
          inputTokens: 0, outputTokens: 0, cachedTokens: 0, estimated: true, costUsd: 0
        }
        const saved = db.addMessage({
          roomId: room.id, senderType: 'agent', senderId: agent.id, senderName: agent.name,
          content: full.trim(), tokensIn: turnUsage.inputTokens, tokensOut: turnUsage.outputTokens,
          estimated, meta: { messageId, providerId: provider.id, modelId: agent.modelId, costUsd: turnUsage.costUsd, simulated: provider.kind === 'mock', aborted }
        })
        db.logUsage({ roomId: room.id, agentId: agent.id, providerId: provider.id, modelId: agent.modelId, usage: turnUsage })
        db.touchMemories([])
        if (db.getSettings().autoMemory && content.length > 8) {
          db.addMemory({ agentId: agent.id, roomId: room.id, tier: 'short', content: `用户最近说：${content.slice(0, 160)}`, importance: 0.5 })
        }
        spent += turnUsage.inputTokens + turnUsage.outputTokens
        emit(win, {
          type: 'turn_end', roomId: room.id, agentId: agent.id, messageId: saved.id,
          content: full.trim(), usage: turnUsage, aborted
        })
        if (aborted) { stoppedByUser = true; break }
        if (room.maxTokens > 0 && spent > room.maxTokens) {
          emit(win, { type: 'info', roomId: room.id, message: `本场讨论已达到 Token 上限（${room.maxTokens}），自动停下` })
          break
        }
      }
    } catch (err) {
      emit(win, { type: 'error', roomId: room.id, message: `讨论意外中断：${safeErrorMessage(err)}` })
    } finally {
      runs.delete(runId)
      emit(win, { type: 'run_state', roomId: room.id, status: 'idle' })
      if (stoppedByUser) emit(win, { type: 'info', roomId: room.id, message: '讨论已停止' })
    }
  })()

  return { ok: true, data: { runId, userMessage } }
}
