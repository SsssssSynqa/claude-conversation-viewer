/**
 * Claude Conversation Viewer V2 — Main Entry
 */

import './themes/variables.css';
import './styles/base.css';
import './styles/components.css';
import './styles/clawd.css';
import { state } from './store/state.js';
import { FileUpload } from './components/FileUpload.js';
import { ConversationList } from './components/ConversationList.js';
import { MessageView } from './components/MessageView.js';
import { StatsPanel } from './components/StatsPanel.js';
import { ExportDialog } from './components/ExportDialog.js';
import { SearchBar } from './components/SearchBar.js';

// ---- Theme ----
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('cv-theme', theme);
}

const THEMES = ['dark', 'light', 'claude'];
const THEME_ICONS = { dark: '\u{1F319}', light: '\u{2600}\u{FE0F}', claude: '\u{1F3F5}\u{FE0F}' };
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
let fileUpload, conversationList, messageView;

function renderUploadScreen() {
  app.textContent = '';
  fileUpload = new FileUpload(app);
}

function renderMainView() {
  app.textContent = '';

  // Toolbar — simplified, just title + search
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';

  const title = document.createElement('span');
  title.className = 'toolbar-title';
  title.textContent = 'Claude 对话记忆查看器';
  toolbar.appendChild(title);

  // Search bar (in toolbar)
  const searchWrapper = document.createElement('div');
  searchWrapper.style.cssText = 'flex:1;display:flex;gap:8px;align-items:center;margin:0 16px;';
  const searchBar = new SearchBar(searchWrapper);
  toolbar.appendChild(searchWrapper);

  app.appendChild(toolbar);

  // Main layout
  const layout = document.createElement('div');
  layout.className = 'main-layout';

  // ---- Sidebar ----
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';

  // Sidebar top: function buttons
  const sidebarActions = document.createElement('div');
  sidebarActions.className = 'sidebar-actions';
  sidebarActions.style.cssText = 'padding:12px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:4px;';

  // Stats button — go back to homepage stats
  const statsBtn = createSidebarBtn('\uD83D\uDCCA', '统计总览', () => {
    state.set('currentConversationIndex', -1);
  });
  sidebarActions.appendChild(statsBtn);

  // Export button
  const exportBtn = createSidebarBtn('\uD83D\uDCE5', '导出对话', () => {
    const dlg = new ExportDialog();
    dlg.show();
  });
  sidebarActions.appendChild(exportBtn);

  // Theme switcher
  const themeBtn = createSidebarBtn(
    THEME_ICONS[state.get('theme')] || '\u{1F319}',
    THEME_LABELS[state.get('theme')] || '主题',
    cycleTheme
  );
  themeBtn.id = 'sidebar-theme-btn';
  sidebarActions.appendChild(themeBtn);

  state.on('theme', (t) => {
    const btn = document.getElementById('sidebar-theme-btn');
    if (btn) {
      btn.querySelector('.sidebar-btn-icon').textContent = THEME_ICONS[t] || '\u{1F319}';
      btn.querySelector('.sidebar-btn-label').textContent = THEME_LABELS[t] || '主题';
    }
  });

  // Settings section (display toggles + name config)
  const settingsSection = document.createElement('div');
  settingsSection.style.cssText = 'padding:12px;border-bottom:1px solid var(--border);';

  const settingsTitle = document.createElement('div');
  settingsTitle.style.cssText = 'font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:8px;font-weight:600;';
  settingsTitle.textContent = '显示设置';
  settingsSection.appendChild(settingsTitle);

  const toggles = [
    { id: 'toggle-thinking', label: '思考过程', key: 'showThinking' },
    { id: 'toggle-tools', label: '工具调用', key: 'showToolUse' },
    { id: 'toggle-flags', label: '系统标记', key: 'showFlags' },
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
}

function createSidebarBtn(icon, label, onClick) {
  const btn = document.createElement('button');
  btn.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:none;border-radius:var(--radius-sm);background:transparent;color:var(--sidebar-text);cursor:pointer;font-size:0.85rem;text-align:left;transition:background 0.15s;';
  btn.addEventListener('mouseenter', () => btn.style.background = 'var(--sidebar-hover)');
  btn.addEventListener('mouseleave', () => btn.style.background = '');

  const iconSpan = document.createElement('span');
  iconSpan.className = 'sidebar-btn-icon';
  iconSpan.style.cssText = 'font-size:1rem;width:20px;text-align:center;';
  iconSpan.textContent = icon;
  btn.appendChild(iconSpan);

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
