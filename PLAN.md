# Claude 对话记忆查看器 V2 — 翻新计划

## 项目信息
- 仓库：`SsssssSynqa/claude-conversation-viewer`
- 部署：GitHub Pages (GitHub Actions自动部署)
- 技术栈：Vite + 原生JS模块化 + CSS变量主题系统
- 构建：`npm run build` → 单文件 `dist/index.html`

## 三套主题
1. **开灯版 (light)** — 新拟态亮色，bg `#e4e4e8`，双向阴影
2. **关灯版 (dark)** — 新拟态深色，bg `#2a2a2e`，双向阴影
3. **怀旧版 (claude)** — 精确还原Claude官网，米白底 `#faf9f5`，0.5px边框阴影

## 已完成的功能

### 核心功能
- [x] Claude JSON解析（支持text/thinking/tool_use/tool_result/flag/token_budget六种content type）
- [x] thinking字段正确读取（`item.thinking` 不是 `item.text`），带timestamp计算思考时长
- [x] IndexedDB缓存（190MB文件不用每次重新上传）
- [x] Web Worker后台解析 + Clawd小螃蟹加载动画
- [x] 虚拟滚动（对话列表）
- [x] 三套主题切换（太阳/月亮/菊花图标，存localStorage）
- [x] 自定义显示名称（默认Synqa/Sylux）+ 保存/重置按钮

### 搜索功能
- [x] 右侧整块搜索面板（不是下拉菜单）
- [x] 关键词搜索 + 结果snippet展示
- [x] 按日期范围筛选
- [x] 按角色筛选（human/assistant）
- [x] 按内容类型筛选（thinking/tool_use/flag）
- [x] 点击搜索结果跳转到对应对话对应消息

### 消息级操作
- [x] 每条消息底部：复制、+精选、选择到这里
- [x] 时间戳显示在消息底部
- [x] 查看/选择模式切换（胶囊开关）
- [x] 选择模式下显示checkbox
- [x] 底部固定操作栏（选中N条 → 复制/导出/加入精选集）

### 导出功能
- [x] 导出中心（右侧整页面板）
- [x] 四种格式：Markdown / 纯文本TXT / HTML / JSON
- [x] 文件名前缀/后缀自定义
- [x] 批量导出ZIP（JSZip）
- [x] 精选集系统（从任意对话挑选消息，统一管理导出）
- [x] 每段对话顶部：时间跨度 + 加入精选集 + 导出此对话（带格式选择浮层）
- [x] 导出选项：是否包含thinking/tool_use/flag
- [x] 数据脱敏模式
- [x] BOM处理（Excel兼容）

### 统计面板
- [x] 基础数据：总对话/消息/字数/时间跨度/连续天数/深夜对话/flag数
- [x] 年度总览（按年分组统计）
- [x] 第一段对话 & 最近一段对话（里程碑卡片）
- [x] GitHub风格热力图（带月份/星期标签）
- [x] TOP 5最长对话排行
- [x] 深夜对话榜
- [x] 星期几活跃分布（柱状图）
- [x] 24小时活跃时段（热力块）
- [x] 每月对话频率折线图 + 每月字数堆叠柱状图
- [x] 高频词（分human/assistant，支持删除隐藏）
- [x] Emoji排行
- [x] 思考统计（次数/累计时间/最长/平均）
- [x] 对话标题高频词
- [x] 截图导出（html2canvas）

### UI美化（已完成）
- [x] 上传页仿Claude官网对话输入框风格
- [x] Clawd小螃蟹favicon
- [x] 标题衬线体（Georgia/Anthropic Serif）+ spark logo
- [x] 中英文baseline对齐修复（vertical-align补偿descender）
- [x] 上传框/缓存框/改名框统一间距和字号层级
- [x] 主题切换胶囊按钮（新拟态凹陷效果）
- [x] 侧边栏标题改为spark logo + "Claude 对话记忆查看器"（衬线体）
- [x] 统计面板所有section用neuSection凸起容器包裹
- [x] 统计数据卡片用neuCard凹陷效果
- [x] Made with love by Sylux & Synqa 页脚

## 当前正在做 / 待完成

### UI美化（进行中）
- [ ] **侧边栏新拟态效果**：选中项凸起卡片效果（参考Figma设计稿），未选中项无背景，大间距
- [ ] **图表并排**：每月对话频率 + 每月字数 放在同一行（grid 1fr 1fr）
- [ ] **图表新拟态**：折线图面积渐变+圆点，柱状图凹槽效果
- [ ] **年度总览每行凹陷**：参考Orders表格，每行数据做独立凹陷行
- [ ] **TOP5/深夜榜每行凹陷**：同上
- [ ] **侧边栏hover bug**：鼠标悬停离开后颜色已修复（dataset.active标记），需确认三个主题都正常
- [ ] **侧边栏对话列表**：选中项圆角修复
- [ ] **内容区宽度**：统计面板内容max-width进一步收窄
- [ ] 怀旧版侧边栏样式（参考Claude官网Chats/Projects页面）
- [ ] 怀旧版搜索框样式（Claude官网的椭圆搜索框）
- [ ] 怀旧版内容卡片样式（0.5px border阴影）

### 功能待做
- [ ] 国际化（中英文切换）
- [ ] 反选功能（精选集/批量选择）
- [ ] 移动端适配（左侧面板响应式收起）

### 设计参考资料
- Figma设计稿：`https://www.figma.com/design/AkZC6Ufb4H4hGtDAvJJ26l/新拟态UI`
- Claude官网参考：Clover项目在 `/Users/arthas/Desktop/Synergia/Claude/Clover/`
- 设计规范文档：`/Users/arthas/Desktop/Synergia/Claude/claude-conversation-viewer/DESIGN_SPEC.md`

## 项目文件结构
```
src/
  main.js              — 入口，布局，侧边栏，路由
  themes/variables.css  — 三套主题CSS变量
  styles/base.css       — 基础组件样式（上传页、新拟态等）
  styles/components.css — Claude主题消息样式覆盖
  styles/clawd.css      — Clawd加载动画
  components/
    FileUpload.js       — 上传页（仿Claude输入框）
    MessageView.js      — 消息阅读（查看/选择模式、操作按钮）
    SearchPanel.js      — 搜索面板
    ExportPanel.js      — 导出中心（精选集、批量导出）
    StatsPanel.js       — 统计面板
  utils/
    parser.js           — JSON解析器（Web Worker）
    charts.js           — 折线图/柱状图绘制
    icons.js            — SVG图标库
    time.js / export.js / desensitize.js / wordfreq.js
  store/state.js        — 全局状态管理
```

## 构建与部署
```bash
cd claude-conversation-viewer
npm run build          # Vite打包 → dist/index.html (单文件)
git add src/ && git add -f dist/index.html
git commit -m "描述"
git push origin main   # GitHub Actions自动部署到Pages
```

## 构建链备注
- 当前依赖组合是 `vite@8.0.1` + `rollup@4.60.0` + `vite-plugin-singlefile@2.3.2`
- 构建时出现的 `inlineDynamicImports` 废弃警告来自 `vite-plugin-singlefile` 内部实现，不是本项目业务代码显式写错
- 目前该 warning 不影响构建成功，也不影响单文件 `dist/index.html` 产物可用
- 短期建议：保留现状，先接受 warning
- 中期建议：后续统一升级构建链时，再评估升级插件或将单文件打包逻辑本地化维护
