# 贴纸拼团 — 付款确认 & 团长核实功能实施计划

**文件**: `/Users/arthas/Desktop/Synergia/Claude/claude_sticker_group_buy.html`
**后端**: Supabase (`orders` 表, `settings` 表)
**需求来源**: Synqa 2026-03-06

---

## 需求总结

1. **三种付款标识**：
   - 🔴 未付款（默认状态）
   - 🟡 自己确认已付款（团员点击确认）
   - 🟢 团长确认已付款（团长核实后确认）

2. **团长核实功能**：3个团各有1个团长，团长可以看到本团所有人的付款状态并逐个确认

3. **团专属付款码**：不同团的团员看到对应团长的收款二维码

4. **Synqa 全权限**：Synqa 的账号拥有管理员权限（可以操作所有团）

---

## 数据模型设计

### orders 表新增的特殊 sticker_id 记录

| sticker_id | quantity 含义 | 说明 |
|---|---|---|
| `_payment_self` | 1 = 已自确认 | 团员点击"我已付款"后写入 |
| `_payment_leader` | 1 = 团长已确认 | 团长确认该团员付款后写入 |

### settings 表新增记录

| key | value | 说明 |
|---|---|---|
| `team_leaders` | JSON: `{"1":"团长1昵称","2":"团长2昵称","3":"团长3昵称"}` | 各团团长 |
| `admin_users` | JSON: `["鹅鹅"]` | 超级管理员（Synqa），可操作所有团 |
| `team_qr_1` | 团1付款码图片URL或base64 | 团1团长的收款码 |
| `team_qr_2` | 团2付款码图片URL或base64 | 团2团长的收款码 |
| `team_qr_3` | 团3付款码图片URL或base64 | 团3团长的收款码 |

---

## 实施步骤

### Phase 1: 数据层 & 状态管理
- [ ] 在 JS STATE 区域新增 `allPaymentSelf = {}`, `allPaymentLeader = {}` 状态对象
- [ ] 在 `loadAll()` 中解析 `_payment_self` 和 `_payment_leader` 记录
- [ ] 在 `handleOrderEvent()` 中处理付款状态的实时同步
- [ ] 在 `loadAll()` 中从 settings 表加载 `team_leaders`、`admin_users`、`team_qr_*`
- [ ] 新增权限判断函数：`isLeader(name, team)`, `isAdmin(name)`
- [ ] 在 `saveOffline()` / `loadOffline()` 中加入付款状态缓存

### Phase 2: CSS 三种付款标识样式
- [ ] 设计3种直观的付款状态标识（图标 + 颜色 + 文字）
  - 未付款：灰色空心圆 ⭕ + "未付"
  - 自确认：橙色实心圆 🟠 + "已付(待确认)"
  - 团长确认：绿色对勾 ✅ + "已确认"
- [ ] 付款状态列的 CSS（固定在表格右侧区域，醒目位置）

### Phase 3: 团员自确认付款 UI
- [ ] 统计表每行末尾添加"付款状态"列
- [ ] 当前用户行显示"确认付款"按钮（点击后变为"已付(待确认)"标识）
- [ ] 实现 `confirmMyPayment()` 函数：写入 `_payment_self` 记录到 Supabase
- [ ] 二次确认弹窗防误操作："确认你已完成付款？"
- [ ] 已确认后可撤销（再次点击取消确认）

### Phase 4: 团长确认付款 UI
- [ ] 团长看到的行：除了标准列之外，多一个"确认"操作按钮
- [ ] 实现 `leaderConfirmPayment(memberName)` 函数
- [ ] 团长只能操作自己团的成员
- [ ] admin（Synqa）可以操作所有团的成员
- [ ] 团长确认后，该成员行显示绿色 ✅ 标识

### Phase 5: 团专属付款码弹窗
- [ ] 设计付款码弹窗组件（modal）
- [ ] 根据用户所在团号显示对应团长的收款二维码
- [ ] 在页面合适位置添加"查看付款码"入口按钮
- [ ] 付款码旁显示团长昵称和所属团号

### Phase 6: 团长管理面板（可选增强）
- [ ] 团长/admin 可以看到本团付款统计：已付X人 / 未付X人 / 总计X人
- [ ] 高亮未付款的行，方便团长快速定位

### Phase 7: 管理员设置入口
- [ ] 在现有"团长导出/导入"按钮旁添加管理员设置按钮
- [ ] 管理员可设置各团团长（从已注册用户中选择）
- [ ] 管理员可上传/粘贴各团的付款二维码图片
- [ ] 仅 admin 可见此按钮

### Phase 8: Supabase 数据初始化
- [ ] 在 settings 表中插入 team_leaders、admin_users 初始记录
- [ ] Synqa 的昵称确认后写入 admin_users

---

## 需确认事项

1. **Synqa 在拼团网站的昵称是什么？** → 用来设置 admin 权限
2. **三个团的团长分别是谁？** → 如果暂时不知道，做成可以后续设置的
3. **付款码图片怎么提供？** → 团长各自提供收款码图片，admin 上传到设置里
4. **是否需要"已到截止时间不允许再改数量"的锁定功能？** → 当前需求没提但可能需要

---

## 技术要点

- 所有付款状态通过 orders 表的特殊 sticker_id 存储（`_payment_self`, `_payment_leader`），复用现有实时同步机制
- 权限控制纯前端（Supabase anon key 无 RLS），管理操作通过 admin_users 名单在 JS 层判断
- QR 码可以用 base64 存在 settings 表里避免额外图床
- 全部改动在同一个 HTML 文件内完成
