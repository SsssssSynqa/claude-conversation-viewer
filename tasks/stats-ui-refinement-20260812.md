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

`rework deployed / awaiting Synqa visual acceptance`

## Synqa rejection and structural rework

第一版于 2026-08-12 被 Synqa 退回：肉眼变化不足，数字字体看起来没有改变，整体像只
换了颜色。根因是仍沿用旧版四等分卡片轮廓，并把数据字体设成与旧界面非常接近的
Anthropic Sans；实现差异没有转化成视觉差异。

第二版已作结构性返工：

- 主指标区由四张等宽卡片改为六列非对称仪表盘：总窗口数成为双层主牌，消息数/思考数
  为并列副牌，思考总时间横跨双列。
- 统计数字真实加载内置 Anthropic Serif，不再依赖近似系统字体；小型数据使用
  Anthropic Mono，建立明显的字形与尺度对比。
- 亮/暗主题的主指标增加内凹数字槽，卡片改为非对称圆角的软雕塑表面；Claude 主题只
  使用新构图和字体，原官方边框/阴影仍保持不变。
- 星期分布从旧竖向胶囊改为七行横向比较尺，年度卡片改为大年份 + 数据列构图。
- 两个已确认百分比环的源码、尺寸、色彩、阴影和响应式规则仍无 diff。

返工后的 1280px 与 390px 三主题检查均无页面横向溢出；数字 computed font 为
`Anthropic Serif`，Claude 卡片 computed shadow 仍与原 `--shadow` 契约一致。

## Rework production verification

- 返工提交：`71bb04c`（`refactor: 重做统计导览数字与构图`）。
- 发布号：`20260812T133639Z-71bb04c`；覆盖前第一版仍保留独立回滚备份。
- 本地构建、服务器文件与公网响应 SHA-256 一致：
  `b6796336ef32e9b8e407c998494c88890cc374ee19c2f380a0655011d80086f9`。
- 公网返回 200、`Cache-Control: no-store, must-revalidate`；返工 marker 命中，浏览器加载
  标题与上传入口正常，控制台 error/warning 为 0。

## Third visual pass

Synqa 对第二版提出三项明确纠正：不要卡片内再套数字框；亮色新拟态需要更干净；每日
活跃与每月字数需要真正重画。

- 已删除所有指标卡内部的凹槽 surface / shadow，数字直接排在卡片表面。
- 亮色统计区改为暖白瓷底与中性灰绿阴影，去掉原来的灰褐综合色；不改全局其他页面。
- 每日活跃由两排 24 个色块改为连续 24 小时波形柱，保留 0/6/12/18 点坐标。
- 每月字数由 34 条胶囊槽柱改为双面积趋势图，直接比较双方时间走势。
- 两个百分比环与 Claude 卡片边框/阴影仍无 diff。

## Fourth visual pass

Synqa 继续指出每日活跃表现力不足、时光矩阵需要橙色，以及亮色新拟态边缘仍然发糊。

- 每日活跃从线性竖柱彻底改为 24 小时放射时钟：24 根射线按小时顺时针排列，长度与
  消息量成比例，中央直接标出峰值小时和消息数，四个方位标记夜 / 晨 / 昼 / 暮。
- 时光矩阵的所有非空强度级统一改为由浅橙到深陶土橙；空值仍保持中性，避免把“没有
  活跃”误编码成低强度活跃。
- 亮色统计底板与卡片拉开明度差，卡片阴影由大范围低对比模糊改为近距离双向投影、底部
  落影、1px 高光边和反光侧暗边，建立明确的凸起方向。
- 两个百分比环源码与样式无 diff；Claude 卡片继续使用原 0.5px 官方风格阴影契约。

## Fourth-pass local verification

- `npm run build` 与 `npx impeccable --json src/components/StatsPanel.js` 均通过。
- 亮色桌面截图确认放射时钟、橙色矩阵与卡片凸起边缘；暗色和 Claude 的热力阶均为橙色。
- 亮 / 暗 / Claude 三主题无页面横向溢出；390px 手机布局无横向溢出。
- Claude 卡片 computed style 仍为 `0 3px 15px rgba(0,0,0,.035) + 0.5px outline`，
  `border-radius: 16px`；百分比环尺寸和阴影保持原值。
- 保存图片已成功生成 `数据雕塑_2026-08-12.png`；当前浏览器控制台 error/warning 为 0。

## Fourth-pass production verification

- 第四版提交：`7e4fbd3`（`refactor: 重塑每日节律与亮色新拟态`）。
- 发布号：`20260812T151926Z-7e4fbd3`；覆盖前文件备份为
  `/var/backups/claude-conversation-viewer/index.html.before-20260812T151926Z-7e4fbd3`。
- 本地构建、服务器文件与公网响应 SHA-256 一致：
  `48df2c157492caec8f719bc96639a79da758f15f2349d6d8239242ac213c568a`。
- 公网返回 200、`Cache-Control: no-store, must-revalidate`；放射时钟 CSS 与橙色热力 token
  均命中，标题、上传入口正常，浏览器控制台 error/warning 为 0。

## Local verification

- `npm run build`：通过，生成单文件 `dist/index.html`。
- `npx impeccable --json src/components/StatsPanel.js`：`[]`，布局动画问题已清零。
- 紫色扫描、`git diff --check`：通过。
- 1280px 桌面与 390px 手机：亮色、暗色、Claude 三主题均无页面横向溢出。
- 两个百分比环的源码与响应式 CSS 无 diff；computed style 保持原尺寸/阴影。
- Claude 卡片 computed style 继续命中原 `--shadow` 与 `--radius-lg` 契约。
- 保存图片完成状态为 `截图中... → ✓ 已保存 → 保存为图片`，无控制台错误。

## Third-pass production verification

- 第三版提交：`772ee85`（`refactor: 简化统计卡片并重画节律图表`）。
- 发布号：`20260812T141025Z-772ee85`；覆盖前文件备份为
  `/var/backups/claude-conversation-viewer/index.html.before-20260812T141025Z-772ee85`。
- 本地构建与公网响应 SHA-256 一致：
  `ddb763fc52d6412748052cd5ad2147a1cf74f922a8ec33da23d0770737fe81dc`。
- 公网返回 200、`Cache-Control: no-store, must-revalidate`；`stats-hour-wave`、
  `stats-comparison-chart`、`stats-page-surface` 三个第三版 marker 均命中。
- 公网浏览器加载标题、上传入口正常，第三版图表样式已进入产物，控制台 error/warning 为 0。

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
- 本轮不改统计计算、数据解析或存储格式；在 Synqa 后续明确要求下，亮/暗主题的侧边栏、
  搜索、导出与会话页也已纳入同一设计系统，Claude 主题仍冻结。

## Fifth pass · full-site system and interactive charts

- 调研流程与依据记录在 `docs/UI_RESEARCH_20260812.md`；重新编写 `DESIGN.md`，并通过
  `@google/design.md@0.4.0 lint`（0 error / 0 warning）。
- 亮/暗主题收敛为 **Porcelain Relief**：统一 Anthropic Sans/CJK 字体栈、语义字号、
  陶土橙/矿物青数据色、清晰近边高光与右下落影；Claude 视觉 token 不改。
- 侧边栏、主题/语言切换、设置开关、搜索、导出、会话与统计使用同一层级语法；搜索结果、
  导出列表和助手消息不再逐层套卡。
- 月对话频率、每日活跃时段和每月字数新增统一交互层：pointer hover、click/tap 锁定、
  Arrow/Home/End 导航、Enter/Space 锁定、Escape 关闭、DOM tooltip、屏幕阅读器数据表与
  ResizeObserver 重绘。
- 交互控件改用原生 `button` / `checkbox`；导出菜单补齐 `aria-expanded`、Escape 与焦点恢复；
  统计 overlay 补齐 dialog、焦点圈与 Escape。

## Fifth-pass verification and production

- 设计提交 `3c9dc86`，实现提交 `bd84165`，导图兼容修复 `4d5b830`。
- `npm run build`、`git diff --check`、敏感信息扫描通过；Vite 仅保留项目既有的
  `inlineDynamicImports` deprecation warning。
- Playwright 使用 72 段合成 Claude 导出数据验证亮/暗/Claude、桌面/移动端、搜索、导出、
  会话、三张图 hover/锁定/键盘与隐藏表；浏览器控制台 error 为 0。
- 无障碍数据表分别为 17 / 24 / 17 行；统计导图生成
  `数据雕塑_2026-08-12.png`，PNG data URL 长度 2,070,902，导出状态复原。
- Claude token 区块 SHA-256 在改前改后均为
  `07e59912cf2e19a2dc54c8c20c0b2df92fc085622500af8a791e07a8899351e4`；
  两个百分比环实现区块均为
  `45a7ad60ed368f979be57bf45702f41160280c090152b9271ad4fc7b68950579`。
- 最终发布号 `20260812T225134Z-4d5b830`；覆盖前备份为
  `/var/backups/claude-conversation-viewer/index.html.before-20260812T225134Z-4d5b830`。
- 本地、服务器与公网 SHA-256 一致：
  `e74fbf5048023f2386b831319acbf3ddc389b45ee634fdf6f41e04ea4b11e001`；公网 HTTP 200，
  `Cache-Control: no-store, must-revalidate`。


## Sixth pass · full-stack structural rework

第五版被 Synqa 退回后，不再继续局部补丁。本轮依据全栈审计重建亮/暗主题：

- 删除 `refinement.css`，将亮/暗规则收敛到 `tactile.css`，Claude 主题与两个百分比环不进入覆盖层。
- 桌面会话头部、双方消息与时间分隔统一进入 920px 中央阅读轴，取消左右分散气泡。
- 320/390px 手机改为高信息密度独立布局；统计首屏不再堆叠巨型卡片。
- 上传和显示名称区域在亮/暗桌面收窄为 504px，与 Claude 主题一致；320px 手机维持 279px 流式宽度。
- 修复显示名 DOM XSS、导出消息数、导出紫色、双语残缺、畸形解析、键盘语义与 CSP。
- 建立 16 项源码/逻辑测试与 3 项生产单文件合同测试。

### Sixth-pass production verification

- 实现提交：`3643f23`。
- 发布号：`20260813T013738Z-3643f23`。
- 回滚备份：`/var/backups/claude-conversation-viewer/index.html.before-20260813T013738Z-3643f23`。
- 本地、服务器与公网 SHA-256 一致：
  `83cdf65018b27562e3538be6f666f1f4798266bb79902017241adde8f90c6140`。
- 公网 HTTP 200；桌面上传/名称区域 504px，320px 手机为 279px，overflow 0；控制台 error/warning 0。
- 全栈复审由 11/32 提升到 30/32，开放 P0/P1 为 0；剩余均为不阻断的 P2 技术债或明确冻结边界。
