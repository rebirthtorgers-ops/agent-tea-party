# Agent 茶话会（Agent Tea Party）

以本地设备为中心的多 Agent 聊天工作台。用户用自己的 API、自己的 Agent、自己的设备，不需要注册账号，也没有云端聊天服务器。

- 正式名称：Agent 茶话会
- 当前版本：1.2.0（浅色优先的新界面；另有跳过引导的开发版，见下文）
- 目标平台：Windows 10/11 x64（已交付）；Android 尚未适配
- 技术栈：Electron 45 + React 19 + TypeScript + Vite 8 + electron-vite 6 + sql.js（SQLite/WASM）
- 打包：electron-builder（NSIS 安装包 + 便携版）

## 界面与主题

- 浅色优先的「Aurora Glass」设计：极光渐变背景、半透明玻璃卡、柔和多层阴影、24–28px 圆角
- 参考 Apple Liquid Glass 的层次与材质、Material Design 3 的字号/间距/状态层、小米 HyperOS 的宽松留白与大标题
- 主字体 MiSans VF（Apache-2.0，来源与许可见 `src/renderer/src/assets/misans/README.md`）
- 默认浅色，可在页头、聊天页或「设置 → 外观」切换深色；切换立即生效并写入本地设置
- 同一套 CSS 变量驱动两种主题，所有页面与弹窗都有深色适配

## 已实现功能

### 首次启动引导
- 先配置 API，再创建第一位 AI 娘，完成后进入茶会
- 13 种 Provider 预设：OpenAI、Gemini、Anthropic、DeepSeek、xAI、OpenRouter、SiliconFlow、阿里云百炼、火山引擎、智谱、Moonshot、自定义、Local AI
- Provider 名称、API Key、Base URL、Model ID 均可编辑，提供官方 Key 页面入口
- 「保存并测试」真实请求：先拉模型列表，再做一次极短生成探测；失败会显示 HTTP 状态和错误，绝不伪造成功
- 可以跳过，但界面会说明人格生成和在线聊天需要有效模型配置
- 没有 Key 时可进入「演示模式」，回复明确标注「演示响应 · 未联网」

### 社区娘化 AI
- 独立入口与本地角色画廊，内置 12 个角色包：8 个社区 AI 娘 + 4 个原创角色
- 社区 AI 娘：DeepSeek 娘、GPT 娘、Claude 娘、Gemini 娘、Kimi 娘、GLM 娘、Qwen 娘、豆包娘；参考公开社区二创设定重绘，非官方素材，不代表相关公司
- 原创角色：小雨、月见、铃铛、阿娅
- 角色包格式：`resources/characters/<id>/{manifest.json, personality.md, avatar.png}`
- 卡片展示头像、名称、简介、标签、版本；点开可查看完整人格
- 创建时复制头像到应用数据目录，人格写入新 Agent，并让用户选择 Provider / Model
- 不覆盖已有 Agent；原始预设与创建后的 Agent 分离保存
- 创建后仍可继续编辑人格、头像和模型

### 人格创建（四种方式并存）
1. **社区娘化 AI**：从本地角色包一键起步
2. **十道题**：第一印象、性格特点、与用户的关系、说话风格、主动性、世界观背景、兴趣爱好、情绪表达、交流原则、额外设定；支持单选、多选、自由补充、返回修改
3. **导入 Markdown**：本地读取 `.md`，预览、编辑、分析，不上传文件；可原样使用或让模型整理
4. **自由输入**：直接粘贴完整人格、背景或 System Prompt

生成完整 RP System Prompt 前会弹窗提示：

> 人格生成需要调用你配置的 AI 模型，可能产生 API Token 消耗及费用，具体取决于所使用的模型和生成内容长度

用户确认后才请求模型。生成结果进入预览/编辑，可改名、换头像、重新生成、返回问卷、导出 Markdown；最后二次确认「这就是你期待的她吗？」才正式创建 Agent。手动修改优先于模型输出。演示模式返回本地草稿，并明确标注未调用模型。

### 多 Agent 茶会
- 多房间创建、改名、删除；添加/移出 Agent；设置主持人
- 三栏布局：左侧茶会与导航，中间聊天，右侧在场 Agent 与规则
- 多 Agent 轮转发言，支持最大轮数与 Token 预算
- 流式输出；停止生成；暂停/继续；`@名字` 点名；引用消息回复
- Enter 发送，Shift+Enter 换行
- 消息、用量、房间配置全部本地持久化

### 本地记忆与 Token 统计
- Agent 独立记忆：短期 / 中期 / 长期 / 私有，可增删改、按 Agent 和层级筛选
- 聊天后自动沉淀短期记忆（可关闭）
- 对话接近上下文上限时生成「本地提取摘要」并标注未调用模型，用于续接
- Token 统计：输入、输出、缓存、估算费用、消息数、续接次数；按 Agent / Provider / 房间汇总
- 真实 usage 与估算值分开展示；价格表为公开单价估算，未知模型显示 0 并注明不代表免费

### 数据与隐私
- SQLite 本地数据库（sql.js/WASM），无需原生编译
- API Key 由 Electron `safeStorage`（Windows DPAPI）加密写入 `credentials.vault`，不进入源码、普通 JSON、聊天记录或日志；加密不可用时拒绝保存，不落明文
- 导出备份包含数据库与头像，不包含 API Key
- 恢复前自动另存当前数据库副本
- 无账号、无遥测、无行为分析；在线请求只发往用户配置的服务地址

### Local AI 连接
- Provider 类型「Local AI」支持任意 OpenAI Compatible 服务：Ollama、LM Studio、llama.cpp server、LocalAI 等
- 可配置 Base URL、可选 API Key、Model ID，API Key 可留空
- 支持服务可达性、模型列表、真实生成测试
- 仅开发连接能力，应用不会安装、下载、启动或部署任何本地模型
- 自定义 Base URL 做 SSRF 校验：拒绝 `file:`、URL 内嵌凭据、云元数据/链路本地地址（169.254.x.x、100.100.100.200、metadata 等）、`0.0.0.0`；本机/局域网地址默认拒绝，需明确选择 Local AI 或开启「允许私有网络地址」，并提示数据会发往该地址

## 目录结构

```
I:\Agent茶话会\
├─ app\                        源码与开发环境
│  ├─ src\
│  │  ├─ main\                  Electron 主进程
│  │  │  ├─ index.ts            窗口、IPC、备份、启动流程
│  │  │  ├─ db.ts               SQLite 初始化、迁移、CRUD、统计
│  │  │  ├─ providers.ts        三种协议适配、SSE 流式、连接测试、SSRF 校验
│  │  │  ├─ credentials.ts      safeStorage 加密凭据
│  │  │  ├─ characters.ts       角色包读取、头像复制
│  │  │  └─ chat.ts             多 Agent 调度、上下文、记忆、用量
│  │  ├─ preload\               contextBridge 安全 API
│  │  ├─ shared\                共享类型、Provider 预设、十道题与人格提示词
│  │  └─ renderer\              React 界面
│  │     └─ src\
│  │        ├─ pages\           聊天、引导、Agent、社区角色、人格、Provider、统计、记忆、设置
│  │        ├─ components\      PersonaStudio、编辑器、弹窗、Markdown 等
│  │        ├─ store.ts         zustand 状态与聊天事件流
│  │        ├─ assets/misans/   MiSans VF 字体与许可说明
│  │        └─ styles.css       浅色优先的 Aurora Glass 主题（含深色变量）
│  ├─ resources\characters\     12 个本地角色包（8 社区 AI 娘 + 4 原创）
│  ├─ build\                    应用图标
│  ├─ scripts\
│  │  ├─ smoke.mjs              CDP 端到端冒烟测试
│  │  └─ generate_assets.py     原创头像与图标生成
│  ├─ tests\unit.test.ts        Vitest 单元测试
│  └─ package.json
├─ tools\nodejs\               便携式 Node.js v22.20.0（开发用）
└─ release\                    打包产物（安装包、便携版、解包目录）
```

## 开发与运行

Node 采用便携版，未写入系统 PATH：

```bash
export PATH="/i/Agent茶话会/tools/nodejs:$PATH"
cd /i/Agent茶话会/app
npm install
npm run dev
```

生产构建与预览：

```bash
npm run build
npm start
```

直接运行未打包的 Electron：

```bash
env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe .
```

> 本机环境存在全局 `ELECTRON_RUN_AS_NODE=1`，直接启动 Electron 会被当成 Node 执行，必须 unset。

## 测试

```bash
export PATH="/i/Agent茶话会/tools/nodejs:$PATH"
npm test          # 12 个单元测试
npm run typecheck # 渲染层 + 主进程类型检查
npm run build     # 生产构建
npm run smoke     # 23 项 CDP 端到端检查
```

冒烟测试覆盖：首次启动引导、默认浅色、主题切换并持久化、连接测试不伪造状态、演示模式、12 张角色卡、从角色包创建 Agent、头像落盘、首次茶会、发送消息、离线演示回复、Token 计量与估算标记、独立记忆、onboarded / demoMode 持久化、退出重启后 Agent 与聊天记录仍存在。

测试会在 `.smoke/` 下使用独立数据目录，不会污染真实用户数据。

## 打包

```bash
export PATH="/i/Agent茶话会/tools/nodejs:$PATH"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run dist
```

产物输出到 `I:\Agent茶话会\release\`：

- `Agent-Tea-Party-Setup-1.2.0.exe`：NSIS 安装包，可选安装目录，创建桌面/开始菜单快捷方式
- `Agent-Tea-Party-Portable-1.2.0.exe`：便携版
- `win-unpacked`：解包目录，可直接运行

开发版（跳过首次引导、自动带入演示茶会）：

```bash
npm run dist:dev
```

产物为 `I:\Agent茶话会\release-dev\Agent-Tea-Party-Dev-1.2.0.exe`，使用独立数据目录 `AgentTeaPartyDevData`。源码调试时也可以：

```bash
TEA_DEV_SKIP_ONBOARDING=1 npm run dev
```

## 本地数据位置

- 安装版：Electron userData 目录，通常为 `%APPDATA%\Agent Tea Party\`
  - `data/tea-party.db`：SQLite 数据库
  - `avatars/`：本地头像
  - `credentials.vault`：DPAPI 加密后的凭据
- 便携版：可执行文件同目录 `AgentTeaPartyData\`
- 开发版：可执行文件同目录 `AgentTeaPartyDevData\`（与正式版隔离）

应用内「设置 → 本地数据 → 打开」可直接定位。导出备份为 zip，包含数据库与头像，不含 Key。

## 已知限制

- 没有真实 API Key 可用，因此真实在线模型只完成了协议、流式、错误处理与连接测试代码路径，未在本机用付费 Key 做最终连通验证；演示模式与全部本地流程已实测
- Android 尚未开始适配；本次交付只保证 Windows
- 上下文续接使用本地摘要，不是模型生成摘要；续接次数会计入统计
- Token 费用是公开单价的近似估算，不等于供应商账单
- 不支持在线社区、账号、云端角色市场、模型下载/安装（按要求留白）
- 首次冷启动与安装包体积较大（Electron 运行时）
