import type { ProviderKind } from './types'

export interface ProviderPreset {
  id: string
  name: string
  kind: ProviderKind
  baseUrl: string
  models: string[]
  keyUrl?: string
  docsUrl?: string
  note: string
  isLocal?: boolean
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai', name: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini'],
    keyUrl: 'https://platform.openai.com/api-keys', docsUrl: 'https://platform.openai.com/docs',
    note: '官方 OpenAI API，需要自备 API Key'
  },
  {
    id: 'gemini', name: 'Google Gemini', kind: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    keyUrl: 'https://aistudio.google.com/app/apikey', docsUrl: 'https://ai.google.dev/gemini-api/docs',
    note: 'Google AI Studio 生成的 API Key'
  },
  {
    id: 'anthropic', name: 'Anthropic Claude', kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1'],
    keyUrl: 'https://console.anthropic.com/settings/keys', docsUrl: 'https://docs.anthropic.com',
    note: 'Anthropic 官方 API'
  },
  {
    id: 'deepseek', name: 'DeepSeek', kind: 'openai', baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyUrl: 'https://platform.deepseek.com/api_keys', docsUrl: 'https://api-docs.deepseek.com',
    note: 'DeepSeek 开放平台，OpenAI 兼容接口'
  },
  {
    id: 'xai', name: 'xAI Grok', kind: 'openai', baseUrl: 'https://api.x.ai/v1',
    models: ['grok-4', 'grok-3', 'grok-3-mini'],
    keyUrl: 'https://console.x.ai', docsUrl: 'https://docs.x.ai',
    note: 'xAI 官方 API'
  },
  {
    id: 'openrouter', name: 'OpenRouter', kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-4o', 'anthropic/claude-sonnet-4.5', 'google/gemini-2.5-pro', 'deepseek/deepseek-chat'],
    keyUrl: 'https://openrouter.ai/keys', docsUrl: 'https://openrouter.ai/docs',
    note: '聚合多家模型，按 OpenRouter 计费'
  },
  {
    id: 'siliconflow', name: 'SiliconFlow 硅基流动', kind: 'openai', baseUrl: 'https://api.siliconflow.cn/v1',
    models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct', 'THUDM/glm-4-9b-chat'],
    keyUrl: 'https://cloud.siliconflow.cn/account/ak', docsUrl: 'https://docs.siliconflow.cn',
    note: '国内模型聚合平台'
  },
  {
    id: 'dashscope', name: '阿里云百炼', kind: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo'],
    keyUrl: 'https://bailian.console.aliyun.com/?apiKey=1', docsUrl: 'https://help.aliyun.com/zh/model-studio/',
    note: 'DashScope OpenAI 兼容模式'
  },
  {
    id: 'volcengine', name: '火山引擎（方舟）', kind: 'openai', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-1.5-pro-32k', 'doubao-1.5-lite-32k'],
    keyUrl: 'https://console.volcengine.com/ark', docsUrl: 'https://www.volcengine.com/docs/82379',
    note: '需要先在方舟控制台创建推理接入点，模型 ID 填接入点 ID'
  },
  {
    id: 'zhipu', name: '智谱 AI', kind: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4-flash', 'glm-4-air'],
    keyUrl: 'https://bigmodel.cn/usercenter/apikeys', docsUrl: 'https://open.bigmodel.cn/dev/api',
    note: '智谱开放平台'
  },
  {
    id: 'moonshot', name: 'Moonshot AI（Kimi）', kind: 'openai', baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-latest'],
    keyUrl: 'https://platform.moonshot.cn/console/api-keys', docsUrl: 'https://platform.moonshot.cn/docs',
    note: '月之暗面开放平台'
  },
  {
    id: 'local', name: 'Local AI（本地 / 局域网）', kind: 'openai', baseUrl: 'http://127.0.0.1:11434/v1',
    models: ['llama3.1', 'qwen2.5', 'mistral'],
    docsUrl: 'https://ollama.com', isLocal: true,
    note: '连接你已经在运行的 Ollama / LM Studio / llama.cpp / LocalAI，不会安装或启动任何模型'
  },
  {
    id: 'custom', name: '自定义 Provider', kind: 'openai', baseUrl: '',
    models: [], note: '任意 OpenAI / Anthropic / Gemini 兼容服务'
  }
]

export const KIND_LABELS: Record<ProviderKind, string> = {
  openai: 'OpenAI 兼容',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  mock: '演示（模拟）'
}

/** USD per 1M tokens, approximate and clearly labelled as estimate in UI. */
export const PRICING: { match: string; input: number; output: number; cached?: number }[] = [
  { match: 'gpt-4o-mini', input: 0.15, output: 0.6, cached: 0.075 },
  { match: 'gpt-4o', input: 2.5, output: 10, cached: 1.25 },
  { match: 'gpt-4.1-mini', input: 0.4, output: 1.6, cached: 0.1 },
  { match: 'gpt-4.1', input: 2, output: 8, cached: 0.5 },
  { match: 'o3-mini', input: 1.1, output: 4.4, cached: 0.55 },
  { match: 'claude-sonnet-4', input: 3, output: 15, cached: 0.3 },
  { match: 'claude-haiku-4', input: 1, output: 5 },
  { match: 'claude-opus-4', input: 15, output: 75 },
  { match: 'gemini-2.5-pro', input: 1.25, output: 10 },
  { match: 'gemini-2.5-flash', input: 0.3, output: 2.5 },
  { match: 'gemini-2.0-flash', input: 0.1, output: 0.4 },
  { match: 'deepseek-chat', input: 0.27, output: 1.1, cached: 0.07 },
  { match: 'deepseek-reasoner', input: 0.55, output: 2.19, cached: 0.14 },
  { match: 'grok-4', input: 3, output: 15 },
  { match: 'grok-3', input: 3, output: 15 },
  { match: 'qwen-max', input: 1.6, output: 6.4 },
  { match: 'qwen-plus', input: 0.4, output: 1.2 },
  { match: 'qwen-turbo', input: 0.05, output: 0.2 },
  { match: 'glm-4-plus', input: 0.7, output: 0.7 },
  { match: 'glm-4-flash', input: 0, output: 0 },
  { match: 'moonshot-v1-8k', input: 0.17, output: 0.17 },
  { match: 'kimi-latest', input: 0.2, output: 0.5 },
  { match: 'doubao', input: 0.11, output: 0.28 }
]

export function estimateCost(modelId: string | null | undefined, input: number, output: number, cached = 0): number {
  if (!modelId) return 0
  const id = modelId.toLowerCase()
  const row = PRICING.find((p) => id.includes(p.match))
  if (!row) return 0
  const billableIn = Math.max(0, input - cached)
  return (billableIn * row.input + cached * (row.cached ?? row.input) + output * row.output) / 1_000_000
}
