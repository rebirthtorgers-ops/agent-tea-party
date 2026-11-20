# Agent 茶话会 · 设计规范与实现调研

> 调研日期：2026-11-20  
> 目的：为桌面端 UI 重构提供可验证依据，避免凭感觉堆玻璃效果。

## 1. 结论先说

三套体系可以融合，但职责必须分开：

| 层 | 参考 | 做法 |
| --- | --- | --- |
| 内容层 content | Material 3 | 不透明或高不透明 tonal surface，承载消息、卡片、表格 |
| 功能层 functional | Apple Liquid Glass | 侧栏、顶栏、composer、工具栏，少量半透明玻璃 |
| 浮层 floating | Apple + HyperOS | Modal、菜单、toast，玻璃 + 清晰阴影 + 大圆角 |

Apple 原话是 Liquid Glass 属于「distinct functional layer for controls and navigation」，并明确「Don't use Liquid Glass in the content layer.」当前实现把聊天主区、设置卡、角色卡、统计卡全部玻璃化，属于过度使用。

Web/Electron 无法调用 SwiftUI 的 `glassEffect`，只能做外观近似。不能对外宣称「完全复刻 Liquid Glass」。

## 2. Apple Liquid Glass

官方来源：

- https://developer.apple.com/design/human-interface-guidelines/materials.md
- https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass.md
- https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views.md
- https://developer.apple.com/documentation/swiftui/glass.md
- https://developer.apple.com/documentation/swiftui/glasseffectcontainer.md

要点：

1. Liquid Glass 是浮在内容之上的功能层，让内容从下面透出；不是内容背景。
2. 少用，只给最重要的功能元素。系统控件自动获得效果，自定义控件要克制。
3. 两个变体：
   - regular：模糊并调整背景亮度，保证可读性，适合文字多、侧栏、弹窗。
   - clear：高透明，适合视觉丰富背景、内容优先的场景。
4. 必须测试 reduce transparency / increase contrast / reduce motion；系统可能弱化效果。
5. iOS/iPadOS 标准材料四档：ultraThin、thin、regular、thick。厚材料对比度高，适合小字；薄材料保留更多背景上下文。材料上的文字用 vibrant 颜色。
6. SwiftUI API（iOS 26+）：

```swift
func glassEffect(
    _ glass: Glass = .regular,
    in shape: some Shape = DefaultGlassEffectShape()
) -> some View

.glassEffect(.regular.tint(.orange).interactive(), in: .rect(cornerRadius: 16.0))
```

- 默认形状是 Capsule。
- `GlassEffectContainer(spacing:)` 合并多个 glass shape，支持形变，提升渲染性能。
- `glassEffectUnion(id:namespace:)` 合并几何。
- Glass 有 regular / clear / identity，支持 `.tint(Color?)` 与 `.interactive(Bool)`。
- 精确折射与光照算法不公开。

## 3. Material 3

m3.material.io 需要 JavaScript，直接抓取只得到「requires JavaScript」，因此改用官方 Material Web token 源码：

- https://github.com/material-components/material-web/tree/main/tokens
- 最新生成 token：Design system version 34.0.21，platform web
- 示例：https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/latest/sass/_md-sys-state.scss

### 3.1 状态层

| 状态 | Opacity |
| --- | --- |
| disabled | 0.38 |
| dragged | 0.16 |
| focus | 0.10 |
| hover | 0.08 |
| pressed | 0.10 |

旧版 v0_192 的 focus 是 0.12；以最新 34.0.21 为准。

### 3.2 高度

| Level | Web 值 |
| --- | --- |
| 0 | 0px |
| 1 | 1px |
| 2 | 3px |
| 3 | 6px |
| 4 | 8px |
| 5 | 12px |

Material Web 注释说明 Web 用 level 数字，不直接等于 Android 的 dp。

### 3.3 圆角

| Token | 值 |
| --- | --- |
| extra-small | 4px |
| small | 8px |
| medium | 12px |
| large | 16px |
| large-increased | 20px |
| extra-large | 28px |
| extra-large-increased | 32px |
| extra-extra-large | 48px |
| full | 9999px |

### 3.4 排版

| Token | Size / Line height / Weight |
| --- | --- |
| body-large | 16 / 24 / 400 |
| body-medium | 14 / 20 / 400 |
| body-small | 12 / 16 / 400 |
| label-large | 14 / 20 / 500 |
| label-medium | 12 / 16 / 500 |
| label-small | 11 / 16 / 500 |
| title-large | 22 / 28 / 400 |
| title-medium | 16 / 24 / 500 |
| title-small | 14 / 20 / 500 |
| headline-small | 24 / 32 / 400 |
| headline-medium | 28 / 36 / 400 |
| headline-large | 32 / 40 / 400 |
| display-small | 36 / 44 / 400 |
| display-medium | 45 / 52 / 400 |
| display-large | 57 / 64 / 400 |

### 3.5 动效

- short1–4：50 / 100 / 150 / 200ms
- medium1–4：250 / 300 / 350 / 400ms
- long1–4：450 / 500 / 550 / 600ms
- standard：`cubic-bezier(0.2, 0, 0, 1)`
- emphasized-decelerate：`cubic-bezier(0.05, 0.7, 0.1, 1)`
- emphasized-accelerate：`cubic-bezier(0.3, 0, 0.8, 0.15)`

### 3.6 组件 token 实测

| 组件 | 关键值 |
| --- | --- |
| filled button | 高 40px，corner-full，label-large，hover level1，dragged level3 |
| filled card | corner-medium，level0 |
| dialog | corner-extra-large 28px，container level3，headline-small |
| filled text field | 高 56px，extra-small-top |
| icon button | 容器/状态层 40px，corner-full 或 medium，icon 24px |
| navigation drawer | 宽 360px，container corner-large-end 16px，active indicator 高 56px 的 pill |

## 4. 小米 / HyperOS

官方来源：

- https://hyperos.mi.com/font/zh/about/
- https://dev.mi.com/xiaomihyperos/documentation/detail?pId=1664
- https://dev.mi.com/xiaomihyperos/documentation/detail?pId=2142

### 4.1 MiSans

- 2016 MIUI 8：小米兰亭
- 2019 MIUI 11：小米兰亭 Pro，3 → 10 字重，可变字体
- 2021 MIUI 13：MiSans 免费商用
- 2023 HyperOS：MiSans Global，20+ 书写系统、600+ 语言、10 万+ 字符

官方原话：「层级清晰、阅读舒适是字体设计的两个原则」。HyperOS 通过人因研究定义字号规范、行长、间距，建立系统排版规范。

### 4.2 HyperOS 小部件规范

2025-03-28 版本：

- 1080p 屏幕裁 55px 平滑圆角；2K 裁 73px。
- 折叠屏 42px；Pad 30px。
- 内容安全区：1080p ≥42px；2K ≥55px；折叠 38px；Pad 27px。
- 推荐 MiSans。
- 主要信息 MiSans Demibold；次要信息 MiSans Medium + 40% 透明度。
- 必须支持深色模式、无障碍、多语言、自适应布局、信息密度渐进表达。
- 品牌元素建议保留，但不直接放 app 图标。

### 4.3 超级岛展开态规范

2026-11-19 版本：

- 模板化组件。
- 圆角建议取图片尺寸的 1/4。
- 支持深浅模式两套颜色。

### 4.4 边界

小米没有公开完整的 App UI 设计规范。可借鉴的是：

1. MiSans 排版原则
2. HyperOS 大圆角、安全区、深浅色、无障碍、信息密度
3. 平滑连续圆角（squircle）的观感

不能把「小部件规范」当成桌面 App 规范，也不能声称「完全符合 HyperOS 设计规范」。

## 5. Web 端 Liquid Glass 代码实现

参考 MIT 项目 https://github.com/nikdelvin/liquid-glass

核心不是普通 `backdrop-filter: blur()`，而是：

```css
backdrop-filter:
  blur(calc(blur / 2))
  url("data:image/svg+xml,...#displace")
  blur(blur)
  brightness(1.1)
  saturate(1.5);
```

数据 URL 里的 SVG filter：

1. 生成一张位移图 displacement map：
   - 整体灰色 `#808080`
   - 边缘用红/绿渐变编码 X/Y 位移
   - 内部再叠灰色圆角矩形，模糊 `depth` 像素
2. `feImage` 引入位移图
3. `feDisplacementMap` 用 R 通道控制 X、G 通道控制 Y
4. 色差版本做三次位移（R/G/B 不同 scale），再用 `feBlend mode="screen"` 合回去

限制：

- 不是 Apple 原版算法，只是视觉近似。
- `backdrop-filter: url()` 在 Chromium 上可用，但兼容性与 GPU 开销需要实测。
- 大面积使用会明显掉帧；只适合小尺寸功能层。
- Electron 内必须准备降级：不支持时退回 `blur() saturate()`。

## 6. 当前实现审计

文件：`src/renderer/src/styles.css`

### 6.1 玻璃用太多

共 28 处 `backdrop-filter`：

```
180, 219, 244, 368, 433, 530, 552, 565, 607, 762,
866, 917, 952, 983, 998, 1101, 1138, 1168, 1214,
1248, 1325, 1359, 1376, 1464, 1504, 1530, 1560,
1582, 1679, 1698, 1728
```

具体问题：

- `.chat-side` / `.chat-main` / `.chat-rail` 统一 `var(--glass) + blur(30px)`（598–607）。`.chat-main` 是内容层，不应玻璃化（620–628）。
- `.settings-card` 1573–1583、`.api-form-card` 1551–1561、`.agent-card` 1160–1169、`.provider-card` 1242–1249、`.character-card` 1318–1326、`.stat-card` 1672–1680、`.table-card` 1692–1699、`.memory-card` 1722–1729 全部 `var(--glass) + blur`，应改 tonal surface。
- `.chat-head` 762、`.composer` 917 属于功能层，可以保留玻璃，但要减薄、减模糊。

### 6.2 尺寸不统一

- `.btn`：最小高 40px，圆角 13px，字号 13.5px
- `.icon-btn`：38px
- `.icon-btn.tiny`：28px
- `input`：最小高 42px，圆角 13px
- `.modal-card`：圆角 26px
- `.chat-side` / `.chat-rail`：圆角 26px
- `.chat-main`：圆角 28px

对照 M3：button 40 / full、icon 40、text field 56、dialog 28、card 12、drawer 16。当前接近，但圆角体系混乱，icon 按钮小于 40/44 的触控目标。

### 6.3 状态层不成体系

- `.btn:hover` 用 `var(--hover)`，约 6.5% 紫
- `:active` 只有 scale，没有 10% 状态层
- 输入 focus 用 4px `rgba(113, 82, 243, 0.11)` ring
- 全局 `focus-visible` 为 3px `rgba(113, 82, 243, 0.35)`（156–161），对比度可能不足
- 没有 hover 8% / focus 10% / pressed 10% / disabled 38% 的统一映射

### 6.4 动效

- 0.14 / 0.18 / 0.22 / 0.24 / 0.35s 混用
- easing 混用 ease 与 `cubic-bezier(0.2, 0.8, 0.2, 1)`
- 没有采用 M3 的 standard / emphasized
- 装饰 blob 15 / 17 / 19s，breathe 3.4s
- 已有 `prefers-reduced-motion`（1836–1843），这是优点

### 6.5 对比度

按 WCAG 计算：

| 变量 | 值 | 背景 | 对比度 | 结论 |
| --- | --- | --- | --- | --- |
| `--text` | #1f1932 | #eee9f7 | 14.18 | 通过 |
| `--muted` | #6c6384 | #eee9f7 | 4.70 | 刚过 |
| `--faint` | #9189a8 | #eee9f7 | 2.78 | 不通过 |
| `--faint` dark | #6f6789 | #0c0a15 | 3.72 | 不通过 |
| `--muted` dark | #9a92b4 | #0c0a15 | 6.68 | 通过 |

大量 9.5–10.5px 文字使用 `--faint`，需要提高。

候选替换：

- 浅色 `--faint`：#6a627e，对 #eee9f7 = 4.82
- 深色 `--faint`：#8f86a8，对 #0c0a15 = 5.74

### 6.6 无障碍缺口

已有：

- `focus-visible`
- `prefers-reduced-motion`

缺少：

- `prefers-reduced-transparency`
- `prefers-contrast`
- `forced-colors`
- 40/44px 触控目标验证
- focus ring 对比度验证

## 7. 重构方向

### 7.1 三层材质

```css
/* content layer：不透明 tonal surface */
--surface: #f7f4fb;
--surface-container-low: #f2edf8;
--surface-container: #ece6f4;
--surface-container-high: #e5def0;
--surface-container-highest: #ded6ea;

/* functional layer：克制的玻璃 */
--glass-functional: rgba(255, 255, 255, 0.62);
--glass-functional-blur: 18px;

/* floating layer：玻璃 + 阴影 */
--glass-floating: rgba(255, 255, 255, 0.78);
--glass-floating-blur: 28px;
```

规则：

- `.chat-main`、页面卡片、表格、统计卡：只用 tonal surface，不写 `backdrop-filter`。
- `.chat-side`、`.chat-rail`、`.page-top`、`.chat-head`、`.composer`：玻璃，但 blur 降到 16–20px。
- `.modal-card`、菜单、toast：玻璃 + level3 阴影。
- 不在大面积内容上使用 SVG displacement；最多给按钮/工具条做轻微折射。

### 7.2 Token 化

```css
--shape-xs: 4px;
--shape-sm: 8px;
--shape-md: 12px;
--shape-lg: 16px;
--shape-xl: 28px;

--state-hover: 0.08;
--state-focus: 0.10;
--state-pressed: 0.10;
--state-disabled: 0.38;

--elev-0: none;
--elev-1: 0 1px 2px rgba(31, 25, 50, 0.06);
--elev-3: 0 6px 16px rgba(31, 25, 50, 0.10);
--elev-6: 0 12px 28px rgba(31, 25, 50, 0.14);

--motion-short: 150ms;
--motion-medium: 300ms;
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
```

### 7.3 排版

- 正文 14–16px，行高 1.6–1.8
- 页面标题 28–32px，weight 650–700
- 卡片标题 16–18px，weight 600
- label 12–14px，weight 500
- 中文正文行长控制在 32–40 字
- 数字统一 `font-variant-numeric: tabular-nums`

### 7.4 无障碍

1. `--faint` 提到 4.5:1。
2. icon 按钮桌面 ≥40px，触屏 ≥44px。
3. 补媒体查询：

```css
@media (prefers-reduced-transparency: reduce) {
  .glass { backdrop-filter: none; background: var(--surface-container); }
}

@media (prefers-contrast: more) {
  :root { --line: rgba(31, 25, 50, 0.35); }
  .glass { backdrop-filter: none; background: #fff; }
}

@media (forced-colors: active) {
  * { forced-color-adjust: auto; }
}
```

4. focus ring 用 2px 实线 + 2px offset，确保在浅色/深色都可见。
5. 保留 `prefers-reduced-motion`，并把装饰动画在 reduce 时关掉。

## 8. 本轮落地状态（2026-11-20）

已完成：

- 新增 content / functional / floating 三层 token
- `.chat-main` 改为不透明 tonal surface，去掉内容层玻璃
- 8 类内容卡片去掉 `backdrop-filter`，改为白色/深色 surface + level1 阴影
- 侧栏、顶栏、composer 保留玻璃，但 blur 从 30px 降到 16–20px
- 气泡去掉玻璃，改为实色 + 细边框
- `--faint` 提升到 4.5:1：浅色 #6a627e，深色 #8f86a8
- 统一 focus ring 为 2px 实线 + 2px offset
- icon 按钮从 38px 提到 40px，小号从 28px 提到 30px
- 补 `prefers-reduced-transparency`、`prefers-contrast`、`forced-colors`
- 背景极光降饱和，避免整屏粉紫

尚未完成：

- 全量迁移 M3 shape / state / motion token（目前仍是局部覆盖）
- Liquid Glass SVG displacement 实验（只在功能层小面积试用）
- 深色模式逐页截图复核
- 字号层级全面对齐 M3 typography token

## 9. 实施顺序

1. 建 token 层与三层材质变量。
2. 把内容层 8 个卡片类从 glass 改成 tonal surface。
3. 侧栏/顶栏/composer 减薄玻璃。
4. 统一按钮、输入、icon button 的尺寸与状态层。
5. 修对比度与 focus ring。
6. 补 reduced-transparency / contrast / forced-colors。
7. typecheck → build → smoke → 截图对比 → 打包 1.3.0。
