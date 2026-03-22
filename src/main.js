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

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';

  const title = document.createElement('span');
  title.className = 'toolbar-title';
  title.textContent = 'Claude 对话记忆查看器';
  toolbar.appendChild(title);

  const spacer = document.createElement('div');
  spacer.className = 'toolbar-spacer';
  toolbar.appendChild(spacer);

  // Settings toggles
  const settingsBtn = createToolbarBtn('\u2699\uFE0F', '设置', () => toggleSettings());
  toolbar.appendChild(settingsBtn);

  const statsBtn = createToolbarBtn('\uD83D\uDCCA', '统计', () => {
    // TODO: stats panel
  });
  toolbar.appendChild(statsBtn);

  const exportBtn = createToolbarBtn('\uD83D\uDCE5', '导出', () => {
    const dlg = new ExportDialog();
    dlg.show();
  });
  toolbar.appendChild(exportBtn);

  const themeBtn = createToolbarBtn(
    THEME_ICONS[state.get('theme')] || '\u{1F319}',
    THEME_LABELS[state.get('theme')] || '主题',
    cycleTheme
  );
  themeBtn.id = 'theme-btn';
  toolbar.appendChild(themeBtn);

  state.on('theme', (t) => {
    const btn = document.getElementById('theme-btn');
    if (btn) {
      btn.textContent = THEME_ICONS[t] || '\u{1F319}';
      btn.title = THEME_LABELS[t] || '主题';
    }
  });

  app.appendChild(toolbar);

  // Settings dropdown (hidden by default) — safe static content only
  const settingsPanel = document.createElement('div');
  settingsPanel.id = 'settings-panel';
  settingsPanel.className = 'settings-panel hidden';

  const toggles = [
    { id: 'toggle-thinking', label: '显示思考过程', key: 'showThinking' },
    { id: 'toggle-tools', label: '显示工具调用', key: 'showToolUse' },
    { id: 'toggle-flags', label: '显示系统标记', key: 'showFlags' },
  ];

  for (const t of toggles) {
    const labelEl = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = t.id;
    input.checked = state.get(t.key);
    input.addEventListener('change', (e) => state.set(t.key, e.target.checked));
    labelEl.appendChild(input);
    labelEl.appendChild(document.createTextNode(' ' + t.label));
    settingsPanel.appendChild(labelEl);
  }

  app.appendChild(settingsPanel);

  // Main layout
  const layout = document.createElement('div');
  layout.className = 'main-layout';

  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';

  const contentArea = document.createElement('div');
  contentArea.className = 'content-area';
  contentArea.id = 'content-area';

  layout.appendChild(sidebar);
  layout.appendChild(contentArea);
  app.appendChild(layout);

  conversationList = new ConversationList(sidebar);
  messageView = new MessageView(contentArea);
}

function createToolbarBtn(icon, titleText, onClick) {
  const btn = document.createElement('button');
  btn.className = 'toolbar-btn';
  btn.textContent = icon;
  btn.title = titleText;
  btn.addEventListener('click', onClick);
  return btn;
}

function toggleSettings() {
  const panel = document.getElementById('settings-panel');
  if (panel) panel.classList.toggle('hidden');
}

// ---- Init ----
state.on('conversations', (conversations) => {
  if (conversations.length > 0 && state.get('loading') === false) {
    state.set('filteredConversations', conversations);
    renderMainView();
  }
});

renderUploadScreen();
