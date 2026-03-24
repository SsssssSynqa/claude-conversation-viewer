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
| Section Title | 13px | 600 (bold) | 卡片标题：显示名称设置、发现上次的数据缓存 |
| Label | 12px | 500 | 字段标签：用户显示名、助手显示名 |
| Body | 12px | 400 | 数据值：Synqa、91段对话、按钮文字 |
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
