export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'mock'

export interface ProviderConfig {
  id: string
  name: string
  preset: string
  kind: ProviderKind
  baseUrl: string
  models: string[]
  enabled: boolean
  isLocal: boolean
  allowPrivateNetwork: boolean
  createdAt: number
  hasKey?: boolean
  note?: string
}

export interface ProviderTestResult {
  ok: boolean
  /** Network/API reachability (models endpoint or a probe). */
  reachable: boolean
  /** A real generation probe actually returned content. */
  generation: boolean
  latencyMs: number
  detail: string
  models: string[]
  httpStatus?: number
}

export interface Agent {
  id: string
  name: string
  avatarPath: string | null
  summary: string
  systemPrompt: string
  providerId: string | null
  modelId: string | null
  temperature: number
  maxTokens: number
  memoryEnabled: boolean
  greeting: string
  sourceCharacter: string | null
  createdAt: number
  status: string
}

export interface AgentInput {
  id?: string
  name: string
  avatarPath?: string | null
  summary?: string
  systemPrompt: string
  providerId?: string | null
  modelId?: string | null
  temperature?: number
  maxTokens?: number
  memoryEnabled?: boolean
  greeting?: string
  sourceCharacter?: string | null
}

export interface Room {
  id: string
  name: string
  topic: string
  hostAgentId: string | null
  maxRounds: number
  maxTokens: number
  discussionMode: boolean
  createdAt: number
  updatedAt: number
}

export interface RoomAgent {
  roomId: string
  agentId: string
  joinedAt: number
  agent?: Agent
}

export type SenderType = 'user' | 'agent' | 'system'

export interface Message {
  id: string
  roomId: string
  senderType: SenderType
  senderId: string | null
  senderName: string
  content: string
  createdAt: number
  tokensIn: number
  tokensOut: number
  estimated: boolean
  quoteId: string | null
  meta: Record<string, unknown> | null
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  estimated: boolean
  costUsd: number
}

export interface TokenTotals {
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  costUsd: number
  messages: number
  estimatedMessages: number
  continuations: number
}

export interface UsageRow {
  id: string
  roomId: string | null
  agentId: string | null
  agentName?: string
  providerId: string | null
  providerName?: string
  modelId: string | null
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  estimated: boolean
  costUsd: number
  createdAt: number
}

export interface MemoryItem {
  id: string
  agentId: string
  roomId: string | null
  tier: 'short' | 'mid' | 'long' | 'private'
  content: string
  importance: number
  createdAt: number
  lastUsedAt: number | null
}

export interface CharacterManifest {
  id: string
  name: string
  version: string
  author: string
  description: string
  tags: string[]
  greeting?: string
  summary?: string
  defaultProvider?: string
  defaultModel?: string
  license?: string
  source?: string
  aiModel?: string
  collection?: string
  disclaimer?: string
  avatar: string
  personalityFile: string
}

export interface CharacterPack {
  manifest: CharacterManifest
  personality: string
  avatarUrl: string
  dir: string
  builtin: boolean
}

export interface AppSettings {
  onboarded: boolean
  userName: string
  theme: 'dark'
  contextLimit: number
  maxContextChars: number
  autoMemory: boolean
  language: string
  allowPrivateNetwork: boolean
  demoMode: boolean
}

export interface StatsOverview {
  totals: TokenTotals
  byAgent: { agentId: string; agentName: string; input: number; output: number; costUsd: number; messages: number }[]
  byProvider: { providerId: string; providerName: string; input: number; output: number; costUsd: number; messages: number }[]
  byRoom: { roomId: string; roomName: string; input: number; output: number; costUsd: number; messages: number }[]
  recent: UsageRow[]
}

export type ChatEvent =
  | { type: 'run_state'; roomId: string; status: 'running' | 'paused' | 'idle' }
  | { type: 'turn_start'; roomId: string; agentId: string; agentName: string; messageId: string; round: number }
  | { type: 'delta'; roomId: string; agentId: string; messageId: string; text: string }
  | { type: 'turn_end'; roomId: string; agentId: string; messageId: string; content: string; usage: Usage; aborted: boolean }
  | { type: 'user_message'; roomId: string; message: Message }
  | { type: 'error'; roomId: string; agentId?: string; message: string }
  | { type: 'info'; roomId: string; message: string }

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export interface BootstrapData {
  settings: AppSettings
  providers: ProviderConfig[]
  agents: Agent[]
  rooms: Room[]
  stats: TokenTotals
  version: string
  dataDir: string
}

export interface ChatSendInput {
  roomId: string
  content: string
  targetAgentIds: string[]
  quoteId?: string | null
}

export interface PersonaDraftInput {
  mode: 'questions' | 'markdown' | 'free'
  answers?: Record<string, string | string[]>
  rawText?: string
  characterId?: string
  providerId: string
  modelId: string
  agentNameHint?: string
}

export interface PersonaResult {
  markdown: string
  suggestedName: string
  providerId: string
  modelId: string
  usage: Usage
}

export interface GenerateRequest {
  providerId: string
  modelId: string
  system: string
  user: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}
