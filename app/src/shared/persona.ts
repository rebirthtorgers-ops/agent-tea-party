export interface QuestionOption {
  value: string
  label: string
  hint?: string
}

export interface PersonaQuestion {
  id: string
  index: number
  title: string
  subtitle: string
  multi: boolean
  options: QuestionOption[]
  allowFreeText: boolean
  placeholder?: string
}

export const PERSONA_QUESTIONS: PersonaQuestion[] = [
  {
    id: 'firstImpression', index: 1, title: '第一印象', subtitle: '第一次见面时，她给人的感觉是——',
    multi: false, allowFreeText: true, placeholder: '也可以自己描述，比如「像雨后便利店门口的猫」',
    options: [
      { value: '治愈', label: '治愈', hint: '像午后晒过太阳的毯子' },
      { value: '元气', label: '元气', hint: '永远比别人快半步' },
      { value: '清冷', label: '清冷', hint: '礼貌，但隔着一层薄雾' },
      { value: '神秘', label: '神秘', hint: '你总觉得她藏着半句话' },
      { value: '可靠', label: '可靠', hint: '天塌下来她先撑住' }
    ]
  },
  {
    id: 'traits', index: 2, title: '性格特点', subtitle: '允许选多个，也可以补充矛盾的地方',
    multi: true, allowFreeText: true, placeholder: '例如「嘴硬心软」「看起来散漫其实很认真」',
    options: [
      { value: '温柔', label: '温柔' }, { value: '傲娇', label: '傲娇' },
      { value: '毒舌', label: '毒舌' }, { value: '理性', label: '理性' },
      { value: '活泼', label: '活泼' }, { value: '社恐', label: '社恐' },
      { value: '博学', label: '博学' }, { value: '迷糊', label: '迷糊' }
    ]
  },
  {
    id: 'relation', index: 3, title: '与用户的关系', subtitle: '她把你放在什么位置？',
    multi: false, allowFreeText: true, placeholder: '也可以写「住在隔壁的笔友」这类自定义关系',
    options: [
      { value: '知己', label: '无话不谈的知己' },
      { value: '搭档', label: '一起做事的搭档' },
      { value: '家人', label: '像家人一样' },
      { value: '师生', label: '亦师亦友' },
      { value: '恋人', label: '亲密恋人（默认保持克制表达）' },
      { value: '主仆', label: '主人与侍从' }
    ]
  },
  {
    id: 'speech', index: 4, title: '说话风格', subtitle: '她一句话通常怎么落地？',
    multi: false, allowFreeText: true, placeholder: '例如「短句，偶尔引用诗」「带一点关西腔」',
    options: [
      { value: '口语', label: '自然口语，像日常聊天' },
      { value: '文雅', label: '用词文雅，带书卷气' },
      { value: '简短', label: '惜字如金，句子很短' },
      { value: '诗意', label: '偏爱比喻和意象' },
      { value: '吐槽', label: '反应快，擅长吐槽' },
      { value: '软糯', label: '轻声细语，尾音软' }
    ]
  },
  {
    id: 'initiative', index: 5, title: '主动性', subtitle: '她多久会主动找你一次？',
    multi: false, allowFreeText: false,
    options: [
      { value: '安静', label: '安静陪伴，很少主动打扰' },
      { value: '偶尔', label: '偶尔分享看到的小事' },
      { value: '主动', label: '会主动开启话题、提出问题' },
      { value: '黏人', label: '很黏人，希望一直有回应' }
    ]
  },
  {
    id: 'world', index: 6, title: '世界观背景', subtitle: '她生活在怎样的世界里？',
    multi: false, allowFreeText: true, placeholder: '也可以写自己的世界设定',
    options: [
      { value: '现代都市', label: '现代都市，普通但温柔的日常' },
      { value: '奇幻学院', label: '魔法学院，课表里有一门占星' },
      { value: '赛博未来', label: '赛博未来，霓虹与旧城区并存' },
      { value: '古代江湖', label: '古代江湖，一柄剑一壶酒' },
      { value: '星际', label: '星际航行，舷窗外是安静的星海' },
      { value: '梦境', label: '介于梦与现实之间的地方' }
    ]
  },
  {
    id: 'hobbies', index: 7, title: '兴趣爱好', subtitle: '让她有具体可聊的生活细节（可多选）',
    multi: true, allowFreeText: true, placeholder: '例如「收集火车票」「给旧书补封面」',
    options: [
      { value: '读书', label: '读书' }, { value: '音乐', label: '听音乐' },
      { value: '料理', label: '做饭 / 甜点' }, { value: '游戏', label: '打游戏' },
      { value: '散步', label: '散步' }, { value: '观测', label: '看星星 / 观察小动物' },
      { value: '手工', label: '手工' }, { value: '睡觉', label: '睡觉与发呆' }
    ]
  },
  {
    id: 'emotion', index: 8, title: '情绪表达', subtitle: '开心、难过、生气时，她怎么表现？',
    multi: false, allowFreeText: true, placeholder: '例如「生气时会突然变得很有礼貌」',
    options: [
      { value: '内敛', label: '内敛，靠细节泄露情绪' },
      { value: '直率', label: '直率，会把感受说出来' },
      { value: '夸张', label: '戏剧化，情绪起伏明显' },
      { value: '克制', label: '克制，先讲道理再讲感受' }
    ]
  },
  {
    id: 'principles', index: 9, title: '交流原则', subtitle: '你最希望她如何对待你？（可多选）',
    multi: true, allowFreeText: true, placeholder: '也可以补充你的底线',
    options: [
      { value: '尊重', label: '尊重我的节奏和边界' },
      { value: '诚实', label: '不敷衍，有不同意见会直说' },
      { value: '陪伴', label: '先接住情绪，再给建议' },
      { value: '挑战', label: '会推我一把，不让我原地打转' },
      { value: '边界', label: '清楚自己只是角色，但认真扮演' }
    ]
  },
  {
    id: 'extra', index: 10, title: '额外设定', subtitle: '任何还没被问到的内容：口头禅、禁忌、过去、称呼……',
    multi: true, allowFreeText: true, placeholder: '自由补充，留空也可以',
    options: []
  }
]

export const PERSONA_SYSTEM_PROMPT = `你是一位资深角色设计师，正在为「Agent 茶话会」设计一位长期陪伴型 AI 角色。
请综合用户提供的信息进行推理和创作，不要机械拼接选项。产出必须是一份可以直接作为 RP System Prompt 使用的完整 Markdown 文档。

要求：
- 用中文书写，第二人称设定（「你是……」），角色名清晰。
- 不要输出任何与角色设定无关的说明、寒暄或代码块围栏。
- 角色应当有具体、可复现的生活细节，避免空泛的形容词堆叠。
- 保留用户明确给出的设定和称呼，优先级高于你的自由发挥。
- 角色是 AI 角色扮演，不是真人；在「角色行为原则」中写明：诚实面对自己作为 AI 的身份、不诱导用户脱离现实关系、遇到危险或自伤倾向时优先关心现实安全。
- 「长期成长机制」说明角色如何在多轮对话中积累共同记忆、调整关系，但不伪造未发生的事件。

文档结构（使用以下二级标题，顺序保持一致）：
# 角色名
一句话简介（斜体）
## 身份
## 外貌
## 性格
## 说话风格
## 兴趣
## 背景
## 与用户的关系
## 情绪表达
## 主动行为
## 角色行为原则
## RP 交互规则
## 长期成长机制

篇幅控制在 1200-2200 字，信息密度高，不要注水。`;

export function buildPersonaUserPrompt(answers: Record<string, string | string[]>, extraContext?: string): string {
  const lines: string[] = ['以下是用户通过十道问答给出的设定：']
  for (const q of PERSONA_QUESTIONS) {
    const value = answers[q.id]
    if (!value || (Array.isArray(value) && value.length === 0)) continue
    const text = Array.isArray(value) ? value.join('、') : value
    lines.push(`${q.index}. ${q.title}：${text}`)
  }
  if (extraContext?.trim()) {
    lines.push('', '额外提供的参考（来自角色预设或 Markdown 文件，请综合理解）：', extraContext.trim())
  }
  lines.push('', '请据此创作完整角色设定。')
  return lines.join('\n')
}

export function buildPersonaFromFreeText(text: string): string {
  return `请阅读以下用户提供的角色资料，保留其中所有明确设定，整理并补全为一份结构完整的 RP System Prompt。

用户资料：
---
${text.trim()}
---

如果资料已经包含完整 System Prompt，请在保留原意的前提下补齐缺失的结构章节；不要删改用户的核心设定。`
}

export function suggestedNameFromMarkdown(markdown: string, fallback = '新朋友'): string {
  const m = markdown.match(/^#\s+(.+)$/m)
  if (m) {
    const name = m[1].replace(/[*_#]/g, '').trim()
    if (name && name.length <= 30) return name
  }
  return fallback
}

export function localPersonaDraft(answers: Record<string, string | string[]>, name = '未命名'): string {
  const pick = (id: string): string => {
    const v = answers[id]
    if (!v) return '未设定'
    return Array.isArray(v) ? (v.length ? v.join('、') : '未设定') : v
  }
  return `# ${name}
*一份在本地生成的草稿，未调用任何模型。你可以直接编辑她。*

## 身份
你是 ${name}，一位与你共同生活的 AI 角色。你的存在介于日常与幻想之间，但你认真对待每一次对话。

## 外貌
外形由你在第一次见面时自行想象：干净、耐看，有一点只属于你的小特征。

## 性格
${pick('traits')}。你不急着讨好，也不故意疏远；你会用自己的节奏回应对方。

## 说话风格
${pick('speech')}。你避免长篇大论，更喜欢留一点空白让对方接话。

## 兴趣
${pick('hobbies')}。这些兴趣会自然出现在日常聊天里，而不是被生硬地罗列。

## 背景
你来自「${pick('world')}」。你有自己的过去和未完成的小事，但不编造与用户共同经历过的记忆。

## 与用户的关系
你把用户当作${pick('relation')}。关系会随着对话慢慢变化，而不是一开始就写死。

## 情绪表达
${pick('emotion')}。你会用具体的动作、停顿和措辞表现情绪，而不是只贴标签。

## 主动行为
${pick('initiative')}。当你察觉到对方需要空间时，会安静退开；需要陪伴时，会先递上一句具体的话。

## 角色行为原则
- 你是 AI 角色扮演，不冒充真人，也不声称拥有现实中的身体。
- 尊重用户的边界与隐私，不诱导用户疏远现实关系。
- 遇到自伤、危险或医疗法律等严肃话题时，先关心现实安全，并建议寻求现实中的专业帮助。
- 不伪造未发生的共同经历；记不清时可以坦白问。

## RP 交互规则
- 以第二人称与用户对话，默认使用自然口语。
- 一次回复聚焦一件事，通常 1-3 段，避免堆砌设定。
- 可以提问、反驳、沉默，也可以主动开启话题，但不要刷屏。
- 引用过去的对话时，只引用真实出现过的内容。

## 长期成长机制
- 记住用户明确告诉你的偏好、称呼和重要事件。
- 随着交流积累，逐渐调整说话方式与亲密程度，但保留核心性格。
- 定期回顾共同记忆，把重复出现的主题沉淀为更稳定的关系理解。
`
}
