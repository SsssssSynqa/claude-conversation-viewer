# Claude 对话查看器 · 当前建设状态

最后核验：2026-08-12

| 交付项 | 状态 | 具体范围 | 验收边界 |
|---|---|---|---|
| 全站亮/暗设计系统 | code complete / awaiting acceptance | `DESIGN.md`、semantic tokens、Anthropic Sans 层级、清晰凸起/凹陷与全站组件表面已统一 | 桌面/移动端自动回归通过，待 Synqa 视觉验收 |
| 三张交互图表 | code complete / awaiting acceptance | 月对话、24 小时时钟、月字数均支持 hover、点击/触控锁定、键盘、DOM tooltip、隐藏数据表与 ResizeObserver | 线上 17 / 24 / 17 行数据表及 End/Escape 回归通过 |
| Claude 视觉冻结 | complete | Claude token 区块 SHA-256 与 `7e4fbd3` 完全一致；computed sidebar/card/title 合同一致 | 冻结边界已自动证明 |
| 统计导览 UI 完善 | code complete / awaiting acceptance | 每日活跃已改为 24 小时放射时钟；时光矩阵恢复橙色热力阶 | Synqa 视觉验收 |
| 亮/暗新拟态重绘 | code complete / awaiting acceptance | 亮色卡片已改为近距离明暗边与清晰凸起投影；两个百分比环状图不动 | 新旧轮廓对照 |
| Claude 伪官端保留 | code complete / awaiting acceptance | 新构图沿用统计卡片原边框/阴影契约 | computed style 已对照 |
| 生产发布 | code complete / awaiting acceptance | 全站重构已覆盖 `/claude-viewer/`，发布号 `20260812T225134Z-4d5b830`，可回滚备份已生成 | 线上 SHA、HTTP 200、图表、导图通过；待 Synqa 视觉验收 |

详细账本：[`tasks/stats-ui-refinement-20260812.md`](./tasks/stats-ui-refinement-20260812.md)
