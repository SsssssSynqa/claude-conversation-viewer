# Claude 对话查看器 · 当前建设状态

最后核验：2026-08-12（Synqa 退回第五版后重新开工）

| 交付项 | 状态 | 具体范围 | 验收边界 |
|---|---|---|---|
| 全站亮/暗设计系统 | in progress | 第五版被 Synqa 退回；当前正在重建布局、信息密度、表面层级与样式架构 | 全页面/全状态截图矩阵与 Synqa 视觉验收 |
| 三张交互图表 | code complete / awaiting acceptance | 月对话、24 小时时钟、月字数均支持 hover、点击/触控锁定、键盘、DOM tooltip、隐藏数据表与 ResizeObserver | 线上 17 / 24 / 17 行数据表及 End/Escape 回归通过 |
| Claude 视觉冻结 | complete | Claude token 区块 SHA-256 与 `7e4fbd3` 完全一致；computed sidebar/card/title 合同一致 | 冻结边界已自动证明 |
| 统计导览 UI 完善 | in progress | 图表交互与橙色热力图保留；指标区和手机信息架构返工 | 首屏信息密度、深层滚动与导图验收 |
| 亮/暗新拟态重绘 | in progress | 第五版卡片过大、表面过多、亮色发脏，正在结构性返工；两个百分比环状图不动 | 新旧轮廓、桌面/手机和亮暗验收 |
| 会话中央阅读栏 | in progress | 移除左右分散气泡，目标与统计/导出共享 920px 中央区域和统一阅读轴 | 桌面/手机长对话实际阅读验收 |
| 安全与功能缺陷 | code complete / awaiting full regression | 图例改用安全 DOM 构造；导出计数和 HTML 紫色已修；DOMPurify/Vite/传递依赖更新后 `npm audit` 为 0 | 自动测试已通过，待最终浏览器恶意输入复测 |
| Claude 伪官端保留 | code complete / awaiting acceptance | 新构图沿用统计卡片原边框/阴影契约 | computed style 已对照 |
| 当前生产 | blocked / waiting for rework | 线上仍是被退回的 `20260812T225134Z-4d5b830`；保留回滚备份，本轮尚未覆盖 | 新版全门槛通过后才能重新发布 |

详细账本：[`tasks/stats-ui-refinement-20260812.md`](./tasks/stats-ui-refinement-20260812.md)
