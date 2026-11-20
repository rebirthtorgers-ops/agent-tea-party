import type {
  Agent, AgentInput, AppSettings, BootstrapData, CharacterPack, ChatEvent, ChatSendInput,
  MemoryItem, Message, PersonaDraftInput, PersonaResult, ProviderConfig, ProviderTestResult,
  Result, Room, StatsOverview
} from './types'

export interface ProviderInput {
  id?: string
  name: string
  preset: string
  kind: ProviderConfig['kind']
  baseUrl: string
  models?: string[]
  enabled?: boolean
  isLocal?: boolean
  allowPrivateNetwork?: boolean
  note?: string
}

export interface AvatarPick {
  ok: boolean
  canceled?: boolean
  sourcePath?: string
  dataUrl?: string
  error?: string
}

export interface MarkdownPick {
  ok: boolean
  canceled?: boolean
  name?: string
  content?: string
  path?: string
  error?: string
}

export interface CreateFromCharacterInput {
  characterId: string
  providerId: string
  modelId: string
  name?: string
}

/** The complete, typed surface exposed to the renderer through contextBridge. */
export interface TeaApi {
  bootstrap(): Promise<BootstrapData>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  appInfo(): Promise<{ version: string; dataDir: string; packaged: boolean; platform: string }>

  listProviders(): Promise<ProviderConfig[]>
  saveProvider(input: ProviderInput, apiKey?: string): Promise<Result<ProviderConfig>>
  deleteProvider(id: string): Promise<Result<null>>
  testProvider(id: string): Promise<ProviderTestResult>
  fetchModels(id: string): Promise<{ ok: boolean; models: string[]; detail: string }>
  hasProviderKey(id: string): Promise<boolean>
  removeProviderKey(id: string): Promise<Result<null>>

  listCharacters(): Promise<CharacterPack[]>
  getCharacter(id: string): Promise<CharacterPack | null>
  createAgentFromCharacter(input: CreateFromCharacterInput): Promise<Result<Agent>>
  chooseAvatar(): Promise<AvatarPick>
  importAvatar(sourcePath: string): Promise<Result<string>>
  avatarDataUrl(filePath: string): Promise<string | null>

  listAgents(): Promise<Agent[]>
  saveAgent(input: AgentInput): Promise<Result<Agent>>
  deleteAgent(id: string): Promise<Result<null>>
  chooseAgentAvatar(agentId: string): Promise<Result<string>>

  listRooms(): Promise<Room[]>
  createRoom(input: { name: string; topic?: string; hostAgentId?: string | null; maxRounds?: number; maxTokens?: number; agentIds?: string[] }): Promise<Result<Room>>
  updateRoom(id: string, patch: Partial<Room>): Promise<Result<Room>>
  deleteRoom(id: string): Promise<Result<null>>
  listRoomAgents(roomId: string): Promise<Agent[]>
  addAgentToRoom(roomId: string, agentId: string): Promise<Result<null>>
  removeAgentFromRoom(roomId: string, agentId: string): Promise<Result<null>>

  listMessages(roomId: string, limit?: number): Promise<Message[]>
  sendChat(input: ChatSendInput): Promise<Result<{ runId: string; userMessage: Message }>>
  stopChat(runId: string): Promise<Result<null>>
  pauseChat(runId: string, paused: boolean): Promise<Result<null>>
  onChatEvent(listener: (event: ChatEvent) => void): () => void
  onDataChanged(listener: () => void): () => void

  generatePersona(input: PersonaDraftInput, confirmed: boolean): Promise<Result<PersonaResult>>
  readMarkdownFile(): Promise<MarkdownPick>
  saveMarkdown(defaultName: string, content: string): Promise<Result<string>>

  getStats(): Promise<StatsOverview>
  listMemories(agentId?: string, tier?: string): Promise<MemoryItem[]>
  addMemory(input: { agentId: string; roomId?: string | null; tier: MemoryItem['tier']; content: string; importance?: number }): Promise<Result<MemoryItem>>
  updateMemory(id: string, patch: { content?: string; tier?: MemoryItem['tier']; importance?: number }): Promise<Result<null>>
  deleteMemory(id: string): Promise<Result<null>>

  exportBackup(): Promise<Result<string>>
  importBackup(): Promise<Result<string>>
  revealDataDir(): Promise<void>
  openExternal(url: string): Promise<Result<null>>
}
