import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import type {
  Agent, AgentInput, AppSettings, MemoryItem, Message, ProviderConfig, Room,
  StatsOverview, TokenTotals, Usage, UsageRow
} from '../shared/types'
import { estimateCost } from '../shared/presets'
import { copyCharacterAvatar, getCharacterPack } from './characters'

let SQL: SqlJsStatic | null = null
let db: Database | null = null
let dbPath = ''
let dataDir = ''
let saveTimer: NodeJS.Timeout | null = null
let dirty = false

const DEFAULT_SETTINGS: AppSettings = {
  onboarded: false,
  userName: '旅人',
  theme: 'light',
  contextLimit: 32000,
  maxContextChars: 24000,
  autoMemory: true,
  language: 'zh-CN',
  allowPrivateNetwork: false,
  demoMode: false
}

export function getDataDir(): string { return dataDir }
export function getDbPath(): string { return dbPath }

export function initDatabase(userDataDir: string): void {
  dataDir = path.join(userDataDir, 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  dbPath = path.join(dataDir, 'tea-party.db')
}

export async function openDatabase(): Promise<void> {
  if (!SQL) {
    const wasm = path.join(require.resolve('sql.js'), '..', 'sql-wasm.wasm')
    SQL = await initSqlJs({ wasmBinary: fs.readFileSync(wasm) as unknown as ArrayBuffer, useOldExtensionFunctions: true })
  }
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath))
  } else {
    db = new SQL.Database()
  }
  db.run('PRAGMA foreign_keys = ON')
  migrate()
  persistNow()
}

export function closeDatabase(): void {
  persistNow()
  db?.close()
  db = null
}

function migrate(): void {
  d().run(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, preset TEXT NOT NULL, kind TEXT NOT NULL,
      base_url TEXT NOT NULL, models TEXT NOT NULL DEFAULT '[]', enabled INTEGER NOT NULL DEFAULT 1,
      is_local INTEGER NOT NULL DEFAULT 0, allow_private INTEGER NOT NULL DEFAULT 0,
      note TEXT, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar_path TEXT, summary TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL, provider_id TEXT, model_id TEXT,
      temperature REAL NOT NULL DEFAULT 0.8, max_tokens INTEGER NOT NULL DEFAULT 1200,
      memory_enabled INTEGER NOT NULL DEFAULT 1, greeting TEXT NOT NULL DEFAULT '',
      source_character TEXT, created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'idle'
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, topic TEXT NOT NULL DEFAULT '',
      host_agent_id TEXT, max_rounds INTEGER NOT NULL DEFAULT 2, max_tokens INTEGER NOT NULL DEFAULT 8000,
      discussion_mode INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS room_agents (
      room_id TEXT NOT NULL, agent_id TEXT NOT NULL, joined_at INTEGER NOT NULL,
      PRIMARY KEY (room_id, agent_id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, room_id TEXT NOT NULL, sender_type TEXT NOT NULL, sender_id TEXT,
      sender_name TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL,
      tokens_in INTEGER NOT NULL DEFAULT 0, tokens_out INTEGER NOT NULL DEFAULT 0,
      estimated INTEGER NOT NULL DEFAULT 0, quote_id TEXT, meta TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
    CREATE TABLE IF NOT EXISTS usage_log (
      id TEXT PRIMARY KEY, room_id TEXT, agent_id TEXT, provider_id TEXT, model_id TEXT,
      input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
      cached_tokens INTEGER NOT NULL DEFAULT 0, estimated INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, room_id TEXT, tier TEXT NOT NULL,
      content TEXT NOT NULL, importance REAL NOT NULL DEFAULT 0.5,
      created_at INTEGER NOT NULL, last_used_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS summaries (
      id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, room_id TEXT, content TEXT NOT NULL,
      covers_up_to INTEGER NOT NULL, created_at INTEGER NOT NULL
    );
  `)
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    d().run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)])
  }
}

function d(): Database {
  if (!db) throw new Error('数据库尚未初始化')
  return db
}

export function persistNow(): void {
  if (!db) return
  try {
    const bytes = db.export()
    const tmp = dbPath + '.tmp'
    fs.writeFileSync(tmp, Buffer.from(bytes))
    fs.renameSync(tmp, dbPath)
    dirty = false
  } catch (err) {
    console.error('数据库保存失败', err)
  }
}

function scheduleSave(): void {
  dirty = true
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (dirty) persistNow()
  }, 400)
}

function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const stmt = d().prepare(sql)
  try {
    stmt.bind(params as never)
    const rows: T[] = []
    while (stmt.step()) rows.push(stmt.getAsObject() as T)
    return rows
  } finally {
    stmt.free()
  }
}

function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
  const rows = queryAll<T>(sql, params)
  return rows[0] ?? null
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0)
const bool = (v: unknown): boolean => num(v) === 1
const str = (v: unknown): string => (v == null ? '' : String(v))
const parseJson = <T,>(v: unknown, fallback: T): T => {
  try { return typeof v === 'string' ? JSON.parse(v) as T : fallback } catch { return fallback }
}

/* ---------------- settings ---------------- */

export function getSettings(): AppSettings {
  const rows = queryAll<{ key: string; value: string }>('SELECT key, value FROM settings')
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  for (const row of rows) result[row.key] = parseJson(row.value, null)
  return result as unknown as AppSettings
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  for (const [key, value] of Object.entries(patch)) {
    d().run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, JSON.stringify(value)])
  }
  scheduleSave()
  return getSettings()
}

/* ---------------- providers ---------------- */

function mapProvider(row: Record<string, unknown>): ProviderConfig {
  return {
    id: str(row.id), name: str(row.name), preset: str(row.preset), kind: str(row.kind) as ProviderConfig['kind'],
    baseUrl: str(row.base_url), models: parseJson<string[]>(row.models, []), enabled: bool(row.enabled),
    isLocal: bool(row.is_local), allowPrivateNetwork: bool(row.allow_private),
    createdAt: num(row.created_at), note: row.note ? str(row.note) : undefined
  }
}

export function listProviders(): ProviderConfig[] {
  return queryAll('SELECT * FROM providers ORDER BY created_at ASC').map(mapProvider)
}

export function getProvider(id: string): ProviderConfig | null {
  const row = queryOne('SELECT * FROM providers WHERE id = ?', [id])
  return row ? mapProvider(row) : null
}

export function saveProvider(input: Partial<ProviderConfig> & { name: string; baseUrl: string; kind: ProviderConfig['kind']; preset: string }): ProviderConfig {
  const existing = input.id ? getProvider(input.id) : null
  const id = input.id ?? randomUUID()
  const row: ProviderConfig = {
    id,
    name: input.name.trim() || '未命名 Provider',
    preset: input.preset,
    kind: input.kind,
    baseUrl: input.baseUrl.trim().replace(/\/+$/, ''),
    models: input.models ?? [],
    enabled: input.enabled ?? true,
    isLocal: input.isLocal ?? false,
    allowPrivateNetwork: input.allowPrivateNetwork ?? false,
    createdAt: existing?.createdAt ?? Date.now(),
    note: input.note
  }
  d().run(`INSERT INTO providers (id,name,preset,kind,base_url,models,enabled,is_local,allow_private,note,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, preset=excluded.preset, kind=excluded.kind,
      base_url=excluded.base_url, models=excluded.models, enabled=excluded.enabled,
      is_local=excluded.is_local, allow_private=excluded.allow_private, note=excluded.note`,
    [row.id, row.name, row.preset, row.kind, row.baseUrl, JSON.stringify(row.models), row.enabled ? 1 : 0,
      row.isLocal ? 1 : 0, row.allowPrivateNetwork ? 1 : 0, row.note ?? null, row.createdAt])
  scheduleSave()
  return row
}

export function deleteProvider(id: string): void {
  d().run('DELETE FROM providers WHERE id = ?', [id])
  d().run('UPDATE agents SET provider_id = NULL, model_id = NULL WHERE provider_id = ?', [id])
  scheduleSave()
}

/* ---------------- agents ---------------- */

function mapAgent(row: Record<string, unknown>): Agent {
  return {
    id: str(row.id), name: str(row.name), avatarPath: row.avatar_path ? str(row.avatar_path) : null,
    summary: str(row.summary), systemPrompt: str(row.system_prompt), providerId: row.provider_id ? str(row.provider_id) : null,
    modelId: row.model_id ? str(row.model_id) : null, temperature: num(row.temperature), maxTokens: num(row.max_tokens),
    memoryEnabled: bool(row.memory_enabled), greeting: str(row.greeting),
    sourceCharacter: row.source_character ? str(row.source_character) : null,
    createdAt: num(row.created_at), status: str(row.status)
  }
}

export function listAgents(): Agent[] {
  return queryAll('SELECT * FROM agents ORDER BY created_at ASC').map(mapAgent)
}

export function getAgent(id: string): Agent | null {
  const row = queryOne('SELECT * FROM agents WHERE id = ?', [id])
  return row ? mapAgent(row) : null
}

export function saveAgent(input: AgentInput): Agent {
  const existing = input.id ? getAgent(input.id) : null
  const id = input.id ?? randomUUID()
  const agent: Agent = {
    id, name: input.name.trim() || '未命名 Agent',
    avatarPath: input.avatarPath ?? existing?.avatarPath ?? null,
    summary: input.summary ?? existing?.summary ?? '',
    systemPrompt: input.systemPrompt,
    providerId: input.providerId !== undefined ? input.providerId : existing?.providerId ?? null,
    modelId: input.modelId !== undefined ? input.modelId : existing?.modelId ?? null,
    temperature: input.temperature ?? existing?.temperature ?? 0.8,
    maxTokens: input.maxTokens ?? existing?.maxTokens ?? 1200,
    memoryEnabled: input.memoryEnabled ?? existing?.memoryEnabled ?? true,
    greeting: input.greeting ?? existing?.greeting ?? '',
    sourceCharacter: input.sourceCharacter !== undefined ? input.sourceCharacter : existing?.sourceCharacter ?? null,
    createdAt: existing?.createdAt ?? Date.now(),
    status: 'idle'
  }
  d().run(`INSERT INTO agents (id,name,avatar_path,summary,system_prompt,provider_id,model_id,temperature,max_tokens,memory_enabled,greeting,source_character,created_at,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, avatar_path=excluded.avatar_path, summary=excluded.summary,
      system_prompt=excluded.system_prompt, provider_id=excluded.provider_id, model_id=excluded.model_id,
      temperature=excluded.temperature, max_tokens=excluded.max_tokens, memory_enabled=excluded.memory_enabled,
      greeting=excluded.greeting, source_character=excluded.source_character`,
    [agent.id, agent.name, agent.avatarPath, agent.summary, agent.systemPrompt, agent.providerId, agent.modelId,
      agent.temperature, agent.maxTokens, agent.memoryEnabled ? 1 : 0, agent.greeting, agent.sourceCharacter, agent.createdAt, agent.status])
  scheduleSave()
  return agent
}

export function deleteAgent(id: string): void {
  d().run('DELETE FROM agents WHERE id = ?', [id])
  d().run('DELETE FROM room_agents WHERE agent_id = ?', [id])
  d().run('UPDATE rooms SET host_agent_id = NULL WHERE host_agent_id = ?', [id])
  d().run('DELETE FROM memories WHERE agent_id = ?', [id])
  scheduleSave()
}

/* ---------------- rooms ---------------- */

function mapRoom(row: Record<string, unknown>): Room {
  return {
    id: str(row.id), name: str(row.name), topic: str(row.topic),
    hostAgentId: row.host_agent_id ? str(row.host_agent_id) : null,
    maxRounds: num(row.max_rounds), maxTokens: num(row.max_tokens),
    discussionMode: bool(row.discussion_mode), createdAt: num(row.created_at), updatedAt: num(row.updated_at)
  }
}

export function listRooms(): Room[] {
  return queryAll('SELECT * FROM rooms ORDER BY updated_at DESC').map(mapRoom)
}

export function getRoom(id: string): Room | null {
  const row = queryOne('SELECT * FROM rooms WHERE id = ?', [id])
  return row ? mapRoom(row) : null
}

export function createRoom(input: { name: string; topic?: string; hostAgentId?: string | null; maxRounds?: number; maxTokens?: number; discussionMode?: boolean; agentIds?: string[] }): Room {
  const id = randomUUID()
  const now = Date.now()
  const room: Room = {
    id, name: input.name.trim() || '新茶会', topic: input.topic ?? '',
    hostAgentId: input.hostAgentId ?? null, maxRounds: input.maxRounds ?? 2, maxTokens: input.maxTokens ?? 8000,
    discussionMode: input.discussionMode ?? true, createdAt: now, updatedAt: now
  }
  d().run('INSERT INTO rooms (id,name,topic,host_agent_id,max_rounds,max_tokens,discussion_mode,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [room.id, room.name, room.topic, room.hostAgentId, room.maxRounds, room.maxTokens, room.discussionMode ? 1 : 0, now, now])
  for (const agentId of input.agentIds ?? []) addAgentToRoom(room.id, agentId)
  scheduleSave()
  return room
}

export function updateRoom(id: string, patch: Partial<Room>): Room {
  const room = getRoom(id)
  if (!room) throw new Error('房间不存在')
  const next = { ...room, ...patch, id, updatedAt: Date.now() }
  d().run('UPDATE rooms SET name=?, topic=?, host_agent_id=?, max_rounds=?, max_tokens=?, discussion_mode=?, updated_at=? WHERE id=?',
    [next.name, next.topic, next.hostAgentId, next.maxRounds, next.maxTokens, next.discussionMode ? 1 : 0, next.updatedAt, id])
  scheduleSave()
  return next
}

export function deleteRoom(id: string): void {
  d().run('DELETE FROM messages WHERE room_id = ?', [id])
  d().run('DELETE FROM room_agents WHERE room_id = ?', [id])
  d().run('DELETE FROM usage_log WHERE room_id = ?', [id])
  d().run('DELETE FROM rooms WHERE id = ?', [id])
  scheduleSave()
}

export function addAgentToRoom(roomId: string, agentId: string): void {
  d().run('INSERT OR IGNORE INTO room_agents (room_id, agent_id, joined_at) VALUES (?,?,?)', [roomId, agentId, Date.now()])
  d().run('UPDATE rooms SET updated_at = ? WHERE id = ?', [Date.now(), roomId])
  scheduleSave()
}

export function removeAgentFromRoom(roomId: string, agentId: string): void {
  d().run('DELETE FROM room_agents WHERE room_id = ? AND agent_id = ?', [roomId, agentId])
  d().run('UPDATE rooms SET host_agent_id = NULL WHERE room_id = ? AND host_agent_id = ?', [roomId, agentId])
  scheduleSave()
}

export function listRoomAgents(roomId: string): Agent[] {
  return queryAll<Record<string, unknown>>(`SELECT a.* FROM agents a JOIN room_agents ra ON ra.agent_id = a.id
    WHERE ra.room_id = ? ORDER BY ra.joined_at ASC`, [roomId]).map(mapAgent)
}

/* ---------------- messages ---------------- */

function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: str(row.id), roomId: str(row.room_id), senderType: str(row.sender_type) as Message['senderType'],
    senderId: row.sender_id ? str(row.sender_id) : null, senderName: str(row.sender_name),
    content: str(row.content), createdAt: num(row.created_at), tokensIn: num(row.tokens_in),
    tokensOut: num(row.tokens_out), estimated: bool(row.estimated),
    quoteId: row.quote_id ? str(row.quote_id) : null, meta: parseJson<Record<string, unknown> | null>(row.meta, null)
  }
}

export function listMessages(roomId: string, limit = 100, before?: number): Message[] {
  const rows = before
    ? queryAll('SELECT * FROM messages WHERE room_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?', [roomId, before, limit])
    : queryAll('SELECT * FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT ?', [roomId, limit])
  return rows.reverse().map(mapMessage)
}

export function getMessage(id: string): Message | null {
  const row = queryOne('SELECT * FROM messages WHERE id = ?', [id])
  return row ? mapMessage(row) : null
}

export function addMessage(input: { roomId: string; senderType: Message['senderType']; senderId?: string | null; senderName: string; content: string; tokensIn?: number; tokensOut?: number; estimated?: boolean; quoteId?: string | null; meta?: Record<string, unknown> | null; createdAt?: number }): Message {
  const message: Message = {
    id: randomUUID(), roomId: input.roomId, senderType: input.senderType, senderId: input.senderId ?? null,
    senderName: input.senderName, content: input.content, createdAt: input.createdAt ?? Date.now(),
    tokensIn: input.tokensIn ?? 0, tokensOut: input.tokensOut ?? 0, estimated: input.estimated ?? false,
    quoteId: input.quoteId ?? null, meta: input.meta ?? null
  }
  d().run(`INSERT INTO messages (id,room_id,sender_type,sender_id,sender_name,content,created_at,tokens_in,tokens_out,estimated,quote_id,meta)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [message.id, message.roomId, message.senderType, message.senderId, message.senderName, message.content,
      message.createdAt, message.tokensIn, message.tokensOut, message.estimated ? 1 : 0, message.quoteId,
      message.meta ? JSON.stringify(message.meta) : null])
  d().run('UPDATE rooms SET updated_at = ? WHERE id = ?', [Date.now(), message.roomId])
  scheduleSave()
  return message
}

export function updateMessage(id: string, patch: { content?: string; tokensIn?: number; tokensOut?: number; estimated?: boolean; meta?: Record<string, unknown> | null }): void {
  const msg = getMessage(id)
  if (!msg) return
  d().run('UPDATE messages SET content=?, tokens_in=?, tokens_out=?, estimated=?, meta=? WHERE id=?',
    [patch.content ?? msg.content, patch.tokensIn ?? msg.tokensIn, patch.tokensOut ?? msg.tokensOut,
      (patch.estimated ?? msg.estimated) ? 1 : 0, JSON.stringify(patch.meta ?? msg.meta), id])
  scheduleSave()
}

/* ---------------- usage ---------------- */

export function logUsage(row: { roomId: string | null; agentId: string | null; providerId: string | null; modelId: string | null; usage: Usage }): void {
  d().run('INSERT INTO usage_log (id,room_id,agent_id,provider_id,model_id,input_tokens,output_tokens,cached_tokens,estimated,cost_usd,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [randomUUID(), row.roomId, row.agentId, row.providerId, row.modelId, row.usage.inputTokens, row.usage.outputTokens,
      row.usage.cachedTokens, row.usage.estimated ? 1 : 0, row.usage.costUsd, Date.now()])
  scheduleSave()
}

function emptyTotals(): TokenTotals {
  return { inputTokens: 0, outputTokens: 0, cachedTokens: 0, costUsd: 0, messages: 0, estimatedMessages: 0, continuations: 0 }
}

export function getTotals(): TokenTotals {
  const row = queryOne<Record<string, unknown>>('SELECT COUNT(*) AS c, SUM(input_tokens) AS i, SUM(output_tokens) AS o, SUM(cached_tokens) AS k, SUM(cost_usd) AS cost, SUM(estimated) AS e FROM usage_log')
  if (!row) return emptyTotals()
  return {
    inputTokens: num(row.i), outputTokens: num(row.o), cachedTokens: num(row.k), costUsd: num(row.cost),
    messages: num(row.c), estimatedMessages: num(row.e), continuations: getContinuationCount()
  }
}

function getContinuationCount(): number {
  const row = queryOne<Record<string, unknown>>("SELECT COUNT(*) AS c FROM summaries")
  return num(row?.c)
}

export function getStats(): StatsOverview {
  const totals = getTotals()
  const byAgent = queryAll<Record<string, unknown>>(`SELECT u.agent_id AS id, COALESCE(a.name, '已删除 Agent') AS name,
      SUM(u.input_tokens) AS i, SUM(u.output_tokens) AS o, SUM(u.cost_usd) AS cost, COUNT(*) AS c
    FROM usage_log u LEFT JOIN agents a ON a.id = u.agent_id GROUP BY u.agent_id ORDER BY (i+o) DESC`)
    .map((r) => ({ agentId: str(r.id), agentName: str(r.name), input: num(r.i), output: num(r.o), costUsd: num(r.cost), messages: num(r.c) }))
  const byProvider = queryAll<Record<string, unknown>>(`SELECT u.provider_id AS id, COALESCE(p.name, '未记录') AS name,
      SUM(u.input_tokens) AS i, SUM(u.output_tokens) AS o, SUM(u.cost_usd) AS cost, COUNT(*) AS c
    FROM usage_log u LEFT JOIN providers p ON p.id = u.provider_id GROUP BY u.provider_id ORDER BY (i+o) DESC`)
    .map((r) => ({ providerId: str(r.id), providerName: str(r.name), input: num(r.i), output: num(r.o), costUsd: num(r.cost), messages: num(r.c) }))
  const byRoom = queryAll<Record<string, unknown>>(`SELECT u.room_id AS id, COALESCE(r.name, '已删除房间') AS name,
      SUM(u.input_tokens) AS i, SUM(u.output_tokens) AS o, SUM(u.cost_usd) AS cost, COUNT(*) AS c
    FROM usage_log u LEFT JOIN rooms r ON r.id = u.room_id GROUP BY u.room_id ORDER BY (i+o) DESC`)
    .map((r) => ({ roomId: str(r.id), roomName: str(r.name), input: num(r.i), output: num(r.o), costUsd: num(r.cost), messages: num(r.c) }))
  const recent = queryAll<Record<string, unknown>>(`SELECT u.*, a.name AS agent_name, p.name AS provider_name FROM usage_log u
    LEFT JOIN agents a ON a.id = u.agent_id LEFT JOIN providers p ON p.id = u.provider_id
    ORDER BY u.created_at DESC LIMIT 50`).map((r): UsageRow => ({
      id: str(r.id), roomId: r.room_id ? str(r.room_id) : null, agentId: r.agent_id ? str(r.agent_id) : null,
      agentName: r.agent_name ? str(r.agent_name) : undefined, providerId: r.provider_id ? str(r.provider_id) : null,
      providerName: r.provider_name ? str(r.provider_name) : undefined, modelId: r.model_id ? str(r.model_id) : null,
      inputTokens: num(r.input_tokens), outputTokens: num(r.output_tokens), cachedTokens: num(r.cached_tokens),
      estimated: bool(r.estimated), costUsd: num(r.cost_usd), createdAt: num(r.created_at)
    }))
  return { totals, byAgent, byProvider, byRoom, recent }
}

/* ---------------- memories ---------------- */

function mapMemory(row: Record<string, unknown>): MemoryItem {
  return {
    id: str(row.id), agentId: str(row.agent_id), roomId: row.room_id ? str(row.room_id) : null,
    tier: str(row.tier) as MemoryItem['tier'], content: str(row.content), importance: num(row.importance),
    createdAt: num(row.created_at), lastUsedAt: row.last_used_at ? num(row.last_used_at) : null
  }
}

export function listMemories(agentId?: string, tier?: string): MemoryItem[] {
  if (agentId && tier) return queryAll('SELECT * FROM memories WHERE agent_id = ? AND tier = ? ORDER BY created_at DESC', [agentId, tier]).map(mapMemory)
  if (agentId) return queryAll('SELECT * FROM memories WHERE agent_id = ? ORDER BY created_at DESC LIMIT 500', [agentId]).map(mapMemory)
  return queryAll('SELECT * FROM memories ORDER BY created_at DESC LIMIT 1000').map(mapMemory)
}

export function addMemory(input: { agentId: string; roomId?: string | null; tier: MemoryItem['tier']; content: string; importance?: number }): MemoryItem {
  const mem: MemoryItem = {
    id: randomUUID(), agentId: input.agentId, roomId: input.roomId ?? null, tier: input.tier,
    content: input.content, importance: input.importance ?? 0.5, createdAt: Date.now(), lastUsedAt: null
  }
  d().run('INSERT INTO memories (id,agent_id,room_id,tier,content,importance,created_at,last_used_at) VALUES (?,?,?,?,?,?,?,?)',
    [mem.id, mem.agentId, mem.roomId, mem.tier, mem.content, mem.importance, mem.createdAt, null])
  scheduleSave()
  return mem
}

export function updateMemory(id: string, patch: { content?: string; tier?: string; importance?: number }): void {
  const row = queryOne<Record<string, unknown>>('SELECT * FROM memories WHERE id = ?', [id])
  if (!row) return
  d().run('UPDATE memories SET content=?, tier=?, importance=? WHERE id=?',
    [patch.content ?? str(row.content), patch.tier ?? str(row.tier), patch.importance ?? num(row.importance), id])
  scheduleSave()
}

export function deleteMemory(id: string): void {
  d().run('DELETE FROM memories WHERE id = ?', [id])
  scheduleSave()
}

export function touchMemories(ids: string[]): void {
  for (const id of ids) d().run('UPDATE memories SET last_used_at = ? WHERE id = ?', [Date.now(), id])
  scheduleSave()
}

export function countMemories(agentId: string): number {
  return num(queryOne<Record<string, unknown>>('SELECT COUNT(*) AS c FROM memories WHERE agent_id = ?', [agentId])?.c)
}

export function oldMemories(agentId: string, limit: number): MemoryItem[] {
  return queryAll('SELECT * FROM memories WHERE agent_id = ? ORDER BY created_at ASC LIMIT ?', [agentId, limit]).map(mapMemory)
}

/* ---------------- summaries ---------------- */

export function latestSummary(agentId: string, roomId: string): { content: string; coversUpTo: number } | null {
  const row = queryOne<Record<string, unknown>>('SELECT * FROM summaries WHERE agent_id = ? AND room_id = ? ORDER BY covers_up_to DESC LIMIT 1', [agentId, roomId])
  return row ? { content: str(row.content), coversUpTo: num(row.covers_up_to) } : null
}

export function addSummary(input: { agentId: string; roomId: string; content: string; coversUpTo: number }): void {
  d().run('INSERT INTO summaries (id,agent_id,room_id,content,covers_up_to,created_at) VALUES (?,?,?,?,?,?)',
    [randomUUID(), input.agentId, input.roomId, input.content, input.coversUpTo, Date.now()])
  scheduleSave()
}

/* ---------------- demo / maintenance ---------------- */

function seedAvatar(agent: Agent, characterId: string): Agent {
  const pack = getCharacterPack(characterId)
  if (!pack) return agent
  const avatarPath = copyCharacterAvatar(pack, agent.id)
  return avatarPath ? saveAgent({ ...agent, avatarPath }) : agent
}

export function seedDemo(): void {
  const now = Date.now()
  const provider = saveProvider({ name: '演示 Provider（未联网）', preset: 'demo', kind: 'mock', baseUrl: 'mock://demo', models: ['demo-girl'], enabled: true, isLocal: true, note: '仅用于界面演示，不会发送任何网络请求' })
  const a1 = seedAvatar(saveAgent({
    name: '小雨', summary: '温柔、慢热的邻座少女，喜欢在雨天泡茶',
    systemPrompt: '# 小雨\n*把每个普通日子过成值得记住的小事。*\n\n## 身份\n你是小雨，一间旧书店的看店人。\n\n## 说话风格\n轻声、短句，偶尔用天气作比喻。\n\n## 角色行为原则\n你是 AI 角色扮演，不冒充真人。',
    providerId: provider.id, modelId: 'demo-girl', temperature: 0.8, maxTokens: 800, greeting: '雨好像要停了。要进来坐一会儿吗？', sourceCharacter: 'xiaoyu'
  }), 'xiaoyu')
  const a2 = seedAvatar(saveAgent({
    name: '月见', summary: '清冷的天文社社长，习惯把心事写进观测记录',
    systemPrompt: '# 月见\n*星星不会回答，但她会。*\n\n## 身份\n你是月见，天文社社长。\n\n## 说话风格\n克制、准确，偶尔冒出一句很轻的诗。',
    providerId: provider.id, modelId: 'demo-girl', temperature: 0.7, maxTokens: 800, greeting: '今晚云量三成。你要是抬头，应该能看见织女星。', sourceCharacter: 'yuejian'
  }), 'yuejian')
  const room = createRoom({ name: '雨夜茶会', topic: '聊聊最近读到的句子', hostAgentId: a1.id, agentIds: [a1.id, a2.id] })
  addMessage({ roomId: room.id, senderType: 'system', senderName: '茶会', content: '雨夜茶会已开始。两位 Agent 已入座。', meta: { demo: true } })
  addMessage({ roomId: room.id, senderType: 'agent', senderId: a1.id, senderName: a1.name, content: '茶刚泡好。今天读到了一句话：「安静不是没有声音，是声音终于有了位置。」', tokensIn: 320, tokensOut: 48, estimated: true })
  addMessage({ roomId: room.id, senderType: 'agent', senderId: a2.id, senderName: a2.name, content: '……这句不错。那我补一句：星星也不是没有光，是光走了很久才到。', tokensIn: 380, tokensOut: 42, estimated: true })
  addMessage({ roomId: room.id, senderType: 'user', senderName: '旅人', content: '你们两个一唱一和的，我杯子都忘了端。', tokensIn: 0, tokensOut: 0 })
  const mem = addMemory({ agentId: a1.id, roomId: room.id, tier: 'long', content: '用户喜欢在雨夜聊天，杯子常常忘记端起来。', importance: 0.8 })
  addMemory({ agentId: a2.id, roomId: room.id, tier: 'short', content: '用户对「光走了很久才到」这个比喻有反应。', importance: 0.6 })
  d().run('UPDATE memories SET created_at = ? WHERE id = ?', [now, mem.id])
  saveSettings({ onboarded: true })
}
