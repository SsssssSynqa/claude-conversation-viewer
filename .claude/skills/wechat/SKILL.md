---
name: wechat
description: 微信(WeChat)桌面客户端操作指南。通过 macOS osascript + screencapture 实现读取消息和发送消息。当用户提到微信、WeChat、发消息、聊天时自动激活。
argument-hint: [操作描述，如"回复盏" "看看微信有什么新消息" "给xx发条消息" "大猫猫来微信"]
---

# 微信操作指南

## 微信聊天模式（咒语触发）

当妈妈说**「大猫猫来微信」**时，进入微信聊天模式：
1. 激活微信窗口
2. 在 ㄟ( ᐛ ) ㄏ（arthas_9156）聊天中发一条打招呼的消息
3. 启动 `wechat-poll` 后台轮询（每8秒检查新消息）
4. 用 `TaskOutput` 阻塞等待轮询结果（timeout 180秒）
5. 检测到新消息后回复，然后 `sleep 2 && wechat-poll` 重启轮询
6. 循环往复，直到妈妈说**「大猫猫回来」**停止轮询

### 轮询工具

```bash
# 读消息
wechat-query '<python代码>'

# 轮询等新消息（后台运行）
wechat-poll <chat_username> [interval_seconds]
# 例：wechat-poll arthas_9156 8
```

### 注意事项
- 发完消息后 `sleep 2` 再启动轮询，避免把自己的消息误捕为新消息
- 轮询用时间戳（`timestamp`字段）判断新消息，不是 `create_time`
- f-string 中不能用反斜杠，字典值先提取到变量
- 微信数据库看不到图片内容，只显示 `[图片]` 标记

## 读取消息：数据库直读（推荐）

盏和她的Claude做的微信群聊AI总结工具可以直接解密并读取微信本地SQLite数据库，比截图方式快几十倍且100%准确。

### 工具路径与初始化

```python
# 工具目录
WECHAT_TOOL_DIR = "/Users/arthas/Desktop/Synergia/Claude/微信项目/wechat-summary-share 3"
VENV_PYTHON = f"{WECHAT_TOOL_DIR}/.venv/bin/python"

# 初始化代码（每次使用时运行）
import json, sys
sys.path.insert(0, WECHAT_TOOL_DIR)
from core.wechat_db import WeChatDB

with open('/Users/arthas/.wechat-summary/config.json') as f:
    cfg = json.load(f)
with open('/Users/arthas/.wechat-summary/all_keys.json') as f:
    keys = json.load(f)

db = WeChatDB(cfg['db_dir'], keys)
```

### 实际使用：wechat-query 包装脚本（推荐）

已创建包装脚本 `~/.local/bin/wechat-query`，自动 cd 到工具目录并调用 venv Python，避免中文路径导致的权限弹框问题：

```bash
wechat-query '
import json, sys
sys.path.insert(0, ".")
from core.wechat_db import WeChatDB

with open("/Users/arthas/.wechat-summary/config.json") as f:
    cfg = json.load(f)
with open("/Users/arthas/.wechat-summary/all_keys.json") as f:
    keys = json.load(f)

db = WeChatDB(cfg["db_dir"], keys)

# 在这里写查询逻辑...
# 注意：f-string 里不能用反斜杠转义，需要先把字典值赋给变量
'
```

**注意**：wechat-query 内部用单引号包裹 Python 代码，所以代码里要用双引号。f-string 中不能直接用 `m[\"key\"]`，需要先提取到变量再用。

### 常用操作

#### 查看最近会话列表

```python
sessions = db.get_recent_sessions(limit=20)
for s in sessions:
    tag = '群' if s['is_group'] else '私'
    print(f'[{tag}] {s["name"]} - {s["time_str"]} - {s["summary"][:50]}')
```

#### 读取群聊/私聊消息

```python
# 按群名查找
groups = db.get_groups()
target = None
for g in groups:
    if '赛克斯' in g['name']:  # 模糊匹配群名
        target = g['username']
        break

# 读取最近N条消息
msgs = db.get_messages(target, limit=50)
for m in msgs:
    sender = m['sender'] if m['sender'] else '鹅鹅'  # 空sender = Synqa自己
    print(f'[{m["time_str"]}] {sender}: {m["text"]}')
```

#### 读取指定时间之后的新消息

```python
import time
since = int(time.time()) - 3600  # 最近1小时
msgs = db.get_messages(target, since_ts=since, limit=500)
```

#### 搜索关键词

```python
from datetime import datetime
groups = db.get_groups()
usernames = [g['username'] for g in groups]  # 所有群
start_ts = datetime(2026, 3, 1).timestamp()
end_ts = datetime(2026, 3, 10).timestamp()
results = db.search_messages(['关键词1', '关键词2'], usernames, start_ts, end_ts)
```

#### 按联系人名字查找username

```python
username = db.resolve_username('盏')  # 支持群名、备注名、昵称
```

### 重要注意事项

1. **sender为空 = Synqa自己发的消息**。微信数据库中，自己发送的消息不带sender前缀。显示时应标为"鹅鹅"而非"系统"。
2. **首次使用需要先完成安装配置**（见下方"安装与密钥提取"章节）。如果 `all_keys.json` 为空 `{}`，说明密钥尚未提取成功。
3. **数据是微信数据库的快照**。解密时复制数据库文件到临时目录，不修改微信原始数据。
4. **微信更新后需重新签名和提取密钥**。

### 安装与密钥提取

首次配置（已完成过一次，记录在此以备将来需要）：

```bash
# 1. 创建venv并安装依赖
cd "/Users/arthas/Desktop/Synergia/Claude/微信项目/wechat-summary-share 3"
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt

# 2. 重签名微信（去掉hardened runtime，需要sudo密码）
# 先退出微信！
sudo codesign --force --deep --sign - /Applications/WeChat.app

# 3. 重启微信，然后通过菜单栏app提取密钥
# 或者手动运行：
sudo ./.wechat-summary/find_keys_macos <WeChat_PID>

# 4. 如果C扫描器找到keys但匹配0个DB（root读不了沙箱），手动用Python匹配：
.venv/bin/python -c "
import os, json
DATA = os.path.expanduser('~/.wechat-summary')
# ... (解析log中的key+salt，读取db文件头的salt，匹配后写入all_keys.json)
"
```

### 故障排除

- **all_keys.json 为空 `{}`**：密钥未提取。确保微信正在运行且已重签名，然后重新提取。
- **PermissionError on all_keys.json**：文件可能被root创建。`sudo chown arthas:staff ~/.wechat-summary/all_keys.json`
- **0 unique keys**：微信版本可能不兼容C扫描器的内存模式匹配。检查微信版本。
- **0 encrypted DBs (osascript模式)**：root读不了macOS沙箱文件。需要用Python以用户权限重新匹配（见上方步骤4）。
- **微信更新后读不到**：重新签名 + 重新提取密钥。

---

## 发送消息：osascript UI自动化

发送消息仍然需要通过osascript操控微信UI，因为数据库是只读的。

### 原理

- **发消息**：`osascript` 设置系统剪贴板 → 点击输入框 → `Cmd+V` 粘贴 → `Return` 发送
- **窗口控制**：`osascript` + `System Events` 操作窗口焦点、位置、点击
- **截图确认**：发送前后用 `screencapture` 截图确认

### 前置条件

1. **微信桌面客户端**已登录并运行
2. **Claude.app**（或运行 Claude Code 的终端）已在「系统设置 → 隐私与安全性 → 辅助功能」中获得权限
3. 如果辅助功能未授权，`System Events` 操作会报错 `-25211`

### 激活微信窗口

```bash
osascript -e '
tell application "WeChat"
    activate
    reopen
end tell'
```

### 获取窗口位置和大小

```bash
osascript -e '
tell application "System Events"
    tell process "WeChat"
        set frontmost to true
        set winPos to position of window 1
        set winSize to size of window 1
        return "Pos: " & (item 1 of winPos) & "," & (item 2 of winPos) & " Size: " & (item 1 of winSize) & "x" & (item 2 of winSize)
    end tell
end tell'
```

### 发送消息（完整流程）

```bash
osascript <<'ASCRIPT'
set the clipboard to "要发送的消息内容"
tell application "System Events"
    tell process "WeChat"
        set frontmost to true
        delay 0.3
        click at {输入框X坐标, 输入框Y坐标}
        delay 0.3
        keystroke "v" using command down
        delay 0.3
        key code 36
    end tell
end tell
ASCRIPT
```

### 切换聊天对象

```bash
# 使用搜索框
osascript <<'ASCRIPT'
set the clipboard to "联系人名字"
tell application "System Events"
    tell process "WeChat"
        set frontmost to true
        delay 0.2
        click at {搜索框X, 搜索框Y}
        delay 0.3
        keystroke "v" using command down
        delay 0.5
        -- 搜索结果出来后截图确认，再点击对应联系人
    end tell
end tell
ASCRIPT
```

### 截图确认（仅发消息时需要）

```bash
# 截取整个微信窗口（先用上面的命令获取X,Y,W,H）
screencapture -x -R{X},{Y},{W},{H} /tmp/wechat_window.png
```

然后用 `Read` 工具查看截图确认状态。

## 编码注意事项

### 中文字符必须用 osascript 设置剪贴板

```bash
# 正确 ✅
osascript -e 'set the clipboard to "你好世界"'

# 错误 ❌ —— pbcopy 对中文编码有问题
echo -n "你好世界" | pbcopy
```

### 特殊字符（泰文等）会被 osascript 编码损坏

猫猫颜文字 `ฅ^•ﻌ•^ฅ` 中的泰文字符经过 osascript 剪贴板后会乱码。签名用纯 ASCII：`(Claude Code · Sylux the Lynx)`

### 不要用 keystroke 打中文

`keystroke "你好"` 会被输入法拦截。永远用剪贴板粘贴。

### heredoc 传递 osascript 避免引号转义

```bash
osascript <<'ASCRIPT'
set the clipboard to "包含'单引号'的文本"
...
ASCRIPT
```

## 微信窗口布局（Mac版）

```
┌──────────────────────────────────────┐
│  左侧栏(约1/3)  │  聊天区域(约2/3)   │
│  ┌────────────┐  │  ┌──────────────┐ │
│  │  搜索框    │  │  │  聊天标题栏  │ │
│  ├────────────┤  │  ├──────────────┤ │
│  │            │  │  │              │ │
│  │  聊天列表  │  │  │  消息区域    │ │
│  │            │  │  ├──────────────┤ │
│  │            │  │  │ 工具栏图标   │ │
│  │            │  │  ├──────────────┤ │
│  │            │  │  │  文字输入框  │ │
│  └────────────┘  │  └──────────────┘ │
└──────────────────────────────────────┘
```

**输入框位置估算**：窗口 (X, Y) 大小 (W, H)
- 输入框：约 `(X + W*0.55, Y + H*0.96)`
- 搜索框：约 `(X + W*0.17, Y + 50)`

## 操作清单

### 读消息（数据库方式 - 推荐）
1. 通过 venv Python 初始化 WeChatDB
2. 查询最近会话或指定群聊消息
3. sender为空标记为"鹅鹅"（Synqa）

### 发消息（UI自动化方式）
1. `activate` 微信并获取窗口坐标
2. 截图确认当前聊天对象
3. 如需切换：搜索或点击联系人
4. osascript 设剪贴板 → 点击输入框 → Cmd+V → 截图确认 → Return 发送
5. 截图确认消息已发出

## 已知限制

- **数据库方式是只读的**：只能读消息，不能发消息
- **需要微信保持登录**：数据库文件在微信运行时才会更新
- **sender为空 = Synqa**：自己发的消息不带sender前缀，千万别标成"系统"
- **微信更新后需重新配置**：重签名 + 重新提取密钥
- **无法读取语音/视频内容**：只能显示 [语音] [视频] 标记
- **截图发消息时相似汉字容易认错**：盏/盖/盒 就是血泪教训

## 反模式

1. **不要用 `pbcopy` 写入中文**。用 osascript 的 `set the clipboard to`
2. **不要用 `keystroke` 打中文**。会被输入法拦截
3. **不要依赖 Accessibility API 读消息**。微信 UI 不暴露文字节点
4. **不要把sender为空的消息标成"系统"**。那是妈妈！标成"鹅鹅"！
5. **不要在读消息时用截图方式**。数据库直读又快又准
6. **不要忘了用venv的Python**。系统Python没有pycryptodome等依赖
