import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  AgentInput, AppSettings, CharacterPack, ChatSendInput, PersonaDraftInput, PersonaResult,
  ProviderConfig, Result, Room
} from '../shared/types'
import type { ProviderInput } from '../shared/api'
import { buildPersonaFromFreeText, buildPersonaUserPrompt, localPersonaDraft, PERSONA_SYSTEM_PROMPT, suggestedNameFromMarkdown } from '../shared/persona'
import * as db from './db'
import { getCredential, hasCredential, removeCredential, setCredential } from './credentials'
import { chatComplete, estimateTokens, makeUsage, testProvider, fetchModels, validateBaseUrl } from './providers'
import { copyCharacterAvatar, getCharacterPack, importAvatarFile, listCharacterPacks, readAvatarDataUrl } from './characters'
import { startChat, stopChat, pauseChat, stopAllChats } from './chat'

const isDev = !app.isPackaged

let devBuild = process.env.TEA_DEV_SKIP_ONBOARDING === '1' || process.argv.includes('--skip-onboarding')
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')) as { teaDevBuild?: boolean }
  devBuild = devBuild || pkg.teaDevBuild === true
} catch { /* package.json is not essential for boot */ }

const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
if (portableDir) {
  app.setPath('userData', path.join(portableDir, devBuild ? 'AgentTeaPartyDevData' : 'AgentTeaPartyData'))
}
if (process.env.TEA_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.TEA_USER_DATA))
}
app.setName(devBuild ? 'Agent Tea Party Dev' : 'Agent Tea Party')

let mainWindow: BrowserWindow | null = null

function ok<T>(data: T): Result<T> { return { ok: true, data } }
function fail<T = never>(error: string): Result<T> { return { ok: false, error } }

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    title: devBuild ? 'Agent 茶话会 · 开发版' : 'Agent 茶话会',
    backgroundColor: '#0b0912',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      event.preventDefault()
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    }
  })
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (isDev && input.key === 'F12') mainWindow?.webContents.toggleDevTools()
  })
  mainWindow.on('closed', () => { mainWindow = null })

  if (process.env.TEA_SMOKE_CAPTURE) {
    mainWindow.webContents.on('console-message', (_event, level, message) => {
      if (level >= 2) console.log('[renderer]', message)
    })
    mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
      console.error('[smoke] did-fail-load', code, description, url)
    })
    mainWindow.webContents.on('did-finish-load', () => {
      if (process.env.TEA_SMOKE_HASH) {
        const rawHash = process.env.TEA_SMOKE_HASH
        const hash = rawHash.startsWith('#') ? rawHash : '#/' + rawHash.replace(/^\/+/, '')
        setTimeout(() => {
          void mainWindow?.webContents.executeJavaScript(`location.hash = ${JSON.stringify(hash)}`).catch((e) => console.error('[smoke] hash failed', e))
        }, 900)
      }
      if (process.env.TEA_SMOKE_SEND) {
        const text = process.env.TEA_SMOKE_SEND
        setTimeout(() => {
          const script = `(async () => {
            const ta = document.querySelector('.composer textarea')
            if (!ta) return 'no-composer'
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
            setter.call(ta, ${JSON.stringify(text)})
            ta.dispatchEvent(new Event('input', { bubbles: true }))
            await new Promise((r) => setTimeout(r, 300))
            const btn = document.querySelector('.composer .send-btn')
            if (!btn) return 'no-send'
            if (btn.disabled) return 'send-disabled'
            btn.click()
            return 'sent'
          })()`
          mainWindow?.webContents.executeJavaScript(script).then((r) => console.log('[smoke] send', r)).catch((e) => console.error('[smoke] send failed', e))
        }, 1600)
      }
      setTimeout(async () => {
        try {
          const image = await mainWindow?.webContents.capturePage()
          if (image) {
            const target = path.resolve(process.env.TEA_SMOKE_CAPTURE as string)
            fs.mkdirSync(path.dirname(target), { recursive: true })
            fs.writeFileSync(target, image.toPNG())
            console.log('[smoke] screenshot saved', target, image.getSize())
          }
        } catch (err) {
          console.error('[smoke] capture failed', err)
        } finally {
          setTimeout(() => app.quit(), 150)
        }
      }, Number(process.env.TEA_SMOKE_DELAY ?? 2600))
    })
  }

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function bootstrapData() {
  return {
    settings: db.getSettings(),
    providers: db.listProviders(),
    agents: db.listAgents(),
    rooms: db.listRooms(),
    stats: db.getTotals(),
    version: app.getVersion(),
    dataDir: db.getDataDir()
  }
}

function sendDataChanged(): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('tea:data-changed')
}

function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, 60)
}

function uniqueAgentName(name: string): string {
  const existing = new Set(db.listAgents().map((a) => a.name))
  if (!existing.has(name)) return name
  for (let i = 2; i < 100; i++) {
    const candidate = `${name}（${i}）`
    if (!existing.has(candidate)) return candidate
  }
  return `${name}-${Date.now()}`
}

function providerInputError(input: ProviderInput): string | null {
  if (!input.name?.trim()) return '请填写 Provider 名称'
  if (!input.kind) return '请选择 Provider 类型'
  if (input.kind === 'mock') return null
  if (!input.baseUrl?.trim()) return '请填写 API Base URL'
  const check = validateBaseUrl(input.baseUrl, {
    isLocal: input.isLocal, allowPrivate: input.allowPrivateNetwork ?? db.getSettings().allowPrivateNetwork
  })
  if (!check.ok) return check.error ?? 'Base URL 无效'
  return null
}

function registerIpc(): void {
  ipcMain.handle('tea:bootstrap', () => bootstrapData())
  ipcMain.handle('tea:app-info', () => ({
    version: app.getVersion(), dataDir: db.getDataDir(), packaged: app.isPackaged, platform: process.platform, devBuild
  }))

  ipcMain.handle('tea:settings:update', (_e, patch: Partial<AppSettings>) => {
    const safe: Partial<AppSettings> = {}
    if (typeof patch.userName === 'string') safe.userName = patch.userName.trim().slice(0, 40) || '旅人'
    if (patch.theme === 'light' || patch.theme === 'dark') safe.theme = patch.theme
    if (typeof patch.onboarded === 'boolean') safe.onboarded = patch.onboarded
    if (typeof patch.autoMemory === 'boolean') safe.autoMemory = patch.autoMemory
    if (typeof patch.allowPrivateNetwork === 'boolean') safe.allowPrivateNetwork = patch.allowPrivateNetwork
    if (typeof patch.demoMode === 'boolean') safe.demoMode = patch.demoMode
    if (typeof patch.contextLimit === 'number') safe.contextLimit = Math.min(1_000_000, Math.max(2000, Math.round(patch.contextLimit)))
    if (typeof patch.maxContextChars === 'number') safe.maxContextChars = Math.min(400_000, Math.max(4000, Math.round(patch.maxContextChars)))
    const settings = db.saveSettings(safe)
    sendDataChanged()
    return settings
  })

  /* ---------------- providers ---------------- */

  ipcMain.handle('tea:providers:list', () => db.listProviders())
  ipcMain.handle('tea:providers:has-key', (_e, id: string) => hasCredential(id))
  ipcMain.handle('tea:providers:remove-key', (_e, id: string) => {
    removeCredential(id)
    return ok(null)
  })
  ipcMain.handle('tea:providers:save', (_e, input: ProviderInput, apiKey?: string): Result<ProviderConfig> => {
    const error = providerInputError(input)
    if (error) return fail(error)
    const provider = db.saveProvider(input)
    if (typeof apiKey === 'string') {
      try {
        setCredential(provider.id, apiKey)
      } catch (err) {
        return fail(`Provider 已保存，但 API Key 未能安全写入：${(err as Error).message}`)
      }
    }
    sendDataChanged()
    return ok(provider)
  })
  ipcMain.handle('tea:providers:delete', (_e, id: string) => {
    db.deleteProvider(id)
    removeCredential(id)
    sendDataChanged()
    return ok(null)
  })
  ipcMain.handle('tea:providers:test', async (_e, id: string) => {
    const provider = db.getProvider(id)
    if (!provider) return { ok: false, reachable: false, generation: false, latencyMs: 0, detail: 'Provider 不存在', models: [] }
    return testProvider(provider, provider.kind === 'mock' ? undefined : getCredential(id))
  })
  ipcMain.handle('tea:providers:models', async (_e, id: string) => {
    const provider = db.getProvider(id)
    if (!provider) return { ok: false, models: [], detail: 'Provider 不存在' }
    return fetchModels(provider, provider.kind === 'mock' ? undefined : getCredential(id))
  })

  /* ---------------- characters & avatars ---------------- */

  ipcMain.handle('tea:characters:list', () => listCharacterPacks())
  ipcMain.handle('tea:characters:get', (_e, id: string) => getCharacterPack(id))
  ipcMain.handle('tea:characters:create-agent', (_e, input: { characterId: string; providerId: string; modelId: string; name?: string }): Result<ReturnType<typeof db.saveAgent>> => {
    const pack = getCharacterPack(input.characterId)
    if (!pack) return fail('角色预设不存在')
    const provider = db.getProvider(input.providerId)
    if (!provider) return fail('请选择一个可用的 Provider')
    if (!input.modelId?.trim()) return fail('请选择模型')
    const name = uniqueAgentName(cleanName(input.name || pack.manifest.name))
    let agent = db.saveAgent({
      name,
      summary: pack.manifest.summary || pack.manifest.description,
      systemPrompt: pack.personality,
      providerId: provider.id,
      modelId: input.modelId.trim(),
      temperature: 0.8,
      maxTokens: 1200,
      memoryEnabled: true,
      greeting: pack.manifest.greeting ?? '',
      sourceCharacter: pack.manifest.id
    })
    const avatarPath = copyCharacterAvatar(pack, agent.id)
    if (avatarPath) agent = db.saveAgent({ ...agent, avatarPath })
    sendDataChanged()
    return ok(agent)
  })

  ipcMain.handle('tea:avatar:choose', async () => {
    if (!mainWindow) return { ok: false, error: '窗口未就绪' }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择头像', properties: ['openFile'],
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
    })
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true }
    const sourcePath = result.filePaths[0]
    const dataUrl = readAvatarDataUrl(sourcePath)
    if (!dataUrl) return { ok: false, error: '无法读取这张图片' }
    return { ok: true, sourcePath, dataUrl }
  })
  ipcMain.handle('tea:avatar:import', (_e, sourcePath: string, agentId: string): Result<string> => {
    try {
      return ok(importAvatarFile(sourcePath, agentId))
    } catch (err) {
      return fail((err as Error).message)
    }
  })
  ipcMain.handle('tea:avatar:data', (_e, filePath: string) => readAvatarDataUrl(filePath))

  /* ---------------- agents ---------------- */

  ipcMain.handle('tea:agents:list', () => db.listAgents())
  ipcMain.handle('tea:agents:save', (_e, input: AgentInput): Result<ReturnType<typeof db.saveAgent>> => {
    if (!input.name?.trim()) return fail('请给 Agent 取一个名字')
    if (!input.systemPrompt?.trim()) return fail('人格 System Prompt 不能为空')
    if (input.providerId && !db.getProvider(input.providerId)) return fail('所选 Provider 不存在')
    const agent = db.saveAgent({
      ...input,
      name: cleanName(input.name),
      temperature: Math.min(2, Math.max(0, input.temperature ?? 0.8)),
      maxTokens: Math.min(32000, Math.max(64, input.maxTokens ?? 1200))
    })
    sendDataChanged()
    return ok(agent)
  })
  ipcMain.handle('tea:agents:delete', (_e, id: string) => {
    db.deleteAgent(id)
    sendDataChanged()
    return ok(null)
  })
  ipcMain.handle('tea:agents:choose-avatar', async (_e, agentId: string): Promise<Result<string>> => {
    if (!mainWindow) return fail('窗口未就绪')
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择头像', properties: ['openFile'],
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
    })
    if (result.canceled || !result.filePaths[0]) return fail('已取消')
    try {
      return ok(importAvatarFile(result.filePaths[0], agentId))
    } catch (err) {
      return fail((err as Error).message)
    }
  })

  /* ---------------- rooms ---------------- */

  ipcMain.handle('tea:rooms:list', () => db.listRooms())
  ipcMain.handle('tea:rooms:create', (_e, input: { name: string; topic?: string; hostAgentId?: string | null; maxRounds?: number; maxTokens?: number; agentIds?: string[] }): Result<Room> => {
    if (!input.name?.trim()) return fail('请给聊天室取一个名字')
    const room = db.createRoom({
      ...input, name: cleanName(input.name),
      maxRounds: Math.min(12, Math.max(1, input.maxRounds ?? 2)),
      maxTokens: Math.min(1_000_000, Math.max(500, input.maxTokens ?? 8000))
    })
    sendDataChanged()
    return ok(room)
  })
  ipcMain.handle('tea:rooms:update', (_e, id: string, patch: Partial<Room>): Result<Room> => {
    try {
      const room = db.updateRoom(id, {
        ...patch,
        maxRounds: patch.maxRounds != null ? Math.min(12, Math.max(1, patch.maxRounds)) : undefined,
        maxTokens: patch.maxTokens != null ? Math.min(1_000_000, Math.max(500, patch.maxTokens)) : undefined
      })
      sendDataChanged()
      return ok(room)
    } catch (err) {
      return fail((err as Error).message)
    }
  })
  ipcMain.handle('tea:rooms:delete', (_e, id: string) => {
    db.deleteRoom(id)
    sendDataChanged()
    return ok(null)
  })
  ipcMain.handle('tea:rooms:agents', (_e, roomId: string) => db.listRoomAgents(roomId))
  ipcMain.handle('tea:rooms:add-agent', (_e, roomId: string, agentId: string) => {
    if (!db.getRoom(roomId) || !db.getAgent(agentId)) return fail('房间或 Agent 不存在')
    db.addAgentToRoom(roomId, agentId)
    sendDataChanged()
    return ok(null)
  })
  ipcMain.handle('tea:rooms:remove-agent', (_e, roomId: string, agentId: string) => {
    db.removeAgentFromRoom(roomId, agentId)
    sendDataChanged()
    return ok(null)
  })

  /* ---------------- chat ---------------- */

  ipcMain.handle('tea:messages:list', (_e, roomId: string, limit?: number) => db.listMessages(roomId, Math.min(500, limit ?? 200)))
  ipcMain.handle('tea:chat:send', async (_e, input: ChatSendInput) => {
    if (!mainWindow) return fail('窗口未就绪')
    return startChat(mainWindow, input)
  })
  ipcMain.handle('tea:chat:stop', (_e, runId: string) => stopChat(runId))
  ipcMain.handle('tea:chat:pause', (_e, runId: string, paused: boolean) => pauseChat(runId, paused))

  /* ---------------- persona generation ---------------- */

  ipcMain.handle('tea:persona:read-markdown', async () => {
    if (!mainWindow) return { ok: false, error: '窗口未就绪' }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入 Markdown 人格', properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
    })
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true }
    const file = result.filePaths[0]
    try {
      const stat = fs.statSync(file)
      if (stat.size > 1024 * 1024) return { ok: false, error: '文件超过 1 MB，请精简后再导入' }
      return { ok: true, name: path.basename(file), path: file, content: fs.readFileSync(file, 'utf8') }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('tea:persona:save-markdown', async (_e, defaultName: string, content: string): Promise<Result<string>> => {
    if (!mainWindow) return fail('窗口未就绪')
    const safeName = (defaultName || 'character').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出人格 Markdown', defaultPath: `${safeName}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled || !result.filePath) return fail('已取消')
    try {
      fs.writeFileSync(result.filePath, content, 'utf8')
      return ok(result.filePath)
    } catch (err) {
      return fail((err as Error).message)
    }
  })

  ipcMain.handle('tea:persona:generate', async (_e, input: PersonaDraftInput, confirmed: boolean): Promise<Result<PersonaResult>> => {
    if (!confirmed) return fail('需要先确认可能产生的 API 费用')
    const provider = db.getProvider(input.providerId)
    if (!provider) return fail('请先选择一个 Provider')
    if (!provider.enabled) return fail('这个 Provider 已被禁用')
    if (!input.modelId?.trim()) return fail('请选择模型')
    if (provider.kind === 'mock') {
      const name = input.agentNameHint?.trim() || '新朋友'
      const markdown = input.mode === 'questions'
        ? localPersonaDraft(input.answers ?? {}, name)
        : `# ${name}\n*本地演示草稿，未调用任何真实模型。你可以直接编辑，或接入真实 API 后重新生成。*\n\n${(input.rawText ?? '').trim() || '（没有提供文本）'}`
      return ok({
        markdown,
        suggestedName: suggestedNameFromMarkdown(markdown, name),
        providerId: provider.id, modelId: input.modelId,
        usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, estimated: true, costUsd: 0 }
      })
    }
    const apiKey = getCredential(provider.id)
    if (!apiKey && !provider.isLocal) return fail('这个 Provider 还没有保存 API Key')
    const userPrompt = input.mode === 'questions'
      ? buildPersonaUserPrompt(input.answers ?? {}, input.rawText)
      : buildPersonaFromFreeText(input.rawText ?? '')
    try {
      const result = await chatComplete(provider, apiKey, {
        providerId: provider.id, modelId: input.modelId.trim(), system: PERSONA_SYSTEM_PROMPT,
        user: userPrompt, temperature: 0.9, maxTokens: 2600
      })
      const markdown = result.text.trim()
      if (!markdown) return fail('模型返回了空内容，请重试或检查模型配置')
      const usage = result.usage
      db.logUsage({ roomId: null, agentId: null, providerId: provider.id, modelId: input.modelId, usage })
      return ok({
        markdown,
        suggestedName: suggestedNameFromMarkdown(markdown, input.agentNameHint || '新朋友'),
        providerId: provider.id, modelId: input.modelId, usage
      })
    } catch (err) {
      return fail(`人格生成失败：${(err as Error).message.replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')}`)
    }
  })

  /* ---------------- stats & memories ---------------- */

  ipcMain.handle('tea:stats:get', () => db.getStats())
  ipcMain.handle('tea:memories:list', (_e, agentId?: string, tier?: string) => db.listMemories(agentId, tier))
  ipcMain.handle('tea:memories:add', (_e, input: { agentId: string; roomId?: string | null; tier: 'short' | 'mid' | 'long' | 'private'; content: string; importance?: number }): Result<ReturnType<typeof db.addMemory>> => {
    if (!input.content?.trim()) return fail('记忆内容不能为空')
    const memory = db.addMemory({ ...input, content: input.content.trim().slice(0, 2000) })
    sendDataChanged()
    return ok(memory)
  })
  ipcMain.handle('tea:memories:update', (_e, id: string, patch: { content?: string; tier?: 'short' | 'mid' | 'long' | 'private'; importance?: number }) => {
    db.updateMemory(id, patch)
    sendDataChanged()
    return ok(null)
  })
  ipcMain.handle('tea:memories:delete', (_e, id: string) => {
    db.deleteMemory(id)
    sendDataChanged()
    return ok(null)
  })

  /* ---------------- backup & misc ---------------- */

  ipcMain.handle('tea:backup:export', async (): Promise<Result<string>> => {
    if (!mainWindow) return fail('窗口未就绪')
    const picked = await dialog.showOpenDialog(mainWindow, { title: '选择备份存放目录', properties: ['openDirectory', 'createDirectory'] })
    if (picked.canceled || !picked.filePaths[0]) return fail('已取消')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const target = path.join(picked.filePaths[0], `Agent茶话会-备份-${stamp}`)
    try {
      db.persistNow()
      fs.mkdirSync(target, { recursive: true })
      fs.copyFileSync(db.getDbPath(), path.join(target, 'tea-party.db'))
      const avatarSource = path.join(app.getPath('userData'), 'avatars')
      if (fs.existsSync(avatarSource)) fs.cpSync(avatarSource, path.join(target, 'avatars'), { recursive: true })
      fs.writeFileSync(path.join(target, 'backup.json'), JSON.stringify({
        product: 'Agent 茶话会', version: app.getVersion(), createdAt: Date.now(),
        note: '仅包含本地数据库与头像；API Key 不包含在备份中，需要在新设备重新填写'
      }, null, 2))
      return ok(target)
    } catch (err) {
      return fail(`备份失败：${(err as Error).message}`)
    }
  })

  ipcMain.handle('tea:backup:import', async (): Promise<Result<string>> => {
    if (!mainWindow) return fail('窗口未就绪')
    const picked = await dialog.showOpenDialog(mainWindow, { title: '选择备份目录（包含 tea-party.db）', properties: ['openDirectory'] })
    if (picked.canceled || !picked.filePaths[0]) return fail('已取消')
    const source = picked.filePaths[0]
    const backupDb = fs.existsSync(path.join(source, 'tea-party.db'))
      ? path.join(source, 'tea-party.db')
      : path.join(source, 'data', 'tea-party.db')
    if (!fs.existsSync(backupDb)) return fail('这个目录里没有找到 tea-party.db')
    try {
      db.persistNow()
      const safety = path.join(db.getDataDir(), `pre-restore-${Date.now()}.db`)
      fs.copyFileSync(db.getDbPath(), safety)
      db.closeDatabase()
      fs.copyFileSync(backupDb, db.getDbPath())
      const avatars = path.join(source, 'avatars')
      if (fs.existsSync(avatars)) fs.cpSync(avatars, path.join(app.getPath('userData'), 'avatars'), { recursive: true })
      await db.openDatabase()
      sendDataChanged()
      return ok(`已恢复备份。恢复前的数据库另存为 ${path.basename(safety)}`)
    } catch (err) {
      return fail(`恢复失败：${(err as Error).message}`)
    }
  })

  ipcMain.handle('tea:data:reveal', () => shell.openPath(db.getDataDir()))
  ipcMain.handle('tea:open-external', (_e, url: string): Result<null> => {
    if (!/^https?:\/\//i.test(url)) return fail('只允许打开 http/https 链接')
    void shell.openExternal(url)
    return ok(null)
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    db.initDatabase(app.getPath('userData'))
    await db.openDatabase()
    if (devBuild) {
      if (!db.listAgents().length) db.seedDemo()
      else if (!db.getSettings().onboarded) db.saveSettings({ onboarded: true })
    }
    if (process.env.TEA_SMOKE_SEED === '1' && !db.listAgents().length) db.seedDemo()
    registerIpc()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  }).catch((err) => {
    console.error('启动失败', err)
    dialog.showErrorBox('Agent 茶话会启动失败', String(err))
    app.quit()
  })

  app.on('window-all-closed', () => {
    stopAllChats()
    db.closeDatabase()
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    stopAllChats()
    db.persistNow()
  })
}
