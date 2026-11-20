import { contextBridge, ipcRenderer } from 'electron'
import type { AgentInput, AppSettings, ChatEvent, ChatSendInput, PersonaDraftInput, Room } from '../shared/types'
import type { ProviderInput, TeaApi } from '../shared/api'

const api: TeaApi = {
  bootstrap: () => ipcRenderer.invoke('tea:bootstrap'),
  updateSettings: (patch: Partial<AppSettings>) => ipcRenderer.invoke('tea:settings:update', patch),
  appInfo: () => ipcRenderer.invoke('tea:app-info'),

  listProviders: () => ipcRenderer.invoke('tea:providers:list'),
  saveProvider: (input: ProviderInput, apiKey?: string) => ipcRenderer.invoke('tea:providers:save', input, apiKey),
  deleteProvider: (id: string) => ipcRenderer.invoke('tea:providers:delete', id),
  testProvider: (id: string) => ipcRenderer.invoke('tea:providers:test', id),
  fetchModels: (id: string) => ipcRenderer.invoke('tea:providers:models', id),
  hasProviderKey: (id: string) => ipcRenderer.invoke('tea:providers:has-key', id),
  removeProviderKey: (id: string) => ipcRenderer.invoke('tea:providers:remove-key', id),

  listCharacters: () => ipcRenderer.invoke('tea:characters:list'),
  getCharacter: (id: string) => ipcRenderer.invoke('tea:characters:get', id),
  createAgentFromCharacter: (input) => ipcRenderer.invoke('tea:characters:create-agent', input),
  chooseAvatar: () => ipcRenderer.invoke('tea:avatar:choose'),
  importAvatar: (sourcePath: string) => ipcRenderer.invoke('tea:avatar:import', sourcePath),
  avatarDataUrl: (filePath: string) => ipcRenderer.invoke('tea:avatar:data', filePath),

  listAgents: () => ipcRenderer.invoke('tea:agents:list'),
  saveAgent: (input: AgentInput) => ipcRenderer.invoke('tea:agents:save', input),
  deleteAgent: (id: string) => ipcRenderer.invoke('tea:agents:delete', id),
  chooseAgentAvatar: (agentId: string) => ipcRenderer.invoke('tea:agents:choose-avatar', agentId),

  listRooms: () => ipcRenderer.invoke('tea:rooms:list'),
  createRoom: (input) => ipcRenderer.invoke('tea:rooms:create', input),
  updateRoom: (id: string, patch: Partial<Room>) => ipcRenderer.invoke('tea:rooms:update', id, patch),
  deleteRoom: (id: string) => ipcRenderer.invoke('tea:rooms:delete', id),
  listRoomAgents: (roomId: string) => ipcRenderer.invoke('tea:rooms:agents', roomId),
  addAgentToRoom: (roomId: string, agentId: string) => ipcRenderer.invoke('tea:rooms:add-agent', roomId, agentId),
  removeAgentFromRoom: (roomId: string, agentId: string) => ipcRenderer.invoke('tea:rooms:remove-agent', roomId, agentId),

  listMessages: (roomId: string, limit?: number) => ipcRenderer.invoke('tea:messages:list', roomId, limit),
  sendChat: (input: ChatSendInput) => ipcRenderer.invoke('tea:chat:send', input),
  stopChat: (runId: string) => ipcRenderer.invoke('tea:chat:stop', runId),
  pauseChat: (runId: string, paused: boolean) => ipcRenderer.invoke('tea:chat:pause', runId, paused),
  onChatEvent: (listener: (event: ChatEvent) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, event: ChatEvent) => listener(event)
    ipcRenderer.on('tea:chat-event', handler)
    return () => ipcRenderer.removeListener('tea:chat-event', handler)
  },
  onDataChanged: (listener: () => void) => {
    const handler = () => listener()
    ipcRenderer.on('tea:data-changed', handler)
    return () => ipcRenderer.removeListener('tea:data-changed', handler)
  },

  generatePersona: (input: PersonaDraftInput, confirmed: boolean) => ipcRenderer.invoke('tea:persona:generate', input, confirmed),
  readMarkdownFile: () => ipcRenderer.invoke('tea:persona:read-markdown'),
  saveMarkdown: (defaultName: string, content: string) => ipcRenderer.invoke('tea:persona:save-markdown', defaultName, content),

  getStats: () => ipcRenderer.invoke('tea:stats:get'),
  listMemories: (agentId?: string, tier?: string) => ipcRenderer.invoke('tea:memories:list', agentId, tier),
  addMemory: (input) => ipcRenderer.invoke('tea:memories:add', input),
  updateMemory: (id: string, patch) => ipcRenderer.invoke('tea:memories:update', id, patch),
  deleteMemory: (id: string) => ipcRenderer.invoke('tea:memories:delete', id),

  exportBackup: () => ipcRenderer.invoke('tea:backup:export'),
  importBackup: () => ipcRenderer.invoke('tea:backup:import'),
  revealDataDir: () => ipcRenderer.invoke('tea:data:reveal'),
  openExternal: (url: string) => ipcRenderer.invoke('tea:open-external', url)
}

contextBridge.exposeInMainWorld('tea', api)
