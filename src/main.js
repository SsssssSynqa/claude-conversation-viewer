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
import { showLoading, hideLoading } from './components/Loading.js';

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

  // Sidebar title with spark logo — generous top padding
  const sidebarTitle = document.createElement('div');
  sidebarTitle.style.cssText = 'padding:24px 20px 16px;display:flex;align-items:center;gap:6px;';
  sidebarTitle.appendChild(createSparkIcon(14));
  const titleText = document.createElement('span');
  titleText.style.cssText = 'font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text-primary);';
  titleText.textContent = 'Claude 对话记忆查看器';
  sidebarTitle.appendChild(titleText);
  sidebar.appendChild(sidebarTitle);

  // Sidebar function buttons — neumorphic pills
  const sidebarActions = document.createElement('div');
  sidebarActions.className = 'sidebar-actions';
  sidebarActions.style.cssText = 'padding:4px 16px 12px;display:flex;flex-direction:column;gap:6px;';

  // Nav pills: Search, Stats, Export
  const navItems = [
    { id: 'sidebar-search-btn', icon: 'search', label: '搜索中心', action: () => state.set('viewMode', 'search') },
    { id: 'sidebar-stats-btn', icon: 'stats', label: '统计总览', action: () => { state.set('viewMode', 'conversation'); state.set('currentConversationIndex', -1); } },
    { id: 'sidebar-export-btn', icon: 'export', label: '导出中心', action: () => state.set('viewMode', 'export') },
  ];

  for (const nav of navItems) {
    const pill = document.createElement('div');
    pill.className = 'sidebar-pill pill-flat';
    pill.id = nav.id;
    const iconWrap = document.createElement('span');
    iconWrap.className = 'nav-icon';
    iconWrap.appendChild(createIcon(nav.icon, 16));
    pill.appendChild(iconWrap);
    const labelSpan = document.createElement('span');
    labelSpan.textContent = nav.label;
    pill.appendChild(labelSpan);
    pill.addEventListener('click', nav.action);
    sidebarActions.appendChild(pill);
  }

  // Theme toggle track (3-way: sun / moon / flower)
  const themeTrackRow = document.createElement('div');
  themeTrackRow.className = 'pill-row';
  themeTrackRow.style.cssText += 'padding:4px 0;justify-content:stretch;';

  const themeTrack = document.createElement('div');
  themeTrack.className = 'sidebar-pill toggle-track track-3';
  themeTrack.id = 'sidebar-theme-track';

  const themeThumb = document.createElement('div');
  themeThumb.className = 'toggle-thumb';
  themeTrack.appendChild(themeThumb);

  const themeOptions = [
    { theme: 'light', icon: 'sun' },
    { theme: 'dark', icon: 'moon' },
    { theme: 'claude', icon: 'spark' },
  ];

  const currentTheme = state.get('theme');
  const currentIdx = themeOptions.findIndex(o => o.theme === currentTheme);
  // Set initial thumb position
  if (currentIdx >= 0) {
    themeThumb.style.transform = `translateX(${currentIdx * 100}%)`;
  }

  for (let i = 0; i < themeOptions.length; i++) {
    const opt = themeOptions[i];
    const optDiv = document.createElement('div');
    optDiv.className = 'toggle-option' + (opt.theme === currentTheme ? ' active' : '');
    optDiv.dataset.theme = opt.theme;
    const optIcon = opt.icon === 'spark' ? createSparkIcon(14, true) : createIcon(opt.icon, 16);
    optDiv.appendChild(optIcon);
    optDiv.addEventListener('click', () => {
      state.set('theme', opt.theme);
    });
    themeTrack.appendChild(optDiv);
  }

  themeTrackRow.appendChild(themeTrack);
  // themeTrackRow will be appended later, after foldables

  // Theme state listener — update track thumb + active option + re-render stats
  state.on('theme', (t) => {
    const track = document.getElementById('sidebar-theme-track');
    if (track) {
      const idx = themeOptions.findIndex(o => o.theme === t);
      const thumb = track.querySelector('.toggle-thumb');
      if (thumb && idx >= 0) thumb.style.transform = `translateX(${idx * 100}%)`;
      track.querySelectorAll('.toggle-option').forEach(el => {
        el.classList.toggle('active', el.dataset.theme === t);
      });
    }
    // Re-render stats panel so ring charts pick up new theme shadows
    if (messageView && state.get('viewMode') === 'conversation' && !state.get('selectedConversation')) {
      const c = messageView.container;
      const overlay = showLoading(c);
      Array.from(c.children).forEach(ch => { if (ch !== overlay) ch.remove(); });
      setTimeout(() => {
        messageView.statsPanel.renderInline(c);
        hideLoading(overlay);
      }, 500);
    }
  });

  // ---- Foldable: Display Settings ----
  const settingsFoldable = document.createElement('details');
  settingsFoldable.className = 'sidebar-foldable';

  const settingsSummary = document.createElement('summary');
  const settingsPill = document.createElement('div');
  settingsPill.className = 'sidebar-pill pill-flat';
  const settingsIcon = document.createElement('span');
  settingsIcon.className = 'nav-icon';
  settingsIcon.appendChild(createIcon('shield', 16));
  settingsPill.appendChild(settingsIcon);
  const settingsLabel = document.createElement('span');
  settingsLabel.textContent = '显示设置';
  settingsPill.appendChild(settingsLabel);
  const settingsChevron = document.createElement('span');
  settingsChevron.className = 'chevron-icon nav-icon';
  settingsChevron.appendChild(createIcon('chevronDown', 14));
  settingsPill.appendChild(settingsChevron);
  settingsSummary.appendChild(settingsPill);
  settingsFoldable.appendChild(settingsSummary);

  const settingsContent = document.createElement('div');
  settingsContent.className = 'fold-content';

  const toggles = [
    { id: 'toggle-thinking', label: '思考过程', key: 'showThinking' },
    { id: 'toggle-tools', label: '工具调用', key: 'showToolUse' },
    { id: 'toggle-flags', label: '系统标记', key: 'showFlags' },
    { id: 'toggle-desensitize', label: '数据脱敏', key: 'desensitize' },
  ];

  for (const t of toggles) {
    const row = document.createElement('div');
    row.className = 'sidebar-toggle-row';

    const labelText = document.createElement('span');
    labelText.className = 'sidebar-toggle-label';
    labelText.textContent = t.label;
    row.appendChild(labelText);

    // Neumorphic switch
    const neuSwitch = document.createElement('div');
    neuSwitch.className = 'neu-switch' + (state.get(t.key) ? ' active' : '');
    const handle = document.createElement('div');
    handle.className = 'switch-handle';
    neuSwitch.appendChild(handle);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = t.id;
    input.checked = state.get(t.key);
    input.style.display = 'none';
    input.addEventListener('change', (e) => state.set(t.key, e.target.checked));

    neuSwitch.addEventListener('click', () => {
      input.checked = !input.checked;
      input.dispatchEvent(new Event('change'));
      neuSwitch.classList.toggle('active', input.checked);
    });

    row.appendChild(neuSwitch);
    row.appendChild(input);
    settingsContent.appendChild(row);
  }

  // Desensitize word input (shown when desensitize is on)
  const desensitizeSection = document.createElement('div');
  desensitizeSection.id = 'desensitize-section';
  desensitizeSection.style.cssText = 'display:' + (state.get('desensitize') ? 'flex' : 'none') + ';flex-direction:column;gap:4px;';

  const dsInput = document.createElement('input');
  dsInput.type = 'text';
  dsInput.className = 'neu-input';
  dsInput.placeholder = '敏感词，逗号分隔';
  dsInput.value = (state.get('desensitizeWords') || []).join(', ');
  dsInput.addEventListener('input', () => {
    const words = dsInput.value.split(/[,，]/).map(w => w.trim()).filter(Boolean);
    state.set('desensitizeWords', words);
    saveDesensitizeWords(words);
  });
  desensitizeSection.appendChild(dsInput);

  const dsHint = document.createElement('div');
  dsHint.style.cssText = 'font-size:11px;color:var(--text-muted);padding:0 2px;';
  dsHint.textContent = '这些词会被替换为 ***';
  desensitizeSection.appendChild(dsHint);

  settingsContent.appendChild(desensitizeSection);

  state.on('desensitize', (val) => {
    const sec = document.getElementById('desensitize-section');
    if (sec) sec.style.display = val ? 'flex' : 'none';
  });

  settingsFoldable.appendChild(settingsContent);
  sidebarActions.appendChild(settingsFoldable);

  // ---- Foldable: Display Name ----
  const nameFoldable = document.createElement('details');
  nameFoldable.className = 'sidebar-foldable';

  const nameSummary = document.createElement('summary');
  const namePill = document.createElement('div');
  namePill.className = 'sidebar-pill pill-flat';
  const nameIcon = document.createElement('span');
  nameIcon.className = 'nav-icon';
  nameIcon.appendChild(createIcon('user', 16));
  namePill.appendChild(nameIcon);
  const nameLabel = document.createElement('span');
  nameLabel.textContent = '显示名称';
  namePill.appendChild(nameLabel);
  const nameChevron = document.createElement('span');
  nameChevron.className = 'chevron-icon nav-icon';
  nameChevron.appendChild(createIcon('chevronDown', 14));
  namePill.appendChild(nameChevron);
  nameSummary.appendChild(namePill);
  nameFoldable.appendChild(nameSummary);

  const nameContent = document.createElement('div');
  nameContent.className = 'fold-content';

  const names = state.get('displayNames');

  // Human name row
  const humanRow = document.createElement('div');
  humanRow.className = 'sidebar-name-row';
  const humanLabel = document.createElement('span');
  humanLabel.className = 'sidebar-name-label';
  humanLabel.textContent = '用户';
  humanRow.appendChild(humanLabel);
  const humanInput = document.createElement('input');
  humanInput.type = 'text';
  humanInput.id = 'sidebar-name-human';
  humanInput.className = 'neu-input';
  humanInput.value = names.human;
  humanRow.appendChild(humanInput);
  nameContent.appendChild(humanRow);

  // Assistant name row
  const assistantRow = document.createElement('div');
  assistantRow.className = 'sidebar-name-row';
  const assistantLabel = document.createElement('span');
  assistantLabel.className = 'sidebar-name-label';
  assistantLabel.textContent = 'AI';
  assistantRow.appendChild(assistantLabel);
  const assistantInput = document.createElement('input');
  assistantInput.type = 'text';
  assistantInput.id = 'sidebar-name-assistant';
  assistantInput.className = 'neu-input';
  assistantInput.value = names.assistant;
  assistantRow.appendChild(assistantInput);
  nameContent.appendChild(assistantRow);

  // Save / Reset buttons
  const nameBtnRow = document.createElement('div');
  nameBtnRow.style.cssText = 'display:flex;gap:8px;';

  const saveNameBtn = document.createElement('button');
  saveNameBtn.className = 'sidebar-name-btn primary';
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
  resetNameBtn.className = 'sidebar-name-btn secondary';
  resetNameBtn.textContent = '重置';
  resetNameBtn.addEventListener('click', () => {
    const defaults = { human: 'Synqa', assistant: 'Sylux' };
    document.getElementById('sidebar-name-human').value = defaults.human;
    document.getElementById('sidebar-name-assistant').value = defaults.assistant;
    state.set('displayNames', defaults);
    localStorage.setItem('cv-names', JSON.stringify(defaults));
  });
  nameBtnRow.appendChild(resetNameBtn);
  nameContent.appendChild(nameBtnRow);

  nameFoldable.appendChild(nameContent);
  sidebarActions.appendChild(nameFoldable);

  // Language toggle (中文 / EN)
  const langTrack = document.createElement('div');
  langTrack.className = 'sidebar-pill toggle-track track-2';
  langTrack.id = 'sidebar-lang-track';
  const langThumb = document.createElement('div');
  langThumb.className = 'toggle-thumb';
  langTrack.appendChild(langThumb);
  const langOptions = [
    { lang: 'zh', label: '中文' },
    { lang: 'en', label: 'EN' },
  ];
  const currentLang = state.get('lang') || 'zh';
  const langIdx = langOptions.findIndex(o => o.lang === currentLang);
  if (langIdx > 0) langThumb.style.transform = `translateX(${langIdx * 100}%)`;
  for (let i = 0; i < langOptions.length; i++) {
    const lo = langOptions[i];
    const loDiv = document.createElement('div');
    loDiv.className = 'toggle-option' + (lo.lang === currentLang ? ' active' : '');
    loDiv.dataset.lang = lo.lang;
    loDiv.style.cssText = 'font-weight:700;letter-spacing:0.5px;font-size:13px;';
    loDiv.textContent = lo.label;
    loDiv.addEventListener('click', () => {
      state.set('lang', lo.lang);
      const lt = document.getElementById('sidebar-lang-track');
      if (lt) {
        const li = langOptions.findIndex(o => o.lang === lo.lang);
        const lth = lt.querySelector('.toggle-thumb');
        if (lth && li >= 0) lth.style.transform = `translateX(${li * 100}%)`;
        lt.querySelectorAll('.toggle-option').forEach(el => {
          el.classList.toggle('active', el.dataset.lang === lo.lang);
        });
      }
    });
    langTrack.appendChild(loDiv);
  }
  themeTrackRow.appendChild(langTrack);

  // Append toggle row (theme + lang) after foldables, before search
  sidebarActions.appendChild(themeTrackRow);

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

    // Update sidebar pill button active states
    const allBtns = ['sidebar-search-btn', 'sidebar-export-btn', 'sidebar-stats-btn'];
    const activeMap = { search: 'sidebar-search-btn', export: 'sidebar-export-btn', conversation: 'sidebar-stats-btn' };
    for (const id of allBtns) {
      const el = document.getElementById(id);
      if (!el) continue;
      const isActive = activeMap[mode] === id;
      el.classList.remove('pill-flat', 'pill-active');
      el.classList.add(isActive ? 'pill-active' : 'pill-flat');
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


// ---- Init ----
state.on('conversations', (conversations) => {
  if (conversations.length > 0 && state.get('loading') === false) {
    state.set('filteredConversations', conversations);
    renderMainView();
  }
});

renderUploadScreen();
