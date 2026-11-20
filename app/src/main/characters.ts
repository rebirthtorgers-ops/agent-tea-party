import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { CharacterManifest, CharacterPack } from '../shared/types'

function characterRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'characters')
    : path.join(app.getAppPath(), 'resources', 'characters')
}

function isSafeId(id: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)
}

function readPack(dir: string, id: string): CharacterPack | null {
  try {
    const manifestPath = path.join(dir, 'manifest.json')
    if (!fs.existsSync(manifestPath)) return null
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as CharacterManifest
    if (!manifest || typeof manifest.name !== 'string') return null
    const personalityFile = manifest.personalityFile || 'personality.md'
    const personalityPath = path.join(dir, path.basename(personalityFile))
    const personality = fs.existsSync(personalityPath) ? fs.readFileSync(personalityPath, 'utf8') : ''
    const avatarPath = path.join(dir, path.basename(manifest.avatar || 'avatar.png'))
    let avatarUrl = ''
    if (fs.existsSync(avatarPath)) {
      const ext = path.extname(avatarPath).toLowerCase()
      const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png'
      avatarUrl = `data:${mime};base64,${fs.readFileSync(avatarPath).toString('base64')}`
    }
    return {
      manifest: { ...manifest, id: manifest.id || id },
      personality,
      avatarUrl,
      dir,
      builtin: true
    }
  } catch (err) {
    console.error('角色包读取失败', id, err)
    return null
  }
}

export function listCharacterPacks(): CharacterPack[] {
  const root = characterRoot()
  if (!fs.existsSync(root)) return []
  const packs: CharacterPack[] = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !isSafeId(entry.name)) continue
    const pack = readPack(path.join(root, entry.name), entry.name)
    if (pack) packs.push(pack)
  }
  return packs.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name, 'zh-Hans-CN'))
}

export function getCharacterPack(id: string): CharacterPack | null {
  if (!isSafeId(id)) return null
  return readPack(path.join(characterRoot(), id), id)
}

export function avatarDir(): string {
  const dir = path.join(app.getPath('userData'), 'avatars')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function copyCharacterAvatar(pack: CharacterPack, agentId: string): string | null {
  const avatarFile = path.join(pack.dir, path.basename(pack.manifest.avatar || 'avatar.png'))
  if (!fs.existsSync(avatarFile)) return null
  const ext = path.extname(avatarFile).toLowerCase() || '.png'
  const target = path.join(avatarDir(), `${agentId}${ext}`)
  fs.copyFileSync(avatarFile, target)
  return target
}

export function importAvatarFile(sourcePath: string, agentId: string): string {
  const ext = path.extname(sourcePath).toLowerCase()
  if (!['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) throw new Error('仅支持 PNG / JPG / WebP / GIF 头像')
  const stat = fs.statSync(sourcePath)
  if (stat.size > 8 * 1024 * 1024) throw new Error('头像文件不能超过 8 MB')
  const target = path.join(avatarDir(), `${agentId}${ext}`)
  fs.copyFileSync(sourcePath, target)
  return target
}

export function readAvatarDataUrl(filePath: string): string | null {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null
    const ext = path.extname(filePath).toLowerCase()
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/png'
    return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`
  } catch { return null }
}
