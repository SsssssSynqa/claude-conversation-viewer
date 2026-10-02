---
version: alpha
name: Claude 记忆刻痕 · Tactile Archive
description: Claude conversation archive viewer with tactile light and dark themes and a frozen Claude replica theme.
colors:
  primary: "#C95F3D"
  bg-primary: "#F1F2EF"
  bg-secondary: "#ECEEEB"
  bg-card: "#F5F6F3"
  bg-input: "#E8EBE7"
  text-primary: "#1F2420"
  text-secondary: "#414943"
  text-muted: "#5F6861"
  accent: "#C95F3D"
  accent-ink: "#853B24"
  border: "rgba(54, 68, 59, 0.16)"
  border-strong: "rgba(45, 59, 50, 0.27)"
  stats-human: "#C95F3D"
  stats-assistant: "#507A76"
typography:
  page-title:
    fontFamily: "Anthropic Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: 19px
    fontWeight: 680
    lineHeight: 1.22
    letterSpacing: -0.02em
  section-title:
    fontFamily: "Anthropic Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: -0.015em
  card-title:
    fontFamily: "Anthropic Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 620
    lineHeight: 1.4
  body:
    fontFamily: "Anthropic Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Anthropic Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 520
    lineHeight: 1.4
  caption:
    fontFamily: "Anthropic Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 450
    lineHeight: 1.45
  metric:
    fontFamily: "Anthropic Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 680
    lineHeight: 1
    letterSpacing: -0.045em
    fontFeature: "tnum"
  microdata:
    fontFamily: "Anthropic Mono, SFMono-Regular, Consolas, ui-monospace, monospace"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "tnum"
rounded:
  sm: 7px
  base: 9px
  lg: 14px
  xl: 18px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
---

## Overview

Claude 记忆刻痕是面向长期对话回顾、检索、统计与导出的私人档案工具。亮色与暗色主题使用同一套 **Porcelain Relief** 新拟态语言：表面克制、边缘清楚、层级可辨，重点由内容与数据承担。Claude 主题沿用官方配色、字体分工与轻盈材质；当前候选的阅读尺度与控件调整限于下方“工作区布局”说明。

## Colors

亮色以洁净的中性瓷灰为底，避免旧版米黄与灰褐造成的综合色；暗色以中性炭灰为底，不引入蓝紫色偏。陶土橙是唯一强调色，并承担 Synqa 数据、交互高亮与全部热力图强度；Sylux 数据使用低饱和矿物青。彩色数据线与文本墨色必须分离，小字号标签使用高对比 ink 色，不直接使用低对比图表色。

### Themes

安装的 DESIGN.md 规范尚不支持主题 token；下表是精确的主题覆盖合同。YAML 中记录亮色默认值。

| Role | Light | Dark | Claude（冻结） |
|---|---|---|---|
| `bg-primary` | `#F1F2EF` | `#1E211F` | `#FAF9F5` |
| `bg-secondary` | `#ECEEEB` | `#232724` | `#F5F4ED` |
| `bg-card` | `#F5F6F3` | `#252925` | `#FFFFFF` |
| `bg-input` | `#E8EBE7` | `#1B1F1C` | `#F5F4ED` |
| `text-primary` | `#1F2420` | `#F2F4F2` | `#141413` |
| `text-secondary` | `#414943` | `#CBD1CD` | `#3D3D3A` |
| `text-muted` | `#5F6861` | `#939D97` | `#73726C` |
| `accent` | `#C95F3D` | `#E57D59` | `#D97657` |
| `accent-ink` | `#853B24` | `#F2A085` | 不新增覆盖 |
| `stats-assistant` | `#507A76` | `#86A7A1` | `#5B7474` |

## Typography

亮色与暗色全站共享一套 Anthropic Sans UI 字体栈；中文依次回退到 PingFang SC、Hiragino Sans GB 与 Microsoft YaHei。页面、侧边栏、搜索、导出、会话和统计不能再各自声明一套字号。大数值也使用 Sans，以 `tabular-nums` 保持表格对齐；Mono 仅用于时间、计数等微数据。Claude 主题继续使用原有 Anthropic Sans / Serif / Mono 分工。

字号只使用 frontmatter 中的八个语义角色。高密度工具界面的常规正文为 13px，标签为 12px，11px caption 只用于时间与次级元数据；长篇对话保持 13px / 1.5 行高。移动端文本输入仍保持 16px，避免浏览器聚焦时自动缩放。大数值的负字距不得超过 `-0.045em`。

## Layout

全站使用 4 / 8 / 16 / 24 / 32 / 48px 间距序列。页面主体靠留白、对齐和分隔线组织；容器不是默认的分组手段。桌面页面共享 920px 中央工作区，对话头部与全部消息落在同一阅读轴；移动端不是桌面卡片的机械单列版，而是紧凑矩阵与流式阅读。高频主导航目标至少 44px，其他高密度控件遵守 WCAG 2.2 AA 的 24px 最小目标并保留清楚间隔。

一个区域最多只有一层主要承载面。搜索标题、结果组、结果行不能层层各自凸起；导出组和会话消息遵循相同原则。每屏只保留一个主视觉机制，统计图表是统计下半区的视觉主角。

## Elevation & Depth

新拟态的光源固定在左上方。一级凸起由 1px 近高光、右下近暗边与低透明远投影共同定义；远投影只提供空气感，不能替代边框。二级凸起只用于主要操作与关键数据；凹陷只用于输入框、选中槽和图表轨道。任何组件不得同时叠加大外阴影、大内阴影和内部第二张卡。

hover 只提升 1–2px 并轻微加强阴影；pressed / selected 回到同一表面的 inset 状态。暗色主题使用同样的光向和层级语法，但高光透明度更低。

**焦点可见性。** 焦点必须始终以 `:focus-visible` 可见；视觉形式由当前候选合同决定（见“工作区布局”）：高密度阅读与列表控件优先使用控件内细底线 / 中性填充，不要给整行或整条消息套外围 focus 框。主题层不得用后加载的材质规则覆盖这一提示。隐藏的 checkbox 必须通过其可见 proxy 提示焦点，搜索输入由外层 shell 提示焦点。

## Shapes

页面级承载面使用 `lg` 或 `xl` 圆角，输入和普通控件使用 `base`，小型标签使用 `sm`。不再使用交替大/小角制造装饰性轮廓。圆形仅用于百分比环、时间时钟节点和状态点。

### 工作区布局
- 桌面怀旧版侧栏宽 `288px`；开灯/关灯版沿用 `300px` 与新拟态材质。
- 亮/暗主题保留上游的 920px 中央工作区与字体/材质系统，消息共用居中的 74ch 阅读列；用户气泡随内容收窄、在这条阅读列内靠右，姓名、时间和操作沿同一右边缘排列，助手正文继续无外层卡片。短消息不再占用整栏有色底板，长消息在列内换行。
- 怀旧版（Claude）阅读栏：对话标题和正文共用居中、最大 `800px` 的阅读轴，正文 `16px`，标题与正文左对齐；标题下集中排列模式、精选和导出操作，正文保留用户气泡右对齐和助手正文左对齐。
- 怀旧版搜索、导出、统计的面板容器最大 `1000px`；亮暗主题沿用上游 `920px` 工作区。搜索/导出的 header、结果数量条和内容共用中央容器与留白。
- 阅读区桌面左右留白 `32px`，窄屏 `16px`；控件换行，长工具内容在详情内滚动。

> **候选状态说明。** 本节的 800px / 16px 阅读轴、内底线焦点、原生控件语义与 thinking/tool timeline 是当前 branch 的显式候选成果，**尚未由上游接受**，也不改写任何既往部署/发布证据；实现见 `src/` 与 `test/reader-controls.test.js`。

## Components

**导航与设置。** 桌面与移动端均使用原生 button、link、radio 或 checkbox 语义。当前页设置 `aria-current="page"`；主题、语言与开关必须可通过键盘完成。折叠侧栏保持与展开态相同的信息层级，不引入另一套材质。

**页面标题。** 搜索、导出、会话和“数据雕塑”共享 page-title；一级内容区使用 section-title，图表与卡片使用 card-title。标题自身不做凸起卡片。

**上传页。** 亮色、暗色与 Claude 主题的上传区、缓存条和显示名称承载面共享 504px 最大宽度；三主题还共享 `15vh` 的首屏上锚点和 `16px` 的区块间距，主题层不得另行覆盖 `upload-screen` 的 padding 或 gap。主题差异只来自材质，不通过横向拉宽或上下移动亮暗主题制造第二套构图。手机继续使用视口内满宽布局，但不改变这条共享上锚点。

**三张交互图表。** 每月对话频率、每日活跃时段、每月字数共享 DOM tooltip 与交互状态。鼠标悬停或键盘 focus 显示临时精确值；点击、触控或 Enter 锁定当前值；方向键、Home、End 在数据点间移动；Escape 解锁并关闭。tooltip 必须使用完整年月或完整小时，保持可关闭、可悬停且在指针离开后不残留临时状态。Canvas 提供可聚焦名称和隐藏数据表作为完整回退，并通过 ResizeObserver 在容器变化时重绘。

**统计视觉。** 既有的 Synqa / Sylux 百分比环是锁定组件，绘制形态、比例、阴影与颜色不改。每日活跃保留 24 小时放射时钟语义；时光矩阵所有非零强度继续使用橙色色阶。

**导出。** 截图时隐藏浮动 tooltip 与 focus ring；图表中已锁定的数据标记不进入导出图片。导出前后不得改变当前浏览状态。

## Do's and Don'ts

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

- 使用同一套亮/暗 semantic tokens 覆盖上传页、侧边栏、搜索、导出、会话和统计；不要为统计页另造第二套表面与字体系统。
- 以间距、分隔线、hover 与 selected 状态组织列表；不要再出现“框里还有框”或每一行都是凸卡。
- 热力图和 Synqa 数据使用橙色；不要使用紫色，也不要让矿物青混入热力强度。
- 所有依赖 hover 的信息同时提供 focus、键盘与触控路径；不要让 Canvas 成为读屏器里的数据黑箱。
- 普通文字至少满足 4.5:1 对比度，图形与可见焦点至少满足 3:1；不要让低对比图表色兼任小字号文本色。
- Claude 主题保留官方配色、字体分工与轻盈外观；本候选只在上述阅读尺度与控件细节范围内调整，其余视觉 token 沿用上游。
- 保留两个百分比环的现有绘制；不要因为统一图表控制器而重画它们。
