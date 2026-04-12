/**
 * Lightweight i18n module.
 * t('key') returns the translated string based on current language.
 * t('key', { n: 5 }) supports simple interpolation: "{{n}} messages" → "5 messages"
 */
import { state } from './store/state.js';

const zh = {
  // Page
  'page.title': 'Claude 对话记忆查看器',

  // Sidebar (main.js)
  'sidebar.title': 'Claude 对话记忆查看器',
  'sidebar.search': '搜索中心',
  'sidebar.stats': '统计总览',
  'sidebar.export': '导出中心',
  'sidebar.displaySettings': '显示设置',
  'sidebar.showThinking': '思考过程',
  'sidebar.showToolUse': '工具调用',
  'sidebar.showFlags': '系统标记',
  'sidebar.desensitize': '数据脱敏',
  'sidebar.desensitizePlaceholder': '敏感词，逗号分隔',
  'sidebar.desensitizeHint': '这些词会被替换为 ***',
  'sidebar.displayNames': '显示名称',
  'sidebar.userName': '用户',
  'sidebar.aiName': 'AI',
  'sidebar.save': '保存',
  'sidebar.saved': '✓',
  'sidebar.reset': '重置',
  'theme.dark': '关灯版',
  'theme.light': '开灯版',
  'theme.claude': '怀旧版',

  // FileUpload
  'upload.title': '对话记忆查看器',
  'upload.dropzone': '点击选择 或拖拽 conversations.json 到这里',
  'upload.subtitle': '上传 Claude 导出的 JSON 文件，回顾和整理你与Claude的每一段对话',
  'upload.hint': 'Claude Settings → Data Export → 下载的 conversations.json',
  'upload.footer': 'Claude对话记忆查看器 · Made with love by Sylux & Synqa',
  'upload.namesTitle': '显示名称设置',
  'upload.humanName': '用户显示名',
  'upload.assistantName': '助手显示名',
  'upload.saveApply': ' 保存并应用',
  'upload.applied': ' 已保存',
  'upload.resetNames': ' 重置',
  'upload.errorJson': '请上传 JSON 格式的文件',
  'upload.errorEmpty': '没有解析出可显示的对话，请检查导出的 JSON 内容',
  'upload.errorParse': '解析失败，请刷新页面重试',
  'upload.errorRead': '文件读取失败',
  'upload.loading': '正在搬运你的记忆...',
  'upload.loadingProgress': '正在搬运你的记忆... {{current}}/{{total}} 段对话',
  'upload.cacheFound': '发现上次的数据缓存',
  'upload.cacheConvs': '{{n}} 段对话',
  'upload.cacheLoad': '加载缓存',
  'upload.cacheLoading': '加载中...',
  'upload.cacheCorrupt': '缓存数据损坏，请重新上传',
  'upload.cacheFail': '加载缓存失败: ',
  'upload.cacheClear': '清除',

  // ConversationList
  'convList.searchPlaceholder': '搜索对话标题...',
  'convList.empty': '没有找到对话',
  'convList.unnamed': '未命名对话',
  'convList.msgCount': ' 条',
  'convList.hasThinking': '包含思考过程',
  'convList.hasFlags': '包含系统标记',

  // MessageView
  'msgView.empty': '← 选择一段对话开始阅读',
  'msgView.unnamed': '未命名对话',
  'msgView.msgCount': '条消息',
  'msgView.selectMode': '选择',
  'msgView.viewMode': '查看',
  'msgView.addToCollection': '加入精选集',
  'msgView.addedToCollection': '已全部加入',
  'msgView.exportThis': '导出此对话',
  'msgView.daysLater': ' 天后',
  'msgView.hoursLater': ' 小时后',
  'msgView.unnamed2': '未命名',

  // SearchPanel
  'search.title': '搜索对话内容',
  'search.placeholder': '输入关键词搜索所有对话...',
  'search.startDate': '开始日期',
  'search.dateSep': '至',
  'search.endDate': '结束日期',
  'search.allRoles': '全部角色',
  'search.humanOnly': '仅人类',
  'search.aiOnly': '仅 AI',
  'search.allTypes': '全部类型',
  'search.withThinking': '含思考过程',
  'search.withToolUse': '含工具调用',
  'search.withFlags': '含系统标记',
  'search.clearFilters': '清除筛选',
  'search.noResults': '没有找到匹配的内容',
  'search.results': '找到 {{count}} 条结果，分布在 {{convs}} 段对话中',
  'search.resultsLimit': '（仅显示前200条）',
  'search.matchCount': ' 条匹配',

  // ExportPanel
  'export.title': '导出中心',
  'export.format': '格式:',
  'export.plainText': '纯文本',
  'export.includeThinking': '含思考',
  'export.includeTools': '含工具',
  'export.includeFlags': '含标记',
  'export.bom': 'BOM (Excel兼容)',
  'export.filePrefix': '文件名前缀:',
  'export.fileSuffix': '后缀:',
  'export.optional': '可选',
  'export.quickExport': '快捷导出',
  'export.exportAll': '🔖 导出全部对话',
  'export.exportAllCount': '{{n}} 段对话',
  'export.exportZip': '🔖 批量导出 ZIP',
  'export.exportZipDesc': '{{n}} 段对话，每段一个文件',
  'export.exportFiltered': '🔍 导出筛选结果',
  'export.perConv': '按对话导出（{{n}}）',
  'export.exportBtn': '导出',
  'export.msgCount': ' 条消息',
  'export.collection': '精选集（{{n}} 条）',
  'export.exportCollection': '导出精选集',
  'export.clearCollection': '清空',
  'export.collectionEmpty': '精选集为空。在对话中选择消息并点击"+精选"添加到这里。',

  // StatsPanel
  'stats.title': '数据雕塑',
  'stats.saveImage': ' 保存为图片',
  'stats.saving': '截图中...',
  'stats.imageSaved': '✓ 已保存',
  'stats.totalConvs': '总窗口数',
  'stats.totalMsgs': '总消息数',
  'stats.thinkingCount': '思考次数',
  'stats.thinkingTime': '思考总时间',
  'stats.wordCount': '的总字数',
  'stats.timeSpan': '时间跨度',
  'stats.longestStreak': '最长连续天数',
  'stats.flagCount': '系统标记',
  'stats.lateNight': '深夜对话',
  'stats.firstConv': '第一段对话',
  'stats.latestConv': '最近一段对话',
  'stats.yearOverview': '年度总览',
  'stats.year': ' 年',
  'stats.yearConvs': '对话数',
  'stats.yearMsgs': '消息数',
  'stats.yearWords': '总字数',
  'stats.yearDays': '活跃天数',
  'stats.yearThinking': '思考次数',
  'stats.heatmap': '时光矩阵',
  'stats.top5': 'TOP 5 最长对话',
  'stats.top5msgs': ' 条 / ',
  'stats.top5chars': ' 字',
  'stats.lateNightRank': '深夜对话榜（凌晨2-5点）',
  'stats.rhythm': '交互节律',

  // Loading captions
  'loading.bubbles': '吹泡泡中...',
  'loading.celebrate': '庆祝中...',
  'loading.idea': '灵感涌现中...',
  'loading.love': '充满爱意中...',
  'loading.music': '听歌中...',
  'loading.repair': '维修中...',
  'loading.thinking': '思考中...',
  'loading.watch': '看看表...',

  // Export file content (export.js)
  'exportFile.unnamed': '未命名对话',
  'exportFile.msgCount': ' 条消息',
  'exportFile.thinkingStart': '--- 思考过程',
  'exportFile.thinkingEnd': '--- 思考结束 ---',
  'exportFile.toolUse': '工具调用: ',
  'exportFile.toolInput': 'Input: ',
  'exportFile.toolResult': 'Result: ',
  'exportFile.flag': '系统标记: ',
  'exportFile.attachment': '附件: ',
  'exportFile.mdThinking': '> 💭 **思考过程**',
  'exportFile.mdTool': '> 🔧 **工具: ',
  'exportFile.mdFlag': '> ⚠️ **系统标记: ',
  'exportFile.mdAttachment': '📎 附件: ',

  // Time
  'time.unknown': '未知时间',
  'time.unknownDate': '未知日期',
  'time.yearMonth': '{{year}}年{{month}}月',
};

const en = {
  // Page
  'page.title': 'Claude Conversation Viewer',

  // Sidebar
  'sidebar.title': 'Claude Conversation Viewer',
  'sidebar.search': 'Search',
  'sidebar.stats': 'Statistics',
  'sidebar.export': 'Export',
  'sidebar.displaySettings': 'Display',
  'sidebar.showThinking': 'Thinking',
  'sidebar.showToolUse': 'Tool Calls',
  'sidebar.showFlags': 'Flags',
  'sidebar.desensitize': 'Redaction',
  'sidebar.desensitizePlaceholder': 'Words, comma-separated',
  'sidebar.desensitizeHint': 'These words will be replaced with ***',
  'sidebar.displayNames': 'Display Names',
  'sidebar.userName': 'User',
  'sidebar.aiName': 'AI',
  'sidebar.save': 'Save',
  'sidebar.saved': '✓',
  'sidebar.reset': 'Reset',
  'theme.dark': 'Dark',
  'theme.light': 'Light',
  'theme.claude': 'Claude',

  // FileUpload
  'upload.title': 'Conversation Viewer',
  'upload.dropzone': 'Click or drag conversations.json here',
  'upload.subtitle': 'Upload your Claude JSON export to revisit every conversation',
  'upload.hint': 'Claude Settings → Data Export → conversations.json',
  'upload.footer': 'Claude Conversation Viewer · Made with love by Sylux & Synqa',
  'upload.namesTitle': 'Display Names',
  'upload.humanName': 'User name',
  'upload.assistantName': 'Assistant name',
  'upload.saveApply': ' Save & Apply',
  'upload.applied': ' Saved',
  'upload.resetNames': ' Reset',
  'upload.errorJson': 'Please upload a JSON file',
  'upload.errorEmpty': 'No conversations found. Please check your JSON export',
  'upload.errorParse': 'Parsing failed. Please refresh and try again',
  'upload.errorRead': 'Failed to read file',
  'upload.loading': 'Loading your memories...',
  'upload.loadingProgress': 'Loading your memories... {{current}}/{{total}} conversations',
  'upload.cacheFound': 'Previous cache found',
  'upload.cacheConvs': '{{n}} conversations',
  'upload.cacheLoad': 'Load Cache',
  'upload.cacheLoading': 'Loading...',
  'upload.cacheCorrupt': 'Cache corrupted. Please re-upload',
  'upload.cacheFail': 'Failed to load cache: ',
  'upload.cacheClear': 'Clear',

  // ConversationList
  'convList.searchPlaceholder': 'Search conversations...',
  'convList.empty': 'No conversations found',
  'convList.unnamed': 'Untitled Conversation',
  'convList.msgCount': ' msgs',
  'convList.hasThinking': 'Has thinking process',
  'convList.hasFlags': 'Has system flags',

  // MessageView
  'msgView.empty': '← Select a conversation to start reading',
  'msgView.unnamed': 'Untitled Conversation',
  'msgView.msgCount': 'messages',
  'msgView.selectMode': 'Select',
  'msgView.viewMode': 'View',
  'msgView.addToCollection': 'Add to Collection',
  'msgView.addedToCollection': 'All Added',
  'msgView.exportThis': 'Export Conversation',
  'msgView.daysLater': 'd later',
  'msgView.hoursLater': 'h later',
  'msgView.unnamed2': 'Untitled',

  // SearchPanel
  'search.title': 'Search Conversations',
  'search.placeholder': 'Search all conversations...',
  'search.startDate': 'From',
  'search.dateSep': 'to',
  'search.endDate': 'To',
  'search.allRoles': 'All Roles',
  'search.humanOnly': 'Human Only',
  'search.aiOnly': 'AI Only',
  'search.allTypes': 'All Types',
  'search.withThinking': 'With Thinking',
  'search.withToolUse': 'With Tool Use',
  'search.withFlags': 'With Flags',
  'search.clearFilters': 'Clear Filters',
  'search.noResults': 'No matches found',
  'search.results': 'Found {{count}} results in {{convs}} conversations',
  'search.resultsLimit': ' (showing first 200)',
  'search.matchCount': ' matches',

  // ExportPanel
  'export.title': 'Export Center',
  'export.format': 'Format:',
  'export.plainText': 'Plain Text',
  'export.includeThinking': 'Thinking',
  'export.includeTools': 'Tools',
  'export.includeFlags': 'Flags',
  'export.bom': 'BOM (Excel)',
  'export.filePrefix': 'Filename prefix:',
  'export.fileSuffix': 'Suffix:',
  'export.optional': 'Optional',
  'export.quickExport': 'Quick Export',
  'export.exportAll': '🔖 Export All',
  'export.exportAllCount': '{{n}} conversations',
  'export.exportZip': '🔖 Batch Export ZIP',
  'export.exportZipDesc': '{{n}} conversations, one file each',
  'export.exportFiltered': '🔍 Export Filtered Results',
  'export.perConv': 'Per Conversation ({{n}})',
  'export.exportBtn': 'Export',
  'export.msgCount': ' messages',
  'export.collection': 'Collection ({{n}})',
  'export.exportCollection': 'Export Collection',
  'export.clearCollection': 'Clear',
  'export.collectionEmpty': 'Collection is empty. Select messages in conversations and click "+Collect" to add here.',

  // StatsPanel
  'stats.title': 'Data Sculpture',
  'stats.saveImage': ' Save as Image',
  'stats.saving': 'Capturing...',
  'stats.imageSaved': '✓ Saved',
  'stats.totalConvs': 'Conversations',
  'stats.totalMsgs': 'Messages',
  'stats.thinkingCount': 'Thinking',
  'stats.thinkingTime': 'Think Time',
  'stats.wordCount': '\'s Words',
  'stats.timeSpan': 'Time Span',
  'stats.longestStreak': 'Longest Streak',
  'stats.flagCount': 'Flags',
  'stats.lateNight': 'Late Night',
  'stats.firstConv': 'First Conversation',
  'stats.latestConv': 'Latest Conversation',
  'stats.yearOverview': 'Yearly Overview',
  'stats.year': '',
  'stats.yearConvs': 'Convs',
  'stats.yearMsgs': 'Msgs',
  'stats.yearWords': 'Words',
  'stats.yearDays': 'Active Days',
  'stats.yearThinking': 'Thinking',
  'stats.heatmap': 'Time Matrix',
  'stats.top5': 'TOP 5 Longest Conversations',
  'stats.top5msgs': ' msgs / ',
  'stats.top5chars': ' chars',
  'stats.lateNightRank': 'Late Night Sessions (2-5 AM)',
  'stats.rhythm': 'Interaction Rhythm',

  // Loading captions
  'loading.bubbles': 'Blowing bubbles...',
  'loading.celebrate': 'Celebrating...',
  'loading.idea': 'Having ideas...',
  'loading.love': 'Feeling loved...',
  'loading.music': 'Listening...',
  'loading.repair': 'Fixing things...',
  'loading.thinking': 'Thinking...',
  'loading.watch': 'Checking time...',

  // Export file content
  'exportFile.unnamed': 'Untitled Conversation',
  'exportFile.msgCount': ' messages',
  'exportFile.thinkingStart': '--- Thinking',
  'exportFile.thinkingEnd': '--- End Thinking ---',
  'exportFile.toolUse': 'Tool Call: ',
  'exportFile.toolInput': 'Input: ',
  'exportFile.toolResult': 'Result: ',
  'exportFile.flag': 'Flag: ',
  'exportFile.attachment': 'Attachments: ',
  'exportFile.mdThinking': '> 💭 **Thinking**',
  'exportFile.mdTool': '> 🔧 **Tool: ',
  'exportFile.mdFlag': '> ⚠️ **Flag: ',
  'exportFile.mdAttachment': '📎 Attachments: ',

  // Time
  'time.unknown': 'Unknown',
  'time.unknownDate': 'Unknown',
  'time.yearMonth': '{{year}}-{{month}}',
};

const dictionaries = { zh, en };

/**
 * Translate a key. Supports {{var}} interpolation.
 * @param {string} key - dot-separated key like 'sidebar.title'
 * @param {Object} [vars] - interpolation variables
 * @returns {string}
 */
export function t(key, vars) {
  const lang = state.get('lang') || 'zh';
  const dict = dictionaries[lang] || zh;
  let str = dict[key] ?? zh[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
  }
  return str;
}

/**
 * Get current language code
 */
export function getLang() {
  return state.get('lang') || 'zh';
}
