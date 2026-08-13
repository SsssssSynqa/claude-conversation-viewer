/**
 * Claude Conversation Viewer V2 — Main Entry
 */

import './themes/variables.css';
import './styles/base.css';
import './styles/components.css';
import './styles/clawd.css';
import './styles/tactile.css';
import './styles/responsive.css';
import { state, saveDesensitizeWords, saveExportCollection, resetSidebarFilter } from './store/state.js';
import { FileUpload } from './components/FileUpload.js';
import { ConversationList } from './components/ConversationList.js';
import { MessageView } from './components/MessageView.js';
import { StatsPanel } from './components/StatsPanel.js';
import { ExportPanel } from './components/ExportPanel.js';
import { SearchPanel } from './components/SearchPanel.js';
import { createIcon } from './utils/icons.js';
import { createSparkIcon } from './utils/spark.js';
import { showLoading, hideLoading } from './components/Loading.js';
import { t } from './i18n.js';
import logoEn from './assets/logo-en.png';
import logoZh from './assets/logo-zh.png';
import logoEnDark from './assets/logo-en-dark.png';
import logoZhDark from './assets/logo-zh-dark.png';

// ---- Page title ----
document.title = t('page.title');
document.documentElement.lang = (state.get('lang') || 'zh') === 'en' ? 'en' : 'zh-CN';

// ---- Theme ----
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('cv-theme', theme);
}

const THEMES = ['dark', 'light', 'claude'];
const THEME_ICON_NAMES = { dark: 'moon', light: 'sun', claude: 'flower' };
const THEME_LABELS = { dark: t('theme.dark'), light: t('theme.light'), claude: t('theme.claude') };

function enableRadioGroupKeyboard(track, selector, activate) {
  const options = () => [...track.querySelectorAll(selector)];
  const syncTabStops = () => {
    const items = options();
    const checkedIndex = Math.max(0, items.findIndex(item => item.getAttribute('aria-checked') === 'true'));
    items.forEach((item, index) => { item.tabIndex = index === checkedIndex ? 0 : -1; });
  };
  track.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const items = options();
    if (items.length === 0) return;
    const currentIndex = Math.max(0, items.indexOf(document.activeElement));
    let nextIndex = currentIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = items.length - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length;
    else nextIndex = (currentIndex - 1 + items.length) % items.length;
    event.preventDefault();
    activate(items[nextIndex]);
    syncTabStops();
    items[nextIndex].focus();
  });
  return syncTabStops;
}

function cycleTheme() {
  const current = state.get('theme');
  const idx = THEMES.indexOf(current);
  const next = THEMES[(idx + 1) % THEMES.length];
  state.set('theme', next);
}

if (!THEMES.includes(state.get('theme'))) {
  state.set('theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
state.on('theme', applyTheme);
applyTheme(state.get('theme'));

// ---- App ----
const app = document.getElementById('app');
let fileUpload, conversationList, messageView, searchPanel, exportPanel;
let _mainViewCleanups = [];
let _statsThemeRerenderTimer = null;
let _sidebarTransitionTimer = null;

function renderUploadScreen() {
  app.textContent = '';
  fileUpload = new FileUpload(app);
}

function renderMainView() {
  // Clean up listeners from previous renderMainView call
  _mainViewCleanups.forEach(fn => fn());
  _mainViewCleanups = [];
  clearTimeout(_statsThemeRerenderTimer);
  _statsThemeRerenderTimer = null;
  conversationList?.destroy?.();
  messageView?.destroy?.();

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

  let mobileMenuBtn = null;
  const setMobileSidebarOpen = (open) => {
    sidebar.classList.toggle('mobile-open', open);
    layout.classList.toggle('mobile-sidebar-open', open);
    mobileMenuBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  // Sidebar title with logo
  const sidebarTitle = document.createElement('div');
  sidebarTitle.className = 'sidebar-brand';
  const curTheme = state.get('theme');
  const lang = state.get('lang') || 'zh';
  const isDark = curTheme === 'dark';
  // Spark icon for collapsed state only
  const brandLogoBtn = document.createElement('button');
  brandLogoBtn.type = 'button';
  brandLogoBtn.className = 'sidebar-brand-logo sidebar-collapse-only';
  brandLogoBtn.title = t('sidebar.title');
  brandLogoBtn.appendChild(createSparkIcon(16));
  brandLogoBtn.addEventListener('click', () => {
    if (state.get('sidebarCollapsed')) state.set('sidebarCollapsed', false);
  });
  sidebarTitle.appendChild(brandLogoBtn);
  // Logo image (replaces text title) — theme-aware
  const sidebarLogo = document.createElement('img');
  function updateSidebarLogo() {
    const th = state.get('theme');
    const ln = state.get('lang') || 'zh';
    const dk = th === 'dark';
    sidebarLogo.src = dk ? (ln === 'zh' ? logoZhDark : logoEnDark) : (ln === 'zh' ? logoZh : logoEn);
  }
  updateSidebarLogo();
  state.on('theme', updateSidebarLogo);
  state.on('lang', updateSidebarLogo);
  sidebarLogo.alt = t('sidebar.title');
  sidebarLogo.className = 'sidebar-brand-img sidebar-expand-only';
  sidebarLogo.style.cssText = 'height:18px;width:auto;cursor:pointer;';
  sidebarLogo.addEventListener('click', () => {
    if (state.get('sidebarCollapsed')) state.set('sidebarCollapsed', false);
  });
  sidebarTitle.appendChild(sidebarLogo);
  const collapseBtn = document.createElement('button');
  collapseBtn.type = 'button';
  collapseBtn.className = 'sidebar-collapse-btn sidebar-expand-only';
  collapseBtn.title = t('sidebar.collapse');
  collapseBtn.setAttribute('aria-label', t('sidebar.collapse'));
  // Claude.ai panel icon (two-panel SVG)
  const collapseSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  collapseSvg.setAttribute('width', '20');
  collapseSvg.setAttribute('height', '20');
  collapseSvg.setAttribute('viewBox', '0 0 20 20');
  collapseSvg.setAttribute('fill', 'currentColor');
  const collapsePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  collapsePath.setAttribute('d', 'M16.5 4A1.5 1.5 0 0 1 18 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 14.5v-9A1.5 1.5 0 0 1 3.5 4zM7 15h9.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5H7zM3.5 5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5H6V5z');
  collapseSvg.appendChild(collapsePath);
  collapseBtn.appendChild(collapseSvg);
  collapseBtn.addEventListener('click', () => {
    state.set('sidebarCollapsed', true);
  });
  sidebarTitle.appendChild(collapseBtn);

  const mobileCloseBtn = document.createElement('button');
  mobileCloseBtn.type = 'button';
  mobileCloseBtn.className = 'mobile-sidebar-close';
  mobileCloseBtn.title = t('sidebar.close');
  mobileCloseBtn.setAttribute('aria-label', t('sidebar.close'));
  mobileCloseBtn.appendChild(createIcon('close', 18));
  mobileCloseBtn.addEventListener('click', closeMobileSidebar);
  sidebarTitle.appendChild(mobileCloseBtn);
  sidebar.appendChild(sidebarTitle);

  // Sidebar function buttons — neumorphic pills
  const sidebarActions = document.createElement('div');
  sidebarActions.className = 'sidebar-actions';
  sidebarActions.style.cssText = 'padding:4px 16px 12px;display:flex;flex-direction:column;gap:6px;';

  // Nav pills: Search, Stats, Export
  const navItems = [
    { id: 'sidebar-search-btn', icon: 'search', label: t('sidebar.search'), action: () => state.set('viewMode', 'search') },
    { id: 'sidebar-stats-btn', icon: 'stats', label: t('sidebar.stats'), action: () => state.set('viewMode', 'stats') },
    { id: 'sidebar-export-btn', icon: 'export', label: t('sidebar.export'), action: () => state.set('viewMode', 'export') },
  ];

  for (const nav of navItems) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'sidebar-pill pill-flat';
    pill.id = nav.id;
    const iconWrap = document.createElement('span');
    iconWrap.className = 'nav-icon';
    iconWrap.appendChild(createIcon(nav.icon, 16));
    pill.appendChild(iconWrap);
    const labelSpan = document.createElement('span');
    labelSpan.className = 'sidebar-pill-label';
    labelSpan.textContent = nav.label;
    pill.appendChild(labelSpan);
    pill.addEventListener('click', nav.action);
    sidebarActions.appendChild(pill);
  }

  const railExpandBtn = document.createElement('button');
  railExpandBtn.type = 'button';
  railExpandBtn.className = 'sidebar-rail-toggle';
  railExpandBtn.textContent = '›';
  railExpandBtn.title = t('sidebar.expand');
  railExpandBtn.setAttribute('aria-label', t('sidebar.expand'));
  railExpandBtn.addEventListener('click', () => {
    state.set('sidebarCollapsed', false);
  });
  sidebarActions.appendChild(railExpandBtn);

  // Theme toggle track (3-way: sun / moon / flower)
  const themeTrackRow = document.createElement('div');
  themeTrackRow.className = 'pill-row sidebar-expand-only';
  themeTrackRow.style.cssText += 'padding:4px 0;justify-content:stretch;';

  const themeTrack = document.createElement('div');
  themeTrack.className = 'sidebar-pill toggle-track track-3';
  themeTrack.id = 'sidebar-theme-track';
  themeTrack.setAttribute('role', 'radiogroup');
  themeTrack.setAttribute('aria-label', t('sidebar.themeGroup'));

  const themeThumb = document.createElement('div');
  themeThumb.className = 'toggle-thumb';
  themeTrack.appendChild(themeThumb);

  const themeOptions = [
    { theme: 'light', icon: 'sun' },
    { theme: 'dark', icon: 'moon' },
    { theme: 'claude', icon: 'spark' },
  ];

  const syncThemeThumb = (themeValue) => {
    const track = document.getElementById('sidebar-theme-track');
    if (!track) return;
    const idx = themeOptions.findIndex(o => o.theme === themeValue);
    if (idx < 0) return;
    const thumb = track.querySelector('.toggle-thumb');
    if (!thumb) return;
    const pad = 4;
    const seg = (track.clientWidth - pad * 2) / themeOptions.length;
    thumb.style.width = `${seg}px`;
    thumb.style.transform = `translateX(${idx * seg}px)`;
  };

  const currentTheme = state.get('theme');

  for (let i = 0; i < themeOptions.length; i++) {
    const opt = themeOptions[i];
    const optDiv = document.createElement('button');
    optDiv.type = 'button';
    optDiv.className = 'toggle-option' + (opt.theme === currentTheme ? ' active' : '');
    optDiv.dataset.theme = opt.theme;
    optDiv.setAttribute('role', 'radio');
    optDiv.setAttribute('aria-label', THEME_LABELS[opt.theme]);
    optDiv.setAttribute('aria-checked', opt.theme === currentTheme ? 'true' : 'false');
    const optIcon = opt.icon === 'spark' ? createSparkIcon(14, true) : createIcon(opt.icon, 16);
    optDiv.appendChild(optIcon);
    optDiv.addEventListener('click', () => {
      state.set('theme', opt.theme);
    });
    themeTrack.appendChild(optDiv);
  }
  const syncThemeTabStops = enableRadioGroupKeyboard(themeTrack, '.toggle-option', option => {
    state.set('theme', option.dataset.theme);
  });
  syncThemeTabStops();

  themeTrackRow.appendChild(themeTrack);
  requestAnimationFrame(() => syncThemeThumb(currentTheme));
  // themeTrackRow will be appended later, after foldables

  // Theme state listener — update track thumb + active option + re-render stats
  _mainViewCleanups.push(state.on('theme', (t) => {
    const track = document.getElementById('sidebar-theme-track');
    if (track) {
      syncThemeThumb(t);
      track.querySelectorAll('.toggle-option').forEach(el => {
        const active = el.dataset.theme === t;
        el.classList.toggle('active', active);
        el.setAttribute('aria-checked', active ? 'true' : 'false');
      });
      syncThemeTabStops();
    }
    // Re-render stats panel so ring charts pick up new theme shadows
    if (messageView && state.get('viewMode') === 'stats') {
      const c = messageView.container;
      const currentMessageView = messageView;
      const overlay = showLoading(c);
      Array.from(c.children).forEach(ch => { if (ch !== overlay) ch.remove(); });
      clearTimeout(_statsThemeRerenderTimer);
      _statsThemeRerenderTimer = setTimeout(() => {
        if (messageView !== currentMessageView) return;
        if (state.get('viewMode') !== 'stats') return;
        if (!c.isConnected) return;
        currentMessageView.statsPanel.renderInline(c);
        hideLoading(overlay);
        _statsThemeRerenderTimer = null;
      }, 500);
    }
  }));
  const handleThemeResize = () => syncThemeThumb(state.get('theme'));
  window.addEventListener('resize', handleThemeResize);
  _mainViewCleanups.push(() => window.removeEventListener('resize', handleThemeResize));

  // ---- Foldable: Display Settings ----
  const settingsFoldable = document.createElement('details');
  settingsFoldable.className = 'sidebar-foldable sidebar-expand-only';

  const settingsSummary = document.createElement('summary');
  const settingsPill = document.createElement('div');
  settingsPill.className = 'sidebar-pill pill-flat';
  const settingsIcon = document.createElement('span');
  settingsIcon.className = 'nav-icon';
  settingsIcon.appendChild(createIcon('shield', 16));
  settingsPill.appendChild(settingsIcon);
  const settingsLabel = document.createElement('span');
  settingsLabel.textContent = t('sidebar.displaySettings');
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
    { id: 'toggle-thinking', label: t('sidebar.showThinking'), key: 'showThinking' },
    { id: 'toggle-tools', label: t('sidebar.showToolUse'), key: 'showToolUse' },
    { id: 'toggle-flags', label: t('sidebar.showFlags'), key: 'showFlags' },
    { id: 'toggle-desensitize', label: t('sidebar.desensitize'), key: 'desensitize' },
  ];

  for (const t of toggles) {
    const row = document.createElement('div');
    row.className = 'sidebar-toggle-row';

    const labelText = document.createElement('span');
    labelText.className = 'sidebar-toggle-label';
    labelText.textContent = t.label;
    row.appendChild(labelText);

    // Neumorphic switch
    const neuSwitch = document.createElement('label');
    neuSwitch.className = 'neu-switch' + (state.get(t.key) ? ' active' : '');
    neuSwitch.setAttribute('aria-label', t.label);
    const handle = document.createElement('div');
    handle.className = 'switch-handle';
    neuSwitch.appendChild(handle);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = t.id;
    input.checked = state.get(t.key);
    input.className = 'visually-hidden neu-switch-input';
    input.setAttribute('aria-label', t.label);
    input.addEventListener('change', (e) => {
      state.set(t.key, e.target.checked);
      neuSwitch.classList.toggle('active', e.target.checked);
    });
    neuSwitch.appendChild(input);
    row.appendChild(neuSwitch);
    settingsContent.appendChild(row);
  }

  // Desensitize word input (shown when desensitize is on)
  const desensitizeSection = document.createElement('div');
  desensitizeSection.id = 'desensitize-section';
  desensitizeSection.style.cssText = 'display:' + (state.get('desensitize') ? 'flex' : 'none') + ';flex-direction:column;gap:4px;';

  const dsInput = document.createElement('input');
  dsInput.type = 'text';
  dsInput.className = 'neu-input';
  dsInput.setAttribute('aria-label', t('sidebar.desensitizeWords'));
  dsInput.placeholder = t('sidebar.desensitizePlaceholder');
  dsInput.value = (state.get('desensitizeWords') || []).join(', ');
  dsInput.addEventListener('input', () => {
    const words = dsInput.value.split(/[,，]/).map(w => w.trim()).filter(Boolean);
    state.set('desensitizeWords', words);
    saveDesensitizeWords(words);
  });
  desensitizeSection.appendChild(dsInput);

  const dsHint = document.createElement('div');
  dsHint.style.cssText = 'font-size:11px;color:var(--text-muted);padding:0 2px;';
  dsHint.textContent = t('sidebar.desensitizeHint');
  desensitizeSection.appendChild(dsHint);

  settingsContent.appendChild(desensitizeSection);

  _mainViewCleanups.push(state.on('desensitize', (val) => {
    const sec = document.getElementById('desensitize-section');
    if (sec) sec.style.display = val ? 'flex' : 'none';
  }));

  settingsFoldable.appendChild(settingsContent);
  sidebarActions.appendChild(settingsFoldable);

  // ---- Foldable: Display Name ----
  const nameFoldable = document.createElement('details');
  nameFoldable.className = 'sidebar-foldable sidebar-expand-only';

  const nameSummary = document.createElement('summary');
  const namePill = document.createElement('div');
  namePill.className = 'sidebar-pill pill-flat';
  const nameIcon = document.createElement('span');
  nameIcon.className = 'nav-icon';
  nameIcon.appendChild(createIcon('user', 16));
  namePill.appendChild(nameIcon);
  const nameLabel = document.createElement('span');
  nameLabel.textContent = t('sidebar.displayNames');
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
  const humanLabel = document.createElement('label');
  humanLabel.className = 'sidebar-name-label';
  humanLabel.textContent = t('sidebar.userName');
  humanRow.appendChild(humanLabel);
  const humanInput = document.createElement('input');
  humanInput.type = 'text';
  humanInput.id = 'sidebar-name-human';
  humanLabel.htmlFor = humanInput.id;
  humanInput.className = 'neu-input';
  humanInput.value = names.human;
  humanRow.appendChild(humanInput);
  nameContent.appendChild(humanRow);

  // Assistant name row
  const assistantRow = document.createElement('div');
  assistantRow.className = 'sidebar-name-row';
  const assistantLabel = document.createElement('label');
  assistantLabel.className = 'sidebar-name-label';
  assistantLabel.textContent = t('sidebar.aiName');
  assistantRow.appendChild(assistantLabel);
  const assistantInput = document.createElement('input');
  assistantInput.type = 'text';
  assistantInput.id = 'sidebar-name-assistant';
  assistantLabel.htmlFor = assistantInput.id;
  assistantInput.className = 'neu-input';
  assistantInput.value = names.assistant;
  assistantRow.appendChild(assistantInput);
  nameContent.appendChild(assistantRow);

  // Save / Reset buttons
  const nameBtnRow = document.createElement('div');
  nameBtnRow.style.cssText = 'display:flex;gap:8px;';

  const saveNameBtn = document.createElement('button');
  saveNameBtn.className = 'sidebar-name-btn primary';
  saveNameBtn.textContent = t('sidebar.save');
  saveNameBtn.addEventListener('click', () => {
    const humanVal = document.getElementById('sidebar-name-human')?.value || 'Synqa';
    const assistantVal = document.getElementById('sidebar-name-assistant')?.value || 'Sylux';
    const newNames = { human: humanVal, assistant: assistantVal };
    state.set('displayNames', newNames);
    localStorage.setItem('cv-names', JSON.stringify(newNames));
    saveNameBtn.textContent = t('sidebar.saved');
    setTimeout(() => { saveNameBtn.textContent = t('sidebar.save'); }, 1200);
  });
  nameBtnRow.appendChild(saveNameBtn);

  const resetNameBtn = document.createElement('button');
  resetNameBtn.className = 'sidebar-name-btn secondary';
  resetNameBtn.textContent = t('sidebar.reset');
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
  langTrack.setAttribute('role', 'radiogroup');
  langTrack.setAttribute('aria-label', t('sidebar.languageGroup'));
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
    const loDiv = document.createElement('button');
    loDiv.type = 'button';
    loDiv.className = 'toggle-option' + (lo.lang === currentLang ? ' active' : '');
    loDiv.dataset.lang = lo.lang;
    loDiv.setAttribute('role', 'radio');
    loDiv.setAttribute('aria-label', lo.lang === 'zh' ? t('sidebar.switchChinese') : t('sidebar.switchEnglish'));
    loDiv.setAttribute('aria-checked', lo.lang === currentLang ? 'true' : 'false');
    loDiv.style.cssText = 'font-weight:700;letter-spacing:0.5px;font-size:13px;';
    loDiv.textContent = lo.label;
    loDiv.addEventListener('click', () => {
      localStorage.setItem('cv-lang', lo.lang);
      state.set('lang', lo.lang);
      document.title = t('page.title');
      location.reload();
    });
    langTrack.appendChild(loDiv);
  }
  const syncLangTabStops = enableRadioGroupKeyboard(langTrack, '.toggle-option', option => {
    option.click();
  });
  syncLangTabStops();
  themeTrackRow.appendChild(langTrack);

  // Append toggle row (theme + lang) after foldables, before search
  sidebarActions.appendChild(themeTrackRow);

  sidebar.appendChild(sidebarActions);

  // Content area
  const contentArea = document.createElement('main');
  contentArea.className = 'content-area';
  contentArea.id = 'content-area';

  const mobileSidebarBackdrop = document.createElement('button');
  mobileSidebarBackdrop.type = 'button';
  mobileSidebarBackdrop.className = 'mobile-sidebar-backdrop';
  mobileSidebarBackdrop.setAttribute('aria-label', t('sidebar.close'));
  mobileSidebarBackdrop.addEventListener('click', closeMobileSidebar);

  const mobileBottomNav = document.createElement('nav');
  mobileBottomNav.className = 'mobile-bottom-nav';
  mobileBottomNav.setAttribute('aria-label', t('sidebar.title'));

  const createMobileNavButton = (nav) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mobile-bottom-nav-btn';
    button.id = nav.id;
    button.setAttribute('aria-label', nav.label);
    if (nav.controls) button.setAttribute('aria-controls', nav.controls);
    if (nav.expanded != null) button.setAttribute('aria-expanded', nav.expanded);

    const iconWrap = document.createElement('span');
    iconWrap.className = 'nav-icon';
    iconWrap.appendChild(createIcon(nav.icon, 17));
    button.appendChild(iconWrap);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'mobile-bottom-nav-label';
    labelSpan.textContent = nav.label;
    button.appendChild(labelSpan);
    button.addEventListener('click', nav.action);
    return button;
  };

  mobileMenuBtn = createMobileNavButton({
    id: 'mobile-sidebar-btn',
    icon: 'menu',
    label: t('sidebar.menu'),
    controls: 'sidebar',
    expanded: 'false',
    action: () => setMobileSidebarOpen(!sidebar.classList.contains('mobile-open')),
  });

  mobileBottomNav.appendChild(mobileMenuBtn);
  for (const nav of navItems) {
    mobileBottomNav.appendChild(createMobileNavButton({
      id: nav.id.replace('sidebar-', 'mobile-'),
      icon: nav.icon,
      label: nav.label,
      action: () => {
        closeMobileSidebar();
        nav.action();
      },
    }));
  }

  layout.appendChild(sidebar);
  layout.appendChild(contentArea);
  layout.appendChild(mobileSidebarBackdrop);
  layout.appendChild(mobileBottomNav);
  app.appendChild(layout);

  // Components
  conversationList = new ConversationList(sidebar);
  messageView = new MessageView(contentArea);

  // ---- Nav active state helper ----
  function updateNavActive(mode) {
    const allBtns = [
      'sidebar-search-btn',
      'sidebar-export-btn',
      'sidebar-stats-btn',
      'mobile-search-btn',
      'mobile-export-btn',
      'mobile-stats-btn',
    ];
    const activeId = mode === 'search' ? 'sidebar-search-btn'
      : mode === 'export' ? 'sidebar-export-btn'
      : mode === 'stats' ? 'sidebar-stats-btn'
      : null;
    for (const id of allBtns) {
      const el = document.getElementById(id);
      if (!el) continue;
      const desktopId = id.replace('mobile-', 'sidebar-');
      const isActive = desktopId === activeId;
      el.classList.remove('pill-flat', 'pill-active');
      el.classList.add(isActive ? 'pill-active' : 'pill-flat');
      if (isActive) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    }
  }
  // Make it accessible for stats button action
  window._updateNavActive = updateNavActive;

  // ---- View Mode switching ----
  _mainViewCleanups.push(state.on('viewMode', (mode) => {
    closeMobileSidebar();
    const area = document.getElementById('content-area');
    if (!area) return;
    if (mode !== 'stats') area.classList.remove('stats-panel-shell');
    updateNavActive(mode);
    if (mode === 'search') {
      messageView?.destroy?.(); messageView = null;
      exportPanel?.destroy?.();
      searchPanel.render(area);
    } else if (mode === 'export') {
      messageView?.destroy?.(); messageView = null;
      exportPanel.render(area);
    } else if (mode === 'stats') {
      exportPanel?.destroy?.();
      state.set('currentConversationIndex', -1);
      messageView?.destroy?.();
      messageView = new MessageView(area);
    } else {
      // conversation mode — MessageView will render the selected conversation
      exportPanel?.destroy?.();
      messageView?.destroy?.();
      messageView = new MessageView(area);
    }
  }));

  _mainViewCleanups.push(state.on('currentConversationIndex', (idx) => {
    if (idx >= 0) closeMobileSidebar();
    // When a conversation is selected from stats/list, switch to conversation mode
    if (idx >= 0 && state.get('viewMode') === 'stats') {
      state.set('viewMode', 'conversation');
    }
    updateNavActive(state.get('viewMode'));
  }));

  const applySidebarCollapsed = (collapsed) => {
    clearTimeout(_sidebarTransitionTimer);
    sidebar.classList.add('transitioning');
    sidebar.classList.toggle('collapsed', collapsed);
    contentArea.classList.toggle('sidebar-compact', collapsed);
    _sidebarTransitionTimer = setTimeout(() => {
      sidebar.classList.remove('transitioning');
      _sidebarTransitionTimer = null;
    }, 260);
    localStorage.setItem('cv-sidebar-collapsed', collapsed ? 'true' : 'false');
  };
  _mainViewCleanups.push(state.on('sidebarCollapsed', applySidebarCollapsed));
  applySidebarCollapsed(state.get('sidebarCollapsed'));

  const handleMobileSidebarKeydown = (event) => {
    if (event.key === 'Escape') closeMobileSidebar();
  };
  document.addEventListener('keydown', handleMobileSidebarKeydown);
  _mainViewCleanups.push(() => document.removeEventListener('keydown', handleMobileSidebarKeydown));

  const handleMobileSidebarResize = () => {
    if (window.innerWidth > 768) closeMobileSidebar();
  };
  window.addEventListener('resize', handleMobileSidebarResize);
  _mainViewCleanups.push(() => window.removeEventListener('resize', handleMobileSidebarResize));

  // Initial active state on load
  requestAnimationFrame(() => updateNavActive(state.get('viewMode')));
}


// ---- Init ----
state.on('conversations', (conversations) => {
  if (conversations.length > 0 && state.get('loading') === false) {
    state.set('highlightMessageIndex', null);
    state.set('currentConversationIndex', -1);
    state.set('viewMode', 'stats');
    state.set('exportCollection', []);
    saveExportCollection();
    resetSidebarFilter();
    renderMainView();
  }
});

renderUploadScreen();

// Development-only visual regression entrypoint. Vite removes this branch from
// production builds because import.meta.env.DEV is statically false there.
if (import.meta.env.DEV) {
  const loadSyntheticFixture = () => fetch('/tests/fixtures/conversations.synthetic.json')
    .then(response => {
      if (!response.ok) throw new Error(`Fixture request failed: ${response.status}`);
      return response.blob();
    })
    .then(blob => fileUpload.handleFile(new File([blob], 'conversations.synthetic.json', { type: 'application/json' })))
    .catch(error => console.error('Unable to load visual regression fixture', error));

  if (new URLSearchParams(window.location.search).get('__fixture') === 'synthetic') {
    loadSyntheticFixture();
  } else {
    const fixtureButton = document.createElement('button');
    fixtureButton.type = 'button';
    fixtureButton.setAttribute('aria-label', 'Load visual regression fixture');
    fixtureButton.style.cssText = 'position:fixed;right:2px;bottom:2px;width:8px;height:8px;padding:0;border:0;opacity:0.01;';
    fixtureButton.addEventListener('click', loadSyntheticFixture);
    document.body.appendChild(fixtureButton);
  }
}
