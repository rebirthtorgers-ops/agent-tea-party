import { create } from 'zustand'
import type {
  Agent, AppSettings, BootstrapData, CharacterPack, ChatEvent, Message, ProviderConfig, Room,
  StatsOverview
} from '@shared/types'

export interface ChatMessageView extends Message {
  streaming?: boolean
}

export interface RunInfo {
  runId: string
  status: 'running' | 'paused'
}

export interface ToastItem {
  id: string
  kind: 'info' | 'success' | 'error'
  text: string
}

interface AppState {
  ready: boolean
  bootError: string | null
  version: string
  dataDir: string
  settings: AppSettings
  providers: ProviderConfig[]
  agents: Agent[]
  rooms: Room[]
  characters: CharacterPack[]
  stats: StatsOverview | null
  messages: Record<string, ChatMessageView[]>
  runs: Record<string, RunInfo>
  toasts: ToastItem[]
  init: () => Promise<void>
  refreshAll: () => Promise<void>
  refreshStats: () => Promise<void>
  loadCharacters: () => Promise<void>
  loadMessages: (roomId: string) => Promise<void>
  send: (roomId: string, content: string, targetAgentIds: string[], quoteId?: string | null) => Promise<boolean>
  stopRun: (roomId: string) => Promise<void>
  togglePause: (roomId: string) => Promise<void>
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>
  toast: (text: string, kind?: ToastItem['kind']) => void
  dismissToast: (id: string) => void
  handleChatEvent: (event: ChatEvent) => void
}

const defaultSettings: AppSettings = {
  onboarded: false,
  userName: '旅人',
  theme: 'dark',
  contextLimit: 32000,
  maxContextChars: 24000,
  autoMemory: true,
  language: 'zh-CN',
  allowPrivateNetwork: false,
  demoMode: false
}

let initialized = false
let refreshTimer: number | null = null
let toastSeq = 0

function appendMessage(list: ChatMessageView[], message: ChatMessageView): ChatMessageView[] {
  if (list.some((m) => m.id === message.id)) return list
  return [...list, message]
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  bootError: null,
  version: '',
  dataDir: '',
  settings: defaultSettings,
  providers: [],
  agents: [],
  rooms: [],
  characters: [],
  stats: null,
  messages: {},
  runs: {},
  toasts: [],

  init: async () => {
    if (initialized) return
    initialized = true
    try {
      const data: BootstrapData = await window.tea.bootstrap()
      const info = await window.tea.appInfo()
      let characters: CharacterPack[] = []
      try { characters = await window.tea.listCharacters() } catch { characters = [] }
      set({
        ready: true,
        bootError: null,
        settings: data.settings ?? defaultSettings,
        providers: data.providers ?? [],
        agents: data.agents ?? [],
        rooms: data.rooms ?? [],
        characters,
        stats: null,
        version: data.version || info.version,
        dataDir: data.dataDir || info.dataDir
      })
      void get().refreshStats()
      window.tea.onChatEvent((event) => get().handleChatEvent(event))
      window.tea.onDataChanged(() => {
        if (refreshTimer) window.clearTimeout(refreshTimer)
        refreshTimer = window.setTimeout(() => { void get().refreshAll() }, 300)
      })
    } catch (error) {
      set({ ready: true, bootError: error instanceof Error ? error.message : String(error) })
    }
  },

  refreshAll: async () => {
    try {
      const data = await window.tea.bootstrap()
      set({
        settings: data.settings ?? defaultSettings,
        providers: data.providers ?? [],
        agents: data.agents ?? [],
        rooms: data.rooms ?? []
      })
      void get().refreshStats()
    } catch {
      /* transient */
    }
  },

  refreshStats: async () => {
    try {
      const stats = await window.tea.getStats()
      set({ stats })
    } catch {
      /* keep old stats */
    }
  },

  loadCharacters: async () => {
    try {
      const characters = await window.tea.listCharacters()
      set({ characters })
    } catch (error) {
      get().toast(`角色预设加载失败：${String(error)}`, 'error')
    }
  },

  loadMessages: async (roomId) => {
    try {
      const list = await window.tea.listMessages(roomId)
      set((state) => ({ messages: { ...state.messages, [roomId]: list } }))
    } catch (error) {
      get().toast(`聊天记录加载失败：${String(error)}`, 'error')
    }
  },

  send: async (roomId, content, targetAgentIds, quoteId) => {
    const res = await window.tea.sendChat({ roomId, content, targetAgentIds, quoteId })
    if (!res.ok) {
      get().toast(res.error, 'error')
      return false
    }
    set((state) => ({
      runs: { ...state.runs, [roomId]: { runId: res.data.runId, status: 'running' } }
    }))
    return true
  },

  stopRun: async (roomId) => {
    const run = get().runs[roomId]
    if (!run) return
    const res = await window.tea.stopChat(run.runId)
    if (!res.ok) get().toast(res.error, 'error')
  },

  togglePause: async (roomId) => {
    const run = get().runs[roomId]
    if (!run) return
    const next = run.status === 'running'
    const res = await window.tea.pauseChat(run.runId, next)
    if (!res.ok) { get().toast(res.error, 'error'); return }
    set((state) => ({
      runs: { ...state.runs, [roomId]: { ...run, status: next ? 'paused' : 'running' } }
    }))
  },

  saveSettings: async (patch) => {
    const settings = await window.tea.updateSettings(patch)
    set({ settings })
  },

  toast: (text, kind = 'info') => {
    const id = `t${++toastSeq}`
    set((state) => ({ toasts: [...state.toasts, { id, kind, text }] }))
    window.setTimeout(() => get().dismissToast(id), kind === 'error' ? 6500 : 4200)
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  handleChatEvent: (event) => {
    const state = get()
    const roomId = event.roomId
    const list = state.messages[roomId] ?? []

    if (event.type === 'run_state') {
      if (event.status === 'idle') {
        const runs = { ...state.runs }
        delete runs[roomId]
        set({ runs })
        window.setTimeout(() => { void get().loadMessages(roomId) }, 120)
        window.setTimeout(() => { void get().refreshStats(); void get().refreshAll() }, 350)
      } else {
        set({
          runs: {
            ...state.runs,
            [roomId]: { runId: state.runs[roomId]?.runId ?? '', status: event.status }
          }
        })
      }
      return
    }

    if (event.type === 'user_message') {
      set({ messages: { ...state.messages, [roomId]: appendMessage(list, event.message) } })
      return
    }

    if (event.type === 'turn_start') {
      if (list.some((m) => m.id === event.messageId)) return
      const placeholder: ChatMessageView = {
        id: event.messageId,
        roomId,
        senderType: 'agent',
        senderId: event.agentId,
        senderName: event.agentName,
        content: '',
        createdAt: Date.now(),
        tokensIn: 0,
        tokensOut: 0,
        estimated: false,
        quoteId: null,
        meta: { round: event.round },
        streaming: true
      }
      set({ messages: { ...state.messages, [roomId]: [...list, placeholder] } })
      return
    }

    if (event.type === 'delta') {
      const next = list.map((m) => m.id === event.messageId ? { ...m, content: m.content + event.text } : m)
      set({ messages: { ...state.messages, [roomId]: next } })
      return
    }

    if (event.type === 'turn_end') {
      let matched = false
      const next = list.map((m) => {
        if (!matched && ((m.id === event.messageId) || (m.streaming && m.senderId === event.agentId))) {
          matched = true
          return {
            ...m,
            id: event.messageId,
            content: event.content,
            streaming: false,
            tokensIn: event.usage.inputTokens,
            tokensOut: event.usage.outputTokens,
            estimated: event.usage.estimated,
            meta: { ...(m.meta ?? {}), aborted: event.aborted }
          }
        }
        return m
      })
      set({ messages: { ...state.messages, [roomId]: next } })
      return
    }

    if (event.type === 'error') {
      const next = list.map((m) => (m.streaming && (!event.agentId || m.senderId === event.agentId))
        ? { ...m, streaming: false, meta: { ...(m.meta ?? {}), error: event.message } }
        : m)
      set({ messages: { ...state.messages, [roomId]: next } })
      get().toast(event.message, 'error')
      return
    }

    if (event.type === 'info') {
      get().toast(event.message, 'info')
    }
  }
}))
