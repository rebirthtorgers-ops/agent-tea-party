import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { estimateTokens, makeUsage, validateBaseUrl } from '../src/main/providers'
import { estimateCost, PRICING } from '../src/shared/presets'
import {
  PERSONA_QUESTIONS, buildPersonaUserPrompt, localPersonaDraft, suggestedNameFromMarkdown
} from '../src/shared/persona'

describe('validateBaseUrl', () => {
  it('accepts a normal public https endpoint', () => {
    const result = validateBaseUrl('https://api.deepseek.com/v1')
    expect(result.ok).toBe(true)
    expect(result.url?.hostname).toBe('api.deepseek.com')
    expect(result.warning).toBeUndefined()
  })

  it('rejects non-http protocols and embedded credentials', () => {
    expect(validateBaseUrl('file:///etc/passwd').ok).toBe(false)
    expect(validateBaseUrl('https://user:pass@api.example.com/v1').ok).toBe(false)
    expect(validateBaseUrl('not a url').ok).toBe(false)
  })

  it('blocks cloud metadata and link-local addresses', () => {
    expect(validateBaseUrl('http://169.254.169.254/latest/meta-data').ok).toBe(false)
    expect(validateBaseUrl('http://100.100.100.200/latest/meta-data').ok).toBe(false)
    expect(validateBaseUrl('http://metadata.google.internal/computeMetadata/v1').ok).toBe(false)
    expect(validateBaseUrl('http://0.0.0.0:8080/v1').ok).toBe(false)
  })

  it('blocks private networks unless the user opts in', () => {
    expect(validateBaseUrl('http://127.0.0.1:11434/v1').ok).toBe(false)
    expect(validateBaseUrl('http://192.168.1.9:1234/v1').ok).toBe(false)
    expect(validateBaseUrl('http://127.0.0.1:11434/v1', { isLocal: true }).ok).toBe(true)
    expect(validateBaseUrl('http://192.168.1.9:1234/v1', { allowPrivate: true }).ok).toBe(true)
    expect(validateBaseUrl('http://127.0.0.1:11434/v1', { isLocal: true }).warning).toContain('本机或局域网')
  })
})

describe('token and cost estimates', () => {
  it('estimates CJK heavier than latin text', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('你好，茶会')).toBeGreaterThan(0)
    expect(estimateTokens('你好你好你好')).toBeGreaterThan(estimateTokens('hello'))
  })

  it('prices known models per million tokens and leaves unknown models at zero', () => {
    expect(estimateCost('gpt-4o-mini', 1_000_000, 0)).toBeCloseTo(0.15, 6)
    expect(estimateCost('deepseek-chat', 1_000_000, 0)).toBeCloseTo(0.27, 6)
    expect(estimateCost('gpt-4o-mini', 1_000_000, 500_000, 500_000)).toBeCloseTo((500_000 * 0.15 + 500_000 * 0.075 + 500_000 * 0.6) / 1_000_000, 6)
    expect(estimateCost('some-local-model', 1_000_000, 1_000_000)).toBe(0)
    expect(PRICING.length).toBeGreaterThan(10)
  })

  it('marks estimated usage and carries cost into the record', () => {
    const usage = makeUsage(1000, 200, 0, true, 'gpt-4o-mini')
    expect(usage.estimated).toBe(true)
    expect(usage.costUsd).toBeGreaterThan(0)
  })
})

describe('persona creation helpers', () => {
  it('keeps exactly ten unique questions with options', () => {
    expect(PERSONA_QUESTIONS).toHaveLength(10)
    expect(new Set(PERSONA_QUESTIONS.map((q) => q.id)).size).toBe(10)
    expect(PERSONA_QUESTIONS.filter((q) => q.allowFreeText).length).toBeGreaterThanOrEqual(9)
    for (const q of PERSONA_QUESTIONS) {
      if (q.id !== 'extra') expect(q.options.length).toBeGreaterThan(0)
    }
  })

  it('compiles selected and free-form answers into one prompt', () => {
    const prompt = buildPersonaUserPrompt({ firstImpression: '治愈', traits: ['温柔', '傲娇'], speech: '句子很短' })
    expect(prompt).toContain('1. 第一印象：治愈')
    expect(prompt).toContain('温柔、傲娇')
    expect(prompt).toContain('句子很短')
  })

  it('produces an offline draft with every required role section', () => {
    const draft = localPersonaDraft({ traits: '温柔', speech: '口语' }, '小雨')
    for (const heading of ['身份', '外貌', '性格', '说话风格', '兴趣', '背景', '与用户的关系', '情绪表达', '主动行为', '角色行为原则', 'RP 交互规则', '长期成长机制']) {
      expect(draft).toContain('## ' + heading)
    }
    expect(draft).toContain('# 小雨')
    expect(draft).toContain('未调用任何模型')
  })

  it('reads the character name from a markdown heading only when reasonable', () => {
    expect(suggestedNameFromMarkdown('# 月见\n\n她喜欢星星。')).toBe('月见')
    expect(suggestedNameFromMarkdown('没有标题的文本', '新朋友')).toBe('新朋友')
  })
})

describe('bundled character packs', () => {
  const root = path.resolve(__dirname, '../resources/characters')

  it('ships at least one complete local preset', () => {
    const dirs = fs.readdirSync(root).filter((name) => fs.statSync(path.join(root, name)).isDirectory())
    expect(dirs.length).toBeGreaterThanOrEqual(1)
    for (const dir of dirs) {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, dir, 'manifest.json'), 'utf8'))
      expect(manifest.id).toBe(dir)
      expect(manifest.name.length).toBeGreaterThan(0)
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(manifest.tags.length).toBeGreaterThan(0)
      expect(fs.readFileSync(path.join(root, dir, 'personality.md'), 'utf8').length).toBeGreaterThan(500)
      expect(fs.statSync(path.join(root, dir, 'avatar.png')).size).toBeGreaterThan(5000)
    }
  })
})
