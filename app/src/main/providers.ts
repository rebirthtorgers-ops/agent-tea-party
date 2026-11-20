import type { GenerateRequest, ProviderConfig, ProviderTestResult, Usage } from '../shared/types'
import { estimateCost } from '../shared/presets'

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface StreamResult { usage: Usage; text: string; httpStatus: number }

const REQUEST_TIMEOUT = 90_000
const TEST_TIMEOUT = 20_000

const BLOCKED_HOSTS = new Set([
  'metadata.google.internal', 'metadata', 'instance-data', '169.254.169.254',
  '100.100.100.200', 'fd00:ec2::254'
])

export function estimateTokens(text: string): number {
  if (!text) return 0
  let cjk = 0
  let other = 0
  for (const ch of text) {
    if (/[\u3000-\u9fff\uf900-\ufaff\u3040-\u30ff]/.test(ch)) cjk++
    else other++
  }
  return Math.max(1, Math.ceil(cjk * 1.05 + other / 3.6))
}

export function makeUsage(input: number, output: number, cached: number, estimated: boolean, modelId: string | null): Usage {
  return { inputTokens: input, outputTokens: output, cachedTokens: cached, estimated, costUsd: estimateCost(modelId, input, output, cached) }
}

/** Reject file:, credentials, metadata endpoints and (by default) private networks. */
export function validateBaseUrl(raw: string, options: { isLocal?: boolean; allowPrivate?: boolean } = {}): { ok: boolean; error?: string; url?: URL; warning?: string } {
  let url: URL
  try { url = new URL(raw.trim()) } catch { return { ok: false, error: 'Base URL 格式无效，请填写完整的 http(s) 地址' } }
  if (!['http:', 'https:'].includes(url.protocol)) return { ok: false, error: '只允许 http / https 协议' }
  if (url.username || url.password) return { ok: false, error: 'Base URL 中不能包含用户名或密码' }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (BLOCKED_HOSTS.has(host)) return { ok: false, error: '该地址属于云元数据 / 内部服务，已拒绝访问' }
  if (url.port === '0' || host === '0.0.0.0') return { ok: false, error: '不允许访问 0.0.0.0 这类通配地址' }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  let privateHost = false
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127) privateHost = true
    if (a === 169 && b === 254) return { ok: false, error: '不允许访问 169.254.x.x 链路本地地址' }
  }
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) privateHost = true
  if (privateHost && !options.isLocal && !options.allowPrivate) {
    return { ok: false, error: '该地址指向本机或局域网。请使用「Local AI」类型，或在设置中明确允许私有网络访问' }
  }
  const warning = privateHost ? '该地址位于本机或局域网，请求会发送到对应设备上的服务' : undefined
  return { ok: true, url, warning }
}

function authHeaders(provider: ProviderConfig, apiKey?: string): Record<string, string> {
  if (provider.kind === 'anthropic') {
    const h: Record<string, string> = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' }
    if (apiKey) h['x-api-key'] = apiKey
    return h
  }
  const h: Record<string, string> = { 'content-type': 'application/json' }
  if (apiKey) h.authorization = `Bearer ${apiKey}`
  return h
}

function joinUrl(base: string, suffix: string): string {
  return base.replace(/\/+$/, '') + suffix
}

function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return '请求已取消'
    return err.message.replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
  }
  return String(err)
}

async function readError(res: Response): Promise<string> {
  let body = ''
  try { body = (await res.text()).slice(0, 800) } catch {}
  const cleaned = body.replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
  return `HTTP ${res.status}${res.statusText ? ' ' + res.statusText : ''}${cleaned ? '：' + cleaned : ''}`
}

async function fetchJson(url: string, init: RequestInit, timeout = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const signal = init.signal
  const timer = setTimeout(() => controller.abort(), timeout)
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/* ---------------- non-streaming completion ---------------- */

export async function chatComplete(provider: ProviderConfig, apiKey: string | undefined, req: GenerateRequest): Promise<{ text: string; usage: Usage; httpStatus: number }> {
  const base = provider.baseUrl
  const model = req.modelId
  const maxTokens = req.maxTokens ?? 1600
  if (provider.kind === 'openai') {
    const messages = [{ role: 'system', content: req.system }, { role: 'user', content: req.user }]
    const res = await fetchJson(joinUrl(base, '/chat/completions'), {
      method: 'POST', headers: authHeaders(provider, apiKey), signal: req.signal,
      body: JSON.stringify({ model, messages, temperature: req.temperature ?? 0.8, max_tokens: maxTokens })
    })
    if (!res.ok) throw new Error(await readError(res))
    const json = await res.json() as any
    const text = json?.choices?.[0]?.message?.content ?? ''
    const u = json?.usage ?? {}
    const usage = makeUsage(u.prompt_tokens ?? estimateTokens(req.system + req.user), u.completion_tokens ?? estimateTokens(text),
      u.prompt_tokens_details?.cached_tokens ?? 0, !u.prompt_tokens, model)
    return { text: String(text), usage, httpStatus: res.status }
  }
  if (provider.kind === 'anthropic') {
    const res = await fetchJson(joinUrl(base, '/messages'), {
      method: 'POST', headers: authHeaders(provider, apiKey), signal: req.signal,
      body: JSON.stringify({ model, system: req.system, messages: [{ role: 'user', content: req.user }], max_tokens: maxTokens, temperature: req.temperature ?? 0.8 })
    })
    if (!res.ok) throw new Error(await readError(res))
    const json = await res.json() as any
    const text = (json?.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
    const u = json?.usage ?? {}
    const usage = makeUsage(u.input_tokens ?? 0, u.output_tokens ?? 0, u.cache_read_input_tokens ?? 0, !u.input_tokens, model)
    return { text, usage, httpStatus: res.status }
  }
  if (provider.kind === 'gemini') {
    const url = `${joinUrl(base, '/models/' + encodeURIComponent(model) + ':generateContent')}?key=${encodeURIComponent(apiKey ?? '')}`
    const res = await fetchJson(url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: req.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.user }] }],
        generationConfig: { temperature: req.temperature ?? 0.8, maxOutputTokens: maxTokens }
      })
    })
    if (!res.ok) throw new Error(await readError(res))
    const json = await res.json() as any
    const text = (json?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('')
    const u = json?.usageMetadata ?? {}
    const usage = makeUsage(u.promptTokenCount ?? 0, u.candidatesTokenCount ?? 0, u.cachedContentTokenCount ?? 0, !u.promptTokenCount, model)
    return { text, usage, httpStatus: res.status }
  }
  throw new Error('演示 Provider 不会发起真实请求')
}

/* ---------------- streaming completion ---------------- */

export async function streamChat(
  provider: ProviderConfig,
  apiKey: string | undefined,
  req: GenerateRequest & { messages: ChatMessage[] },
  onDelta: (text: string) => void
): Promise<StreamResult> {
  if (provider.kind === 'mock') {
    const reply = demoReply(req.messages)
    for (const chunk of reply.match(/.{1,6}/gs) ?? []) {
      if (req.signal?.aborted) break
      onDelta(chunk)
      await new Promise((r) => setTimeout(r, 18))
    }
    return { text: reply, usage: makeUsage(estimateTokens(req.messages.map((m) => m.content).join('')), estimateTokens(reply), 0, true, req.modelId), httpStatus: 200 }
  }
  if (provider.kind === 'openai') return streamOpenAI(provider, apiKey, req, onDelta)
  if (provider.kind === 'anthropic') return streamAnthropic(provider, apiKey, req, onDelta)
  if (provider.kind === 'gemini') return streamGemini(provider, apiKey, req, onDelta)
  throw new Error('不支持的 Provider 类型')
}

function demoReply(messages: ChatMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === 'user' && !m.content.startsWith('[茶会调度]'))?.content ?? ''
  const quoted = last.replace(/^\s*[^:：]{1,24}[:：]\s*/, '').trim()
  return `【演示响应 · 未联网】

我听见了：「${quoted.slice(0, 60)}${quoted.length > 60 ? '…' : ''}」

这是本地演示 Provider 生成的固定回复，用来验证界面、流式输出与持久化流程，没有调用任何真实模型，也不会产生费用。接入真实 API 后，这里会变成她自己的回答。`
}

async function streamOpenAI(provider: ProviderConfig, apiKey: string | undefined, req: GenerateRequest & { messages: ChatMessage[] }, onDelta: (t: string) => void): Promise<StreamResult> {
  let includeUsage = true
  for (let attempt = 0; attempt < 2; attempt++) {
    const body: Record<string, unknown> = { model: req.modelId, messages: req.messages, temperature: req.temperature ?? 0.8, max_tokens: req.maxTokens ?? 1200, stream: true }
    if (includeUsage) body.stream_options = { include_usage: true }
    const res = await fetchJson(joinUrl(provider.baseUrl, '/chat/completions'), {
      method: 'POST', headers: authHeaders(provider, apiKey), signal: req.signal, body: JSON.stringify(body)
    })
    if (!res.ok) {
      if (attempt === 0 && includeUsage && res.status === 400) { includeUsage = false; continue }
      throw new Error(await readError(res))
    }
    return parseOpenAIStream(res, req.modelId, req.messages, onDelta)
  }
  throw new Error('请求失败')
}

async function parseOpenAIStream(res: Response, modelId: string, messages: ChatMessage[], onDelta: (t: string) => void): Promise<StreamResult> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let usage: any = null
  let done = false
  while (!done) {
    const { value, done: finished } = await reader.read()
    if (finished) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') { done = true; break }
      try {
        const json = JSON.parse(payload)
        const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content
        if (typeof delta === 'string' && delta) { text += delta; onDelta(delta) }
        if (json?.usage) usage = json.usage
      } catch { /* partial JSON line */ }
    }
  }
  const estimated = !usage?.prompt_tokens
  const promptText = messages.map((m) => m.content).join('\n')
  return {
    text, httpStatus: res.status,
    usage: makeUsage(usage?.prompt_tokens ?? estimateTokens(promptText), usage?.completion_tokens ?? estimateTokens(text),
      usage?.prompt_tokens_details?.cached_tokens ?? 0, estimated, modelId)
  }
}

async function streamAnthropic(provider: ProviderConfig, apiKey: string | undefined, req: GenerateRequest & { messages: ChatMessage[] }, onDelta: (t: string) => void): Promise<StreamResult> {
  const system = req.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const messages = req.messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }))
  const res = await fetchJson(joinUrl(provider.baseUrl, '/messages'), {
    method: 'POST', headers: authHeaders(provider, apiKey), signal: req.signal,
    body: JSON.stringify({ model: req.modelId, system, messages, max_tokens: req.maxTokens ?? 1200, temperature: req.temperature ?? 0.8, stream: true })
  })
  if (!res.ok) throw new Error(await readError(res))
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let inputTokens = 0
  let outputTokens = 0
  let cached = 0
  let done = false
  while (!done) {
    const { value, done: finished } = await reader.read()
    if (finished) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      try {
        const json = JSON.parse(trimmed.slice(5).trim())
        if (json.type === 'message_start') {
          inputTokens = json.message?.usage?.input_tokens ?? 0
          cached = json.message?.usage?.cache_read_input_tokens ?? 0
        } else if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
          text += json.delta.text
          onDelta(json.delta.text)
        } else if (json.type === 'message_delta') {
          outputTokens = json.usage?.output_tokens ?? outputTokens
        } else if (json.type === 'message_stop') {
          done = true
        }
      } catch {}
    }
  }
  const estimated = !inputTokens
  return { text, httpStatus: res.status, usage: makeUsage(inputTokens || estimateTokens(req.messages.map((m) => m.content).join('')), outputTokens || estimateTokens(text), cached, estimated, req.modelId) }
}

async function streamGemini(provider: ProviderConfig, apiKey: string | undefined, req: GenerateRequest & { messages: ChatMessage[] }, onDelta: (t: string) => void): Promise<StreamResult> {
  const system = req.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const contents = req.messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  const url = `${joinUrl(provider.baseUrl, '/models/' + encodeURIComponent(req.modelId) + ':streamGenerateContent')}?alt=sse&key=${encodeURIComponent(apiKey ?? '')}`
  const res = await fetchJson(url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, signal: req.signal,
    body: JSON.stringify({ systemInstruction: system ? { parts: [{ text: system }] } : undefined, contents, generationConfig: { temperature: req.temperature ?? 0.8, maxOutputTokens: req.maxTokens ?? 1200 } })
  })
  if (!res.ok) throw new Error(await readError(res))
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let usageMeta: any = null
  let done = false
  while (!done) {
    const { value, done: finished } = await reader.read()
    if (finished) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      try {
        const json = JSON.parse(trimmed.slice(5).trim())
        const parts = json?.candidates?.[0]?.content?.parts ?? []
        for (const p of parts) if (typeof p.text === 'string' && p.text) { text += p.text; onDelta(p.text) }
        if (json?.usageMetadata) usageMeta = json.usageMetadata
      } catch {}
    }
  }
  return {
    text, httpStatus: res.status,
    usage: makeUsage(usageMeta?.promptTokenCount ?? estimateTokens(req.messages.map((m) => m.content).join('')),
      usageMeta?.candidatesTokenCount ?? estimateTokens(text), usageMeta?.cachedContentTokenCount ?? 0, !usageMeta?.promptTokenCount, req.modelId)
  }
}

/* ---------------- connection test ---------------- */

export async function testProvider(provider: ProviderConfig, apiKey?: string): Promise<ProviderTestResult> {
  const started = Date.now()
  const check = validateBaseUrl(provider.baseUrl, { isLocal: provider.isLocal, allowPrivate: provider.allowPrivateNetwork })
  if (!check.ok || !check.url) return { ok: false, reachable: false, generation: false, latencyMs: 0, detail: check.error ?? '地址无效', models: [] }
  if (provider.kind === 'mock') {
    return { ok: true, reachable: true, generation: true, latencyMs: 1, detail: '演示 Provider：本地模拟，不发送网络请求，不代表真实 API 可用', models: provider.models }
  }
  let models: string[] = []
  let reachable = false
  let generation = false
  let detail = ''
  let httpStatus: number | undefined
  try {
    if (provider.kind === 'openai') {
      const res = await fetchJson(joinUrl(provider.baseUrl, '/models'), { headers: authHeaders(provider, apiKey) }, TEST_TIMEOUT)
      httpStatus = res.status
      if (res.ok) {
        reachable = true
        const json = await res.json() as any
        models = (json?.data ?? []).map((m: any) => m.id).filter(Boolean)
        detail = `模型列表可读取，共 ${models.length} 个`
      } else {
        detail = await readError(res)
      }
    } else if (provider.kind === 'anthropic') {
      const res = await fetchJson(joinUrl(provider.baseUrl, '/models'), { headers: authHeaders(provider, apiKey) }, TEST_TIMEOUT)
      httpStatus = res.status
      if (res.ok) {
        reachable = true
        const json = await res.json() as any
        models = (json?.data ?? []).map((m: any) => m.id).filter(Boolean)
        detail = `模型列表可读取，共 ${models.length} 个`
      } else {
        detail = await readError(res)
      }
    } else if (provider.kind === 'gemini') {
      const res = await fetchJson(`${joinUrl(provider.baseUrl, '/models')}?key=${encodeURIComponent(apiKey ?? '')}`, {}, TEST_TIMEOUT)
      httpStatus = res.status
      if (res.ok) {
        reachable = true
        const json = await res.json() as any
        models = (json?.models ?? []).map((m: any) => String(m.name ?? '').replace(/^models\//, '')).filter(Boolean)
        detail = `模型列表可读取，共 ${models.length} 个`
      } else {
        detail = await readError(res)
      }
    }
  } catch (err) {
    detail = sanitizeError(err)
  }

  // Real generation probe (small, still may incur a tiny cost).
  const model = provider.models[0]
  if (model && provider.models.length > 0) {
    try {
      const probe = await chatComplete(provider, apiKey, {
        providerId: provider.id, modelId: model, system: 'You are a connectivity probe. Reply with the single word: pong.',
        user: 'ping', maxTokens: 8, temperature: 0
      })
      generation = probe.text.trim().length > 0
      if (generation) detail = `${detail ? detail + '；' : ''}生成测试通过（模型 ${model}）`
      else detail = `${detail ? detail + '；' : ''}生成测试返回空内容`
    } catch (err) {
      detail = `${detail ? detail + '；' : ''}生成测试失败：${sanitizeError(err)}`
    }
  } else {
    detail = `${detail ? detail + '；' : ''}未填写模型 ID，跳过生成测试`
  }
  return { ok: reachable && generation, reachable, generation, latencyMs: Date.now() - started, detail, models, httpStatus }
}

export async function fetchModels(provider: ProviderConfig, apiKey?: string): Promise<{ ok: boolean; models: string[]; detail: string }> {
  try {
    if (provider.kind === 'openai' || provider.kind === 'anthropic') {
      const res = await fetchJson(joinUrl(provider.baseUrl, '/models'), { headers: authHeaders(provider, apiKey) }, TEST_TIMEOUT)
      if (!res.ok) return { ok: false, models: [], detail: await readError(res) }
      const json = await res.json() as any
      return { ok: true, models: (json?.data ?? []).map((m: any) => m.id).filter(Boolean), detail: 'ok' }
    }
    if (provider.kind === 'gemini') {
      const res = await fetchJson(`${joinUrl(provider.baseUrl, '/models')}?key=${encodeURIComponent(apiKey ?? '')}`, {}, TEST_TIMEOUT)
      if (!res.ok) return { ok: false, models: [], detail: await readError(res) }
      const json = await res.json() as any
      return { ok: true, models: (json?.models ?? []).map((m: any) => String(m.name ?? '').replace(/^models\//, '')).filter(Boolean), detail: 'ok' }
    }
    return { ok: true, models: provider.models, detail: '演示 Provider' }
  } catch (err) {
    return { ok: false, models: [], detail: sanitizeError(err) }
  }
}
