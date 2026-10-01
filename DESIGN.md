# Claude 对话记忆查看器 — 设计规范

> 基于 Claude 官网风格，三套主题统一规范。

---

## 1. 字体系统

| 用途 | 字体 | 备注 |
|------|------|------|
| 标题/Display | `'Anthropic Serif', Georgia, 'Times New Roman', serif` | 英文衬线，中文fallback系统字体 |
| 正文/UI | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` | 系统无衬线 |
| 代码 | `'SF Mono', 'Fira Code', 'JetBrains Mono', Menlo, Consolas, monospace` | 等宽 |

---

## 2. 字号层级

| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| Display | 28px (中文) / 30px (英文Claude) | 330 | 页面大标题 |
| Workspace Title | 24px（窄屏对话标题 21.6px） | 400 | 对话、搜索、导出、统计标题 |
| Reading Body | 16px（怀旧版用户气泡 15px） | 400 | 对话正文；怀旧版助手沿用 Anthropic Serif，行高 1.75 |
| Navigation | 14px / 12px | 500 / 400 | 对话列表标题 / 日期和数量 |
| Section Title | 13px | 600 (bold) | 卡片标题：显示名称设置、发现上次的数据缓存 |
| Label | 12px | 500 | 字段标签：用户显示名、助手显示名 |
| UI Body | 13–15px（上传页沿用 12px） | 400 | 工作区按钮、输入和数据值 |
| Caption | 11-12px | 400 | 底部提示、署名 |

---

## 3. 颜色体系

### 怀旧版 (Claude Theme)
| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-primary` | `#faf9f5` | 页面背景 |
| `--bg-card` | `#ffffff` | 卡片背景 |
| `--text-primary` | `#141413` | 主文字 |
| `--text-secondary` | `#3d3d3a` | 标题、重要文字 |
| `--text-muted` | `#9b9b97` | 标签、辅助文字 |
| `--accent` | `#D97757` | 强调色（仅spark logo、链接） |
| `--btn-primary-bg` | `#3B3B3B` | 主按钮背景 |
| `--section-title-color` | `#6E6E6E` | Section标题 |

### 开灯版 (Light Theme — 新拟态)
| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-primary` | `#e4e4e8` | 页面背景 |
| `--bg-card` | `#e4e4e8` | 卡片背景（同背景，靠阴影区分） |
| `--text-primary` | `#1a1a1a` | 主文字 |
| `--text-secondary` | `#3a3a40` | 标题 |
| `--text-muted` | `#6a6a70` | 标签 |
| `--accent` | `#d4714a` | 强调色 |
| `--btn-primary-bg` | `var(--accent-bg)` | 主按钮（浅橙底+橙字） |
| `--btn-primary-text` | `var(--accent)` | 主按钮文字 |

### 关灯版 (Dark Theme — 新拟态)
| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-primary` | `#2a2a2e` | 页面背景 |
| `--bg-card` | `#2a2a2e` | 卡片背景 |
| `--text-primary` | `#f0f0f0` | 主文字 |
| `--text-secondary` | `#ccccd4` | 标题 |
| `--text-muted` | `#a8a8b0` | 标签 |
| `--accent` | `#e07848` | 强调色 |
| `--btn-primary-bg` | `var(--accent-bg)` | 主按钮（浅橙底+橙字） |
| `--btn-primary-text` | `var(--accent)` | 主按钮文字 |

---

## 4. 阴影系统

### 怀旧版（Claude风格 — 0.5px边框阴影）
```css
--shadow:    0 3px 15px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(31,30,29,0.12);
--shadow-sm: 0 3px 15px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(31,30,29,0.2);
```

### 开灯版（新拟态 — 双向阴影）
```css
--shadow:       4px 4px 10px #cdcdd1, -4px -4px 10px #ffffff;
--shadow-sm:    5px 5px 12px #cdcdd1, -5px -5px 12px #ffffff;
--shadow-inset: inset 2px 2px 5px #cdcdd1, inset -2px -2px 5px #ffffff;
```

### 关灯版（新拟态 — 双向阴影）
```css
--shadow:       4px 4px 10px #1e1e21, -4px -4px 10px #36363b;
--shadow-sm:    5px 5px 12px #1e1e21, -5px -5px 12px #36363b;
--shadow-inset: inset 2px 2px 5px #1e1e21, inset -2px -2px 5px #36363b;
```

---

## 5. 间距规范

| 位置 | 值 | 备注 |
|------|-----|------|
| 页面顶部留白 | `15vh` | 内容不垂直居中，偏上 |
| 标题到输入框 | `20px` | greetingRow margin-bottom |
| 卡片之间 | `16px` | upload-screen gap |
| 卡片内边距 | `16-20px` | 上下16px，左右20px |
| 署名到内容 | `min 80px` | flex spacer |
| 署名底部 | `32px` | padding-bottom |

### 工作区布局
- 桌面怀旧版侧栏宽 `288px`；开灯/关灯版沿用 `300px` 与新拟态材质。
- 对话标题和正文共用居中、最大 `800px` 的阅读栏；标题下集中排列模式、精选和导出操作，正文保留用户气泡右对齐和助手正文左对齐。
- 搜索、导出、统计的面板容器最大 `1000px`；搜索/导出的 header、结果数量条和内容按同一组边界对齐。
- 阅读区桌面左右留白 `32px`，窄屏 `16px`；控件换行，长工具内容在详情内滚动。

---

## 6. 圆角规范

| 元素 | 圆角 | 备注 |
|------|------|------|
| 卡片/输入框 | `20px` | 大圆角，Claude风格 |
| 主题切换外框 | `18px` | 略小于卡片 |
| 主题切换内按钮 | `12px` | 同心圆效果 |
| 按钮 | `8px` | `--radius-sm` |
| 输入框 | `8px` | 凹陷效果 |

---

## 7. 交互规范

### 卡片 Hover
- `transform: translateY(-1px)` — 微浮起
- `box-shadow` 从 `--shadow` 升级到 `--shadow-sm` — 阴影加深
- `transition: box-shadow 0.2s, transform 0.2s`

### 按钮 Hover
- 主按钮：`opacity: 0.85` + 微浮起
- 次按钮：微浮起 + 阴影加深

### 主题切换
- 选中状态：`box-shadow: var(--shadow-inset)` — 凹陷效果
- 未选中：透明背景

### 可交互控件语义
- 切换/选项/菜单项用原生 `<button>`，并用 `aria-pressed` / `aria-checked` / `aria-expanded` 表达状态；**按钮**由 Enter/Space 触发。
- 选择类开关由真实 `<input type="checkbox">` 驱动（视觉 box/switch `aria-hidden`）。复选框主要由 Space 切换（浏览器原生行为）；不要假设 Enter 能切换复选框。视觉选中态用填充/勾选与描边区分。
- 焦点用 `:focus-visible`，由控件内底线和中性填充表达，不加橙色或其他外围 focus 框；隐藏的 checkbox 在可见控件上提示焦点，搜索输入由外层 shell 提示焦点，保留清楚的键盘定位。
- 消息选择由复选框与柔和底色表达，搜索跳转目标短暂显示同族底色，不给整条消息加 outline。
- 消息操作在 hover / `:focus-within` 时显示，触屏保持可见；选择模式为复选框留出独立空间，不覆盖正文。
- 批量选择工具条在阅读区的 flex 布局中占位，消息区独立滚动；窄屏工具条允许换行并位于底部导航上方，不用绝对定位覆盖消息或导航。
- 弹出菜单（如快捷导出）用原生按钮项，Enter/Space 打开并进入首项，方向键/Home/End 导航；Escape 关闭并返回仍存在的触发按钮；点击外部或 Tab 离开时关闭并保留自然焦点。
- 新增/变更 motion 遵循现有节奏，并在 `prefers-reduced-motion: reduce` 下停用。

### 阅读区 thinking/tool 层级（怀旧版）
- 保留轻盈的 inline summary 行（chevron + 摘要 + duration + 数量），点击展开 timeline。
- timeline 每项为原生 `<details>`，可展开查看完整 thinking 文本、`toolInput`、配对 result 与独立 `tool_result`；长内容在受限高度内滚动/换行，不以截断作为唯一入口。
- thinking 屏幕显示沿用现有 `desensitize` 处理，不表示或承诺全工具脱敏；渲染文案均使用安全 DOM/`textContent`。

---

## 8. 图标系统

- **来源**：Lucide Icons (ISC license)
- **规格**：24x24 viewBox, stroke-width 2, round linecap/linejoin
- **月亮特殊处理**：stroke-width 1.5（补偿封闭路径视觉偏粗）
- **Spark Logo**：Claude官方菊花SVG，内联使用
- **Favicon**：Clawd Wave 小螃蟹，32x32 PNG base64内联

---

## 9. 按钮颜色规则

| 主题 | 主按钮背景 | 主按钮文字 | 次按钮 |
|------|----------|----------|--------|
| 怀旧版 | `#3B3B3B` | `#fff` | `bg-input` + `text-secondary` |
| 开灯版 | `accent-bg`(浅橙) | `accent`(橙) | `bg-input` + `text-secondary` |
| 关灯版 | `accent-bg`(浅橙) | `accent`(橙) | `bg-input` + `text-secondary` |

**橙色使用规则**：仅用于 spark logo、主题切换高亮、开灯/关灯版主按钮。怀旧版不用橙色按钮。

---

## 10. 标题中英文对齐

- "Claude"单独 `<span>`，font-size: 30px, vertical-align: -4px
- 中文部分 font-size: 28px
- 补偿英文descender空间（g/y/q/p/j预留区域）

---

*Claude对话记忆查看器 · Made with love by Sylux & Synqa*
