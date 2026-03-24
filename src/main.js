/**
 * Claude Conversation Viewer V2 — Main Entry
 */

import './themes/variables.css';
import './styles/base.css';
import './styles/components.css';
import './styles/clawd.css';
import { state, saveDesensitizeWords } from './store/state.js';
import { FileUpload } from './components/FileUpload.js';
import { ConversationList } from './components/ConversationList.js';
import { MessageView } from './components/MessageView.js';
import { StatsPanel } from './components/StatsPanel.js';
import { ExportPanel } from './components/ExportPanel.js';
import { SearchPanel } from './components/SearchPanel.js';
import { createIcon } from './utils/icons.js';
import { createSparkIcon } from './utils/spark.js';

// ---- Theme ----
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('cv-theme', theme);
}

const THEMES = ['dark', 'light', 'claude'];
const THEME_ICON_NAMES = { dark: 'moon', light: 'sun', claude: 'flower' };
const THEME_LABELS = { dark: '关灯版', light: '开灯版', claude: '怀旧版' };

function cycleTheme() {
  const current = state.get('theme');
  const idx = THEMES.indexOf(current);
  const next = THEMES[(idx + 1) % THEMES.length];
  state.set('theme', next);
}

state.on('theme', applyTheme);
applyTheme(state.get('theme'));

// ---- App ----
const app = document.getElementById('app');
let fileUpload, conversationList, messageView, searchPanel, exportPanel;

function renderUploadScreen() {
  app.textContent = '';
  fileUpload = new FileUpload(app);
}

function renderMainView() {
  app.textContent = '';
  searchPanel = new SearchPanel();
  exportPanel = new ExportPanel();

  // Main layout — no top toolbar, title in sidebar
  const layout = document.createElement('div');
  layout.className = 'main-layout';

  // ---- Sidebar ----
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';

  // Sidebar title with spark logo
  const sidebarTitle = document.createElement('div');
  sidebarTitle.style.cssText = 'padding:14px 14px 10px;display:flex;align-items:center;gap:6px;';
  sidebarTitle.appendChild(createSparkIcon(14));
  const titleText = document.createElement('span');
  titleText.style.cssText = 'font-family:var(--font-display);font-size:14px;font-weight:400;color:var(--text-primary);';
  titleText.textContent = 'Claude 对话记忆查看器';
  sidebarTitle.appendChild(titleText);
  sidebar.appendChild(sidebarTitle);

  // Sidebar function buttons
  const sidebarActions = document.createElement('div');
  sidebarActions.className = 'sidebar-actions';
  sidebarActions.style.cssText = 'padding:4px 8px 8px;display:flex;flex-direction:column;gap:2px;';

  // Search button — opens search panel in content area
  const searchBtn = createSidebarBtn('search', '搜索', () => {
    state.set('viewMode', 'search');
  });
  searchBtn.id = 'sidebar-search-btn';
  sidebarActions.appendChild(searchBtn);

  // Stats button — go back to homepage stats
  const statsBtn = createSidebarBtn('stats', '统计总览', () => {
    state.set('viewMode', 'conversation');
    state.set('currentConversationIndex', -1);
  });
  statsBtn.id = 'sidebar-stats-btn';
  sidebarActions.appendChild(statsBtn);

  // Export button — opens export panel
  const exportBtn = createSidebarBtn('export', '导出中心', () => {
    state.set('viewMode', 'export');
  });
  exportBtn.id = 'sidebar-export-btn';
  sidebarActions.appendChild(exportBtn);

  // Theme switcher
  const themeBtn = createSidebarBtn(
    THEME_ICON_NAMES[state.get('theme')] || 'moon',
    THEME_LABELS[state.get('theme')] || '主题',
    cycleTheme
  );
  themeBtn.id = 'sidebar-theme-btn';
  sidebarActions.appendChild(themeBtn);

  state.on('theme', (t) => {
    const btn = document.getElementById('sidebar-theme-btn');
    if (btn) {
      const oldIcon = btn.querySelector('.sidebar-btn-icon');
      const newIcon = createIcon(THEME_ICON_NAMES[t] || 'moon', 18);
      newIcon.className = 'sidebar-btn-icon';
      newIcon.style.cssText += 'color:var(--text-muted);';
      if (oldIcon) oldIcon.replaceWith(newIcon);
      btn.querySelector('.sidebar-btn-label').textContent = THEME_LABELS[t] || '主题';
    }
  });

  // Settings section (display toggles + name config)
  const settingsSection = document.createElement('div');
  settingsSection.style.cssText = 'padding:8px 14px 12px;border-top:1px solid var(--border);margin-top:4px;';

  const settingsTitle = document.createElement('div');
  settingsTitle.style.cssText = 'font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:8px;font-weight:600;';
  settingsTitle.textContent = '显示设置';
  settingsSection.appendChild(settingsTitle);

  const toggles = [
    { id: 'toggle-thinking', label: '思考过程', key: 'showThinking' },
    { id: 'toggle-tools', label: '工具调用', key: 'showToolUse' },
    { id: 'toggle-flags', label: '系统标记', key: 'showFlags' },
    { id: 'toggle-desensitize', label: '数据脱敏', key: 'desensitize' },
  ];

  for (const t of toggles) {
    const labelEl = document.createElement('label');
    labelEl.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;color:var(--sidebar-text);font-size:0.82rem;padding:3px 0;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = t.id;
    input.checked = state.get(t.key);
    input.style.accentColor = 'var(--accent)';
    input.addEventListener('change', (e) => state.set(t.key, e.target.checked));
    labelEl.appendChild(input);
    labelEl.appendChild(document.createTextNode(t.label));
    settingsSection.appendChild(labelEl);
  }

  // Desensitize word input (shown when desensitize is on)
  const desensitizeSection = document.createElement('div');
  desensitizeSection.id = 'desensitize-section';
  desensitizeSection.style.cssText = 'margin-top:6px;display:' + (state.get('desensitize') ? 'block' : 'none') + ';';

  const dsInput = document.createElement('input');
  dsInput.type = 'text';
  dsInput.placeholder = '输入敏感词，逗号分隔';
  dsInput.value = (state.get('desensitizeWords') || []).join(', ');
  dsInput.style.cssText = 'width:100%;padding:4px 8px;background:var(--bg-input);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:0.75rem;font-family:var(--font-family);';
  dsInput.addEventListener('input', () => {
    const words = dsInput.value.split(/[,，]/).map(w => w.trim()).filter(Boolean);
    state.set('desensitizeWords', words);
    saveDesensitizeWords(words);
  });
  desensitizeSection.appendChild(dsInput);

  const dsHint = document.createElement('div');
  dsHint.style.cssText = 'font-size:0.65rem;color:var(--text-muted);margin-top:2px;';
  dsHint.textContent = '开启后，这些词会在界面和导出中被替换为 ***';
  desensitizeSection.appendChild(dsHint);

  settingsSection.appendChild(desensitizeSection);

  state.on('desensitize', (val) => {
    const sec = document.getElementById('desensitize-section');
    if (sec) sec.style.display = val ? 'block' : 'none';
  });

  // Name config in sidebar
  const nameSection = document.createElement('div');
  nameSection.style.cssText = 'margin-top:10px;';

  const nameTitle = document.createElement('div');
  nameTitle.style.cssText = 'font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:6px;font-weight:600;';
  nameTitle.textContent = '显示名称';
  nameSection.appendChild(nameTitle);

  const names = state.get('displayNames');

  const humanInput = createSidebarNameInput('用户', names.human, 'sidebar-name-human');
  const assistantInput = createSidebarNameInput('AI', names.assistant, 'sidebar-name-assistant');
  nameSection.appendChild(humanInput);
  nameSection.appendChild(assistantInput);

  const nameBtnRow = document.createElement('div');
  nameBtnRow.style.cssText = 'display:flex;gap:6px;margin-top:6px;';

  const saveNameBtn = document.createElement('button');
  saveNameBtn.style.cssText = 'flex:1;padding:5px 8px;border:none;border-radius:4px;background:var(--accent);color:#fff;cursor:pointer;font-size:0.75rem;font-weight:600;';
  saveNameBtn.textContent = '保存';
  saveNameBtn.addEventListener('click', () => {
    const humanVal = document.getElementById('sidebar-name-human')?.value || 'Synqa';
    const assistantVal = document.getElementById('sidebar-name-assistant')?.value || 'Sylux';
    const newNames = { human: humanVal, assistant: assistantVal };
    state.set('displayNames', newNames);
    localStorage.setItem('cv-names', JSON.stringify(newNames));
    saveNameBtn.textContent = '\u2713';
    setTimeout(() => { saveNameBtn.textContent = '保存'; }, 1200);
  });
  nameBtnRow.appendChild(saveNameBtn);

  const resetNameBtn = document.createElement('button');
  resetNameBtn.style.cssText = 'padding:5px 8px;border:1px solid var(--border);border-radius:4px;background:transparent;color:var(--sidebar-text);cursor:pointer;font-size:0.75rem;';
  resetNameBtn.textContent = '重置';
  resetNameBtn.addEventListener('click', () => {
    const defaults = { human: 'Synqa', assistant: 'Sylux' };
    document.getElementById('sidebar-name-human').value = defaults.human;
    document.getElementById('sidebar-name-assistant').value = defaults.assistant;
    state.set('displayNames', defaults);
    localStorage.setItem('cv-names', JSON.stringify(defaults));
  });
  nameBtnRow.appendChild(resetNameBtn);
  nameSection.appendChild(nameBtnRow);

  settingsSection.appendChild(nameSection);
  sidebarActions.appendChild(settingsSection);
  sidebar.appendChild(sidebarActions);

  // Content area
  const contentArea = document.createElement('div');
  contentArea.className = 'content-area';
  contentArea.id = 'content-area';

  layout.appendChild(sidebar);
  layout.appendChild(contentArea);
  app.appendChild(layout);

  // Components
  conversationList = new ConversationList(sidebar);
  messageView = new MessageView(contentArea);

  // ---- View Mode switching ----
  state.on('viewMode', (mode) => {
    const area = document.getElementById('content-area');
    if (!area) return;

    // Update sidebar button active states
    const allBtns = ['sidebar-search-btn', 'sidebar-export-btn', 'sidebar-stats-btn'];
    const activeMap = { search: 'sidebar-search-btn', export: 'sidebar-export-btn', conversation: null };
    for (const id of allBtns) {
      const el = document.getElementById(id);
      if (!el) continue;
      const isActive = activeMap[mode] === id;
      el.style.background = isActive ? 'var(--sidebar-active)' : 'transparent';
      el.style.color = isActive ? 'var(--accent)' : 'var(--sidebar-text)';
      el.style.fontWeight = isActive ? '600' : '';
    }

    if (mode === 'search') {
      searchPanel.render(area);
    } else if (mode === 'export') {
      exportPanel.render(area);
    } else {
      // Re-render current conversation or stats
      messageView = new MessageView(area);
    }
  });
}

function createSidebarBtn(iconName, label, onClick) {
  const btn = document.createElement('button');
  btn.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:none;border-radius:var(--radius-sm);background:transparent;color:var(--sidebar-text);cursor:pointer;font-size:0.85rem;text-align:left;transition:background var(--transition-fast),color var(--transition-fast);';
  btn.addEventListener('mouseenter', () => {
    if (btn.dataset.active !== 'true') btn.style.background = 'var(--sidebar-hover)';
  });
  btn.addEventListener('mouseleave', () => {
    if (btn.dataset.active !== 'true') btn.style.background = '';
  });

  const iconEl = createIcon(iconName, 18);
  iconEl.className = 'sidebar-btn-icon';
  iconEl.style.cssText += 'color:var(--text-muted);';
  btn.appendChild(iconEl);

  const labelSpan = document.createElement('span');
  labelSpan.className = 'sidebar-btn-label';
  labelSpan.textContent = label;
  btn.appendChild(labelSpan);

  btn.addEventListener('click', onClick);
  return btn;
}

function createSidebarNameInput(label, defaultValue, id) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;';

  const labelEl = document.createElement('span');
  labelEl.style.cssText = 'font-size:0.75rem;color:var(--text-muted);width:28px;flex-shrink:0;';
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const input = document.createElement('input');
  input.type = 'text';
  input.id = id;
  input.value = defaultValue;
  input.style.cssText = 'flex:1;padding:4px 8px;background:var(--bg-input);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:0.8rem;font-family:var(--font-family);';
  row.appendChild(input);

  return row;
}

// ---- Init ----
state.on('conversations', (conversations) => {
  if (conversations.length > 0 && state.get('loading') === false) {
    state.set('filteredConversations', conversations);
    renderMainView();
  }
});

renderUploadScreen();
