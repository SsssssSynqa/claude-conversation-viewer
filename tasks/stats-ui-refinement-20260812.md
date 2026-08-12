# 统计导览 UI 完善（2026-08-12）

## Confirmed

- 统计数据、统计口径、三主题、图片保存、导入/查看/搜索等现有能力全部保留。
- 亮色与暗色主题继续使用新拟态视觉语言；其 surface、边框与阴影可以重做，目标是
  减少塑料感和生硬外轮廓，建立更细腻的凸起/凹陷层级。
- Claude 主题继续模拟官方界面；统计卡片现有 0.5px 边框/阴影契约不改。
- 亮色与暗色主题里的两个百分比环状图已经由 Synqa 确认完成，本轮不改其结构、
  尺寸、颜色、阴影或响应式行为。
- 其余统计导览 UI 可以调整；统计页不再使用紫色。
- 改善中文、数字、标签与图表文字的字体层级。

## Implementation plan

- [x] 为三主题建立统计页专用字体与陶土橙/矿物青灰数据色 token。
- [x] 重做亮/暗统计卡片的新拟态 surface、边框和阴影层级；Claude 主题边框不动。
- [x] 重整数据雕塑、年度总览和里程碑卡片的文字层级与留白。
- [x] 重画星期分布、月度趋势、小时热力与每月字数图表。
- [x] 保持两个已确认环状图和 Claude 主题卡片边框无回归。
- [x] 完成 build、紫色扫描、桌面/手机三主题与图片保存验收。
- [x] 提交、部署 NSP 域名并完成线上验收。

## Status

`complete / awaiting Synqa visual acceptance`

## Local verification

- `npm run build`：通过，生成单文件 `dist/index.html`。
- `npx impeccable --json src/components/StatsPanel.js`：`[]`，布局动画问题已清零。
- 紫色扫描、`git diff --check`：通过。
- 1280px 桌面与 390px 手机：亮色、暗色、Claude 三主题均无页面横向溢出。
- 两个百分比环的源码与响应式 CSS 无 diff；computed style 保持原尺寸/阴影。
- Claude 卡片 computed style 继续命中原 `--shadow` 与 `--radius-lg` 契约。
- 保存图片完成状态为 `截图中... → ✓ 已保存 → 保存为图片`，无控制台错误。

## Production verification

- 实现提交：`51a72f2`（`feat: 完善统计导览三主题界面`）。
- 发布号：`20260812T130713Z-51a72f2`；替换前线上单文件已生成可回滚备份。
- 本地构建、服务器文件与公网响应 SHA-256 一致：
  `3e3474b2cad50d80b0ab94002875a6809f0ba84882682b23e4301a0ead3d8752`。
- 公网 `/claude-viewer/` 返回 200，统计样式 marker 命中；浏览器加载标题、上传入口正常，
  控制台 error/warning 为 0。

## Skill critique baseline

- 视觉评审确认主要廉价感来自：等规格圆角卡片连续堆叠、`800` 字重、紫色与 Claude
  暖色体系割裂、发光渐变胶囊图表，以及图表轨道面积远大于数据本体。
- `npx impeccable --json src/components/StatsPanel.js` 命中 1 项确定性问题：星期柱图用
  `transition: height` 触发布局动画；本轮改用 `transform: scaleY()` / opacity。
- 已确认的两个环状图不纳入这次 critique 修正，避免把 Synqa 已完成的部分重新设计。

## Acceptance boundary

- 自动化通过不代替 Synqa 的视觉验收。
- 本轮不改统计计算、数据解析、存储格式或其他页面。
