# Agent 茶话会 — 工作区

本地优先的多 Agent 聊天工作台。Windows 桌面版 v1.1.0 已完成并可运行，内置 12 个社区/原创角色预设；另有跳过引导的开发版。

- 源码：`app/`
- 打包产物：`release/`（NSIS 安装包、便携版、win-unpacked）
- 便携 Node.js：`tools/nodejs/`（仅开发用，不纳入版本库）
- 详细说明：[app/README.md](app/README.md)

## 快速运行

安装包：

```text
release\Agent-Tea-Party-Setup-1.1.0.exe
```

免安装：

```text
release\Agent-Tea-Party-Portable-1.1.0.exe
```

或直接运行解包目录：

```text
release\win-unpacked\Agent 茶话会.exe
```

开发版（跳过引导、直接进演示茶会）：

```text
release-dev\Agent-Tea-Party-Dev-1.1.0.exe
```

## 开发

```bash
export PATH="/i/Agent茶话会/tools/nodejs:$PATH"
cd app
npm install
npm run dev
```

## 验证

```bash
npm test
npm run typecheck
npm run smoke
```

仓库不包含 `node_modules`、构建中间产物、测试数据与打包产物；这些可以从源码重新生成。
