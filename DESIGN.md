---
version: alpha
name: Claude 记忆刻痕 · Porcelain Relief
description: Claude conversation archive viewer with tactile light and dark themes and a frozen Claude replica theme.
colors:
  primary: "#C96342"
  bg-primary: "#E9ECE9"
  bg-secondary: "#E4E8E5"
  bg-card: "#EDF0ED"
  bg-input: "#E1E5E2"
  text-primary: "#202522"
  text-secondary: "#404943"
  text-muted: "#626D66"
  accent: "#C96342"
  accent-ink: "#81351F"
  border: "rgba(68, 82, 73, 0.13)"
  border-strong: "rgba(55, 70, 61, 0.22)"
  stats-human: "#C96342"
  stats-assistant: "#507A76"
typography:
  page-title:
    fontFamily: "Anthropic Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: -0.02em
  section-title:
    fontFamily: "Anthropic Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: -0.015em
  card-title:
    fontFamily: "Anthropic Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 620
    lineHeight: 1.4
  body:
    fontFamily: "Anthropic Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Anthropic Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 520
    lineHeight: 1.4
  caption:
    fontFamily: "Anthropic Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 450
    lineHeight: 1.45
  metric:
    fontFamily: "Anthropic Sans, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: 38px
    fontWeight: 620
    lineHeight: 1
    letterSpacing: -0.045em
    fontFeature: "tnum"
  microdata:
    fontFamily: "Anthropic Mono, SFMono-Regular, Consolas, ui-monospace, monospace"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "tnum"
rounded:
  sm: 8px
  base: 12px
  lg: 18px
  xl: 24px
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

Claude 记忆刻痕是面向长期对话回顾、检索、统计与导出的私人档案工具。亮色与暗色主题使用同一套 **Porcelain Relief** 新拟态语言：表面克制、边缘清楚、层级可辨，重点由内容与数据承担。Claude 主题继续复现官方界面，本轮视觉规范不得改变它的颜色、字体、圆角、边框或阴影。

## Colors

亮色以洁净的中性瓷灰为底，避免旧版米黄与灰褐造成的综合色；暗色以中性炭灰为底，不引入蓝紫色偏。陶土橙是唯一强调色，并承担 Synqa 数据、交互高亮与全部热力图强度；Sylux 数据使用低饱和矿物青。彩色数据线与文本墨色必须分离，小字号标签使用高对比 ink 色，不直接使用低对比图表色。

### Themes

安装的 DESIGN.md 规范尚不支持主题 token；下表是精确的主题覆盖合同。YAML 中记录亮色默认值。

| Role | Light | Dark | Claude（冻结） |
|---|---|---|---|
| `bg-primary` | `#E9ECE9` | `#202421` | `#FAF9F5` |
| `bg-secondary` | `#E4E8E5` | `#252A27` | `#F5F4ED` |
| `bg-card` | `#EDF0ED` | `#272C29` | `#FFFFFF` |
| `bg-input` | `#E1E5E2` | `#1E2320` | `#F5F4ED` |
| `text-primary` | `#202522` | `#F1F4F1` | `#141413` |
| `text-secondary` | `#404943` | `#CDD5D0` | `#3D3D3A` |
| `text-muted` | `#626D66` | `#A8B2AC` | `#73726C` |
| `accent` | `#C96342` | `#E58A67` | `#D97657` |
| `accent-ink` | `#81351F` | `#F0A88B` | 不新增覆盖 |
| `stats-assistant` | `#507A76` | `#8AA9A5` | `#5B7474` |

## Typography

亮色与暗色全站共享一套 Anthropic Sans UI 字体栈；中文依次回退到 PingFang SC、Hiragino Sans GB 与 Microsoft YaHei。页面、侧边栏、搜索、导出、会话和统计不能再各自声明一套字号。大数值也使用 Sans，以 `tabular-nums` 保持表格对齐；Mono 仅用于时间、计数等微数据。Claude 主题继续使用原有 Anthropic Sans / Serif / Mono 分工。

字号只使用 frontmatter 中的八个语义角色。正文不得低于 14px，标签不得低于 13px，caption 只用于时间与次级元数据；移动端输入控件保持至少 16px，避免浏览器自动缩放。大数值的负字距不得超过 `-0.045em`。

## Layout

全站使用 4 / 8 / 16 / 24 / 32 / 48px 间距序列。页面主体靠留白、对齐和分隔线组织；容器不是默认的分组手段。桌面内容区使用固定最大宽度，侧栏保持独立导航层；移动端改为流式单列，所有触控目标至少 44×44px。

一个区域最多只有一层主要承载面。搜索标题、结果组、结果行不能层层各自凸起；导出组和会话消息遵循相同原则。每屏只保留一个主视觉机制，统计图表是统计下半区的视觉主角。

## Elevation & Depth

新拟态的光源固定在左上方。一级凸起由 1px 近高光、右下近暗边与低透明远投影共同定义；远投影只提供空气感，不能替代边框。二级凸起只用于主要操作与关键数据；凹陷只用于输入框、选中槽和图表轨道。任何组件不得同时叠加大外阴影、大内阴影和内部第二张卡。

hover 只提升 1–2px 并轻微加强阴影；pressed / selected 回到同一表面的 inset 状态。焦点使用独立的 2px 可见描边，不以阴影或颜色变化代替。暗色主题使用同样的光向和层级语法，但高光透明度更低。

## Shapes

页面级承载面使用 `lg` 或 `xl` 圆角，输入和普通控件使用 `base`，小型标签使用 `sm`。不再使用交替大/小角制造装饰性轮廓。圆形仅用于百分比环、时间时钟节点和状态点。

## Components

**导航与设置。** 桌面与移动端均使用原生 button、link、radio 或 checkbox 语义。当前页设置 `aria-current="page"`；主题、语言与开关必须可通过键盘完成。折叠侧栏保持与展开态相同的信息层级，不引入另一套材质。

**页面标题。** 搜索、导出、会话和“数据雕塑”共享 page-title；一级内容区使用 section-title，图表与卡片使用 card-title。标题自身不做凸起卡片。

**三张交互图表。** 每月对话频率、每日活跃时段、每月字数共享 DOM tooltip 与交互状态。鼠标悬停或键盘 focus 显示临时精确值；点击、触控或 Enter 锁定当前值；方向键、Home、End 在数据点间移动；Escape 解锁并关闭。tooltip 必须使用完整年月或完整小时，保持可关闭、可悬停且在指针离开后不残留临时状态。Canvas 提供可聚焦名称和隐藏数据表作为完整回退，并通过 ResizeObserver 在容器变化时重绘。

**统计视觉。** 既有的 Synqa / Sylux 百分比环是锁定组件，绘制形态、比例、阴影与颜色不改。每日活跃保留 24 小时放射时钟语义；时光矩阵所有非零强度继续使用橙色色阶。

**导出。** 截图时隐藏浮动 tooltip 与 focus ring；图表中已锁定的数据标记不进入导出图片。导出前后不得改变当前浏览状态。

## Do's and Don'ts

- 使用同一套亮/暗 semantic tokens 覆盖上传页、侧边栏、搜索、导出、会话和统计；不要为统计页另造第二套表面与字体系统。
- 以间距、分隔线、hover 与 selected 状态组织列表；不要再出现“框里还有框”或每一行都是凸卡。
- 热力图和 Synqa 数据使用橙色；不要使用紫色，也不要让矿物青混入热力强度。
- 所有依赖 hover 的信息同时提供 focus、键盘与触控路径；不要让 Canvas 成为读屏器里的数据黑箱。
- 普通文字至少满足 4.5:1 对比度，图形与可见焦点至少满足 3:1；不要让低对比图表色兼任小字号文本色。
- Claude 主题只接受语义、键盘、数据模型和性能修复；不要修改其视觉 token 或组件外观。
- 保留两个百分比环的现有绘制；不要因为统一图表控制器而重画它们。
