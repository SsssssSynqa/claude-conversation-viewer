# 亮/暗主题全站 UI 调研记录 · 2026-08-12

## 已确认范围

- 只重做 `light` 与 `dark` 的新拟态视觉；Claude 伪官端主题的颜色、字体、边框、圆角和阴影冻结。
- Synqa / Sylux 两个百分比环的绘制冻结。
- 每月对话频率、每日活跃时段、每月字数增加 hover、点击/触控与键盘精确数据交互。
- 上传页、侧边栏、搜索、导出、会话、设置与统计使用同一套字体、层级和材质。
- 每日活跃保留 24 小时放射时钟语义；时光矩阵保留橙色热力阶；不使用紫色。

## 调研方法与结论

用户提供的《网页灵感与实现常用网站推荐手册》19 页已全部渲染目检。手册最适合本项目的不是某个现成皮肤，而是第 2 页的工作顺序：**先找气质，再找机制，最后找零件**，并遵循“参考语言，不复制皮肤”。第 10、12、13、15、16、18 页进一步要求组件归入统一主题变量与响应式规则，检查 focus、键盘、reduced motion，统一图标视觉重量，以真实中英文内容验证字体层级，并在上线前检查性能、无障碍与手机降级。

新拟态专项调研收敛为一套物理语法：表面色与页面底色同源；左上为固定光源；近高光与右下近暗边负责轮廓，低透明远投影只提供空气感；凹面只用于输入、轨道和选中态。阴影不能独自承担可操作性，文本、边界与 focus 仍须满足对比要求。参考：[Neumorphism.io](https://neumorphism.io/)、[WCAG 2.2](https://www.w3.org/TR/WCAG22/)。

图表交互采用共享状态而非三个临时补丁：hover / focus 是临时态，click / tap / Enter 是锁定态，方向键与 Home / End 切换数据点，Escape 退出。DOM tooltip 提供完整年月或完整小时；Canvas 同时具备可聚焦名称和隐藏数据表。浮层须可关闭、可悬停并保持到用户移开或关闭，依据 [WCAG 1.4.13](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)；tooltip 同时响应 hover 与 focus，精确数值遵循 [Carbon Tooltip](https://carbondesignsystem.com/components/tooltip/usage/) 与 [Carbon Charts](https://charts.carbondesignsystem.com/tooltips)；鼠标、笔和触控统一使用 [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Using_Pointer_Events)。

排版采用语义角色而非页面私有字号：page title、section title、card title、body、label、caption、metric、microdata。正文不低于 14px，caption 只承载时间与次级元数据，数字使用 tabular nums；小字号文本至少 4.5:1，对图形和可见 focus 至少 3:1。亮/暗主题的 UI 与统计统一用 Anthropic Sans + CJK fallback，Mono 只用于微数据；Claude 主题保留原分工。

## Skill 核验

- 已从 [`ibelick/ui-skills`](https://github.com/ibelick/ui-skills) 官方仓库安装并逐项校验：`ui-skills-root`、`baseline-ui`、`create-design-md`、`improve-ui`、`fixing-accessibility`、`fixing-motion-performance`、`fixing-metadata`。本轮使用 `create-design-md`、`fixing-accessibility` 和 `fixing-motion-performance`；不把 Tailwind / React 专属规则强行移植到原生 JS/CSS 项目。
- 设计规范使用 Google [`design.md`](https://github.com/google-labs-code/design.md) 0.4.0 校验，固定版本执行 lint 与 DTCG export，避免 alpha 规范漂移。
- 本地 Impeccable 2.1.1 落后于官方 Skill 4.0.4；新版涉及 hooks 与重大迁移，当前无人值守施工不做破坏性升级。
- 本地 `ui-ux-pro-max` 的 `data/scripts` 是失效路径桩，不能当可执行查询工具；同样不在本轮与全局安装混装，另列升级事项。

## 审计基线

只读审计综合评分 8/20。关键事实：三张 Canvas 图表无 hit region 与事件模型；亮色小字存在 2.65–3.32:1 的低对比；桌面导航与多个伪控件是 click-only `div`；源码出现 60 种字号表达和约 231 处 `style.cssText`；统计页与其他页面各自维护表面、字体和阴影；搜索、导出、会话和侧栏存在明显框中框；Canvas 缺少 ResizeObserver。

这意味着本轮不能继续局部调色。正确顺序是：规范 semantic tokens 与 type roles，收敛全站承载层级，再实现共享 Canvas 交互控制器，最后做键盘、触控、响应式和导出回归。
