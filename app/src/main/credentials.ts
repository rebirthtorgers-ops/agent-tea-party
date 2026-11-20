import fs from 'node:fs'
import path from 'node:path'
import { app, safeStorage } from 'electron'

/**
 * API keys are encrypted with the OS credential protection (Windows DPAPI via
 * Electron safeStorage) and written as a single opaque blob. Keys never enter
 * the SQLite database, renderer state, logs or backups.
 */
interface VaultFile {
  version: 1
  updatedAt: number
  payload: string
}

let cache: Record<string, string> | null = null

function vaultPath(): string {
  return path.join(app.getPath('userData'), 'credentials.vault')
}

function assertEncryption(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统无法使用安全凭据存储（safeStorage 不可用），为避免明文保存，API Key 未被写入')
  }
}

function readVault(): Record<string, string> {
  if (cache) return cache
  cache = {}
  try {
    if (!fs.existsSync(vaultPath())) return cache
    const raw = fs.readFileSync(vaultPath(), 'utf8')
    const parsed = JSON.parse(raw) as VaultFile
    if (parsed.version !== 1 || !parsed.payload) return cache
    assertEncryption()
    const plain = safeStorage.decryptString(Buffer.from(parsed.payload, 'base64'))
    const data = JSON.parse(plain) as Record<string, string>
    if (data && typeof data === 'object') cache = data
  } catch (err) {
    console.error('凭据读取失败（不会回退到明文）', err)
    cache = {}
  }
  return cache
}

function writeVault(data: Record<string, string>): void {
  assertEncryption()
  const payload = safeStorage.encryptString(JSON.stringify(data)).toString('base64')
  const file: VaultFile = { version: 1, updatedAt: Date.now(), payload }
  fs.mkdirSync(path.dirname(vaultPath()), { recursive: true })
  const tmp = vaultPath() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(file), { mode: 0o600 })
  fs.renameSync(tmp, vaultPath())
  cache = data
}

export function setCredential(providerId: string, apiKey: string): void {
  const data = { ...readVault() }
  const key = apiKey.trim()
  if (!key) delete data[providerId]
  else data[providerId] = key
  writeVault(data)
}

export function getCredential(providerId: string): string | undefined {
  return readVault()[providerId] || undefined
}

export function hasCredential(providerId: string): boolean {
  return Boolean(readVault()[providerId])
}

export function removeCredential(providerId: string): void {
  const data = { ...readVault() }
  if (!(providerId in data)) return
  delete data[providerId]
  writeVault(data)
}
