/**
 * FileUpload component — drag-drop upload + Clawd loading animation.
 */

import { state } from '../store/state.js';
import { saveToCache, getCacheInfo, loadFromCache, clearCache } from '../utils/cache.js';
import { createIcon } from '../utils/icons.js';
import { SPARK_SVG } from '../utils/spark.js';
import { getLang, t } from '../i18n.js';
import ParseWorker from '../parser/worker.js?worker&inline';
import logoEn from '../assets/logo-en.png';
import logoZh from '../assets/logo-zh.png';
import logoEnDark from '../assets/logo-en-dark.png';
import logoZhDark from '../assets/logo-zh-dark.png';
import imgBubbles from '../assets/clawd/IMG_bubbles.GIF';
import imgCelebrate from '../assets/clawd/IMG_celebrate.GIF';
import imgIdea from '../assets/clawd/IMG_idea.GIF';
import imgLove from '../assets/clawd/IMG_love.GIF';
import imgMusic from '../assets/clawd/IMG_music.GIF';
import imgRepair from '../assets/clawd/IMG_repair.GIF';
import imgThinking from '../assets/clawd/IMG_thinking.GIF';
import imgWatch from '../assets/clawd/IMG_watch.GIF';

// SPARK_SVG imported from shared module '../utils/spark.js'

export class FileUpload {
  constructor(container) {
    this.container = container;
    // Non-persistent, language-aware manifest guide data (structure only).
    this.manifestData = null;
    this._importBusy = false;
    this._worker = null;
    this.render();
  }

  render() {
    const screen = document.createElement('main');
    screen.className = 'upload-screen';
    screen.id = 'upload-screen';

    const pageTitle = document.createElement('h1');
    pageTitle.className = 'visually-hidden';
    pageTitle.textContent = t('sidebar.title');
    screen.appendChild(pageTitle);

    // Title — Logo image, auto-updates on theme/language change
    const greetingRow = document.createElement('div');
    greetingRow.style.cssText = 'display:flex;align-items:center;gap:9px;justify-content:center;margin-bottom:20px;';

    const logoImg = document.createElement('img');
    function updateUploadLogo() {
      const th = state.get('theme');
      const ln = state.get('lang') || 'zh';
      const dk = (th === 'dark' || (th === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches));
      if (dk) {
        logoImg.src = ln === 'zh' ? logoZhDark : logoEnDark;
      } else {
        logoImg.src = ln === 'zh' ? logoZh : logoEn;
      }
      logoImg.alt = ln === 'zh' ? 'Claude 记忆刻痕' : 'Claude Engram';
    }
    updateUploadLogo();
    state.on('theme', updateUploadLogo);
    state.on('lang', updateUploadLogo);
    logoImg.style.cssText = 'height:32px;width:auto;';
    greetingRow.appendChild(logoImg);
    screen.appendChild(greetingRow);

    // Upload zone — styled as Claude's input box (right after title, no subtitle between)
    const zone = document.createElement('div');
    zone.className = 'upload-zone';
    zone.id = 'upload-zone';
    zone.setAttribute('role', 'button');
    zone.setAttribute('tabindex', '0');
    zone.setAttribute('aria-label', t('upload.dropzone'));
    zone.style.cssText = 'padding:0;text-align:left;max-width:504px;';

    // Text area (fake placeholder)
    const fakeInput = document.createElement('div');
    fakeInput.style.cssText = 'padding:16px 18px 8px;font-size:12px;color:var(--text-muted);line-height:1.4;';
    fakeInput.textContent = t('upload.dropzone');
    zone.appendChild(fakeInput);

    // Toolbar row (mimics Claude's input toolbar)
    const toolbarRow = document.createElement('div');
    toolbarRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px 12px;';

    // Left: + button
    const leftBtns = document.createElement('div');
    leftBtns.style.cssText = 'display:flex;align-items:center;gap:4px;';
    const plusBtn = document.createElement('div');
    plusBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;color:var(--text-muted);';
    plusBtn.appendChild(createIcon('plus', 20));
    leftBtns.appendChild(plusBtn);
    toolbarRow.appendChild(leftBtns);

    // Right: model name + voice icon
    const rightBtns = document.createElement('div');
    rightBtns.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const modelSelector = document.createElement('div');
    modelSelector.style.cssText = 'display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:8px;font-size:14px;color:var(--text-secondary);';
    const modelName = document.createElement('span');
    modelName.style.cssText = 'font-weight:430;color:var(--text-secondary);';
    modelName.textContent = 'Opus 4.6';
    const modelMode = document.createElement('span');
    modelMode.style.cssText = 'color:var(--text-muted);margin-left:4px;font-size:14px;font-weight:430;';
    modelMode.textContent = 'Extended';
    modelSelector.appendChild(modelName);
    modelSelector.appendChild(modelMode);
    const chevron = createIcon('chevronDown', 14);
    chevron.style.color = 'var(--text-muted)';
    modelSelector.appendChild(chevron);
    rightBtns.appendChild(modelSelector);

    // Voice bars icon (6 bars, uniform width)
    const voiceIcon = document.createElement('div');
    voiceIcon.style.cssText = 'display:flex;align-items:center;justify-content:center;width:32px;height:32px;color:var(--text-muted);gap:2.5px;';
    const barHeights = [6, 10, 16, 10, 16, 6];
    for (let i = 0; i < 6; i++) {
      const bar = document.createElement('div');
      bar.style.cssText = `width:2px;height:${barHeights[i]}px;background:currentColor;border-radius:1px;`;
      voiceIcon.appendChild(bar);
    }
    rightBtns.appendChild(voiceIcon);

    toolbarRow.appendChild(rightBtns);
    zone.appendChild(toolbarRow);

    // Hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,.zip';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    fileInput.id = 'file-input';
    zone.appendChild(fileInput);

    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      fileInput.click();
    });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) this.handleFiles(files);
    });
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      if (files.length) this.handleFiles(files);
    });

    screen.appendChild(zone);

    // Manifest guide slot (persistent, re-rendered on language change)
    this.manifestSlot = document.createElement('div');
    this.manifestSlot.id = 'manifest-guide';
    this.manifestSlot.className = 'manifest-guide';
    screen.appendChild(this.manifestSlot);
    this.renderManifestGuide();

    // Name config
    const nameConfig = document.createElement('div');
    nameConfig.className = 'name-config';

    const nameTitle = document.createElement('div');
    nameTitle.className = 'name-config-title';
    nameTitle.textContent = t('upload.namesTitle');
    nameConfig.appendChild(nameTitle);

    const nameInputs = document.createElement('div');
    nameInputs.className = 'name-inputs';

    const names = state.get('displayNames');

    const humanGroup = this.createNameInput(t('upload.humanName'), names.human);
    humanGroup.querySelector('input').id = 'name-human';
    humanGroup.querySelector('label').htmlFor = 'name-human';

    const assistantGroup = this.createNameInput(t('upload.assistantName'), names.assistant);
    assistantGroup.querySelector('input').id = 'name-assistant';
    assistantGroup.querySelector('label').htmlFor = 'name-assistant';

    nameInputs.appendChild(humanGroup);
    nameInputs.appendChild(assistantGroup);
    nameConfig.appendChild(nameInputs);

    // Buttons row
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;margin-top:12px;';

    const saveBtn = document.createElement('button');
    saveBtn.style.cssText = 'padding:7px 16px;border:none;border-radius:var(--radius-sm);background:var(--btn-primary-bg, var(--text-secondary));color:var(--btn-primary-text, #fff);cursor:pointer;font-size:12px;font-weight:500;display:flex;align-items:center;gap:5px;transition:all 0.2s;box-shadow:var(--shadow-xs);';
    saveBtn.addEventListener('mouseenter', () => { saveBtn.style.opacity = '0.85'; saveBtn.style.transform = 'translateY(-1px)'; saveBtn.style.boxShadow = 'var(--shadow-sm)'; });
    saveBtn.addEventListener('mouseleave', () => { saveBtn.style.opacity = '1'; saveBtn.style.transform = ''; saveBtn.style.boxShadow = 'var(--shadow-xs)'; });
    saveBtn.appendChild(createIcon('save', 14));
    saveBtn.appendChild(document.createTextNode(t('upload.saveApply')));
    saveBtn.addEventListener('click', () => {
      const humanVal = document.getElementById('name-human')?.value || 'Synqa';
      const assistantVal = document.getElementById('name-assistant')?.value || 'Sylux';
      const newNames = { human: humanVal, assistant: assistantVal };
      state.set('displayNames', newNames);
      localStorage.setItem('cv-names', JSON.stringify(newNames));
      saveBtn.textContent = '';
      saveBtn.appendChild(createIcon('check', 14));
      saveBtn.appendChild(document.createTextNode(t('upload.applied')));
      setTimeout(() => {
        saveBtn.textContent = '';
        saveBtn.appendChild(createIcon('save', 14));
        saveBtn.appendChild(document.createTextNode(t('upload.saveApply')));
      }, 1500);
    });
    btnRow.appendChild(saveBtn);

    const resetBtn = document.createElement('button');
    resetBtn.style.cssText = 'padding:7px 16px;border:none;border-radius:var(--radius-sm);background:var(--bg-input);color:var(--text-secondary);cursor:pointer;font-size:12px;display:flex;align-items:center;gap:5px;transition:all 0.2s;box-shadow:var(--shadow-xs);';
    resetBtn.addEventListener('mouseenter', () => { resetBtn.style.transform = 'translateY(-1px)'; resetBtn.style.boxShadow = 'var(--shadow-sm)'; });
    resetBtn.addEventListener('mouseleave', () => { resetBtn.style.transform = ''; resetBtn.style.boxShadow = 'var(--shadow-xs)'; });
    resetBtn.appendChild(createIcon('reset', 14));
    resetBtn.appendChild(document.createTextNode(t('upload.resetNames')));
    resetBtn.addEventListener('click', () => {
      const defaults = { human: 'Synqa', assistant: 'Sylux' };
      document.getElementById('name-human').value = defaults.human;
      document.getElementById('name-assistant').value = defaults.assistant;
      state.set('displayNames', defaults);
      localStorage.setItem('cv-names', JSON.stringify(defaults));
    });
    btnRow.appendChild(resetBtn);

    nameConfig.appendChild(btnRow);
    screen.appendChild(nameConfig);

    // Theme switcher (at bottom)
    const themeSwitcher = document.createElement('div');
    themeSwitcher.style.cssText = 'display:flex;gap:6px;padding:6px;border-radius:18px;border:none;background:var(--bg-card);box-shadow:var(--shadow);transition:box-shadow 0.2s,transform 0.2s;';
    themeSwitcher.addEventListener('mouseenter', () => { themeSwitcher.style.boxShadow = 'var(--shadow-sm)'; themeSwitcher.style.transform = 'translateY(-1px)'; });
    themeSwitcher.addEventListener('mouseleave', () => { themeSwitcher.style.boxShadow = 'var(--shadow)'; themeSwitcher.style.transform = ''; });

    const themes = [
      { id: 'light', iconName: 'sun' },
      { id: 'dark', iconName: 'moon' },
      { id: 'claude', iconName: null },
    ];

    for (const th of themes) {
      const btn = document.createElement('button');
      btn.dataset.theme = th.id;
      btn.type = 'button';
      btn.setAttribute('aria-label', t(`theme.${th.id}`));
      const isActive = state.get('theme') === th.id;
      btn.style.cssText = `display:flex;align-items:center;justify-content:center;width:36px;height:36px;border:none;border-radius:12px;cursor:pointer;transition:all 0.15s;color:${isActive ? 'var(--accent)' : 'var(--text-muted)'};${isActive ? 'background:var(--accent-bg);box-shadow:var(--shadow-inset);' : 'background:transparent;'}`;
      if (th.iconName) {
        btn.appendChild(createIcon(th.iconName, 18));
      } else {
        const sparkSmall = document.createElement('span');
        sparkSmall.style.cssText = 'width:18px;height:18px;display:inline-flex;';
        const st = document.createElement('template');
        st.innerHTML = SPARK_SVG;
        sparkSmall.appendChild(st.content);
        btn.appendChild(sparkSmall);
      }
      btn.addEventListener('click', () => {
        state.set('theme', th.id);
        themeSwitcher.querySelectorAll('button').forEach(b => {
          const active = b.dataset.theme === th.id;
          b.style.background = active ? 'var(--accent-bg)' : 'transparent';
          b.style.boxShadow = active ? 'var(--shadow-inset)' : 'none';
          b.style.color = active ? 'var(--accent)' : 'var(--text-muted)';
        });
      });
      themeSwitcher.appendChild(btn);
    }
    // Language switcher (beside theme switcher)
    const langSwitcher = document.createElement('div');
    langSwitcher.style.cssText = 'display:flex;gap:4px;padding:6px;border-radius:18px;border:none;background:var(--bg-card);box-shadow:var(--shadow);margin-left:8px;';
    const langs = [{id: 'zh', label: '中文'}, {id: 'en', label: 'EN'}];
    for (const lo of langs) {
      const btn = document.createElement('button');
      btn.dataset.lang = lo.id;
      btn.type = 'button';
      btn.setAttribute('aria-label', lo.id === 'zh' ? '切换为中文' : 'Switch to English');
      const isActive = state.get('lang') === lo.id;
      btn.style.cssText = `display:flex;align-items:center;justify-content:center;padding:0 12px;height:36px;border:none;border-radius:12px;cursor:pointer;transition:all 0.15s;font-size:13px;font-weight:600;color:${isActive ? 'var(--accent)' : 'var(--text-muted)'};${isActive ? 'background:var(--accent-bg);box-shadow:var(--shadow-inset);' : 'background:transparent;'}`;
      btn.textContent = lo.label;
      btn.addEventListener('click', () => {
        state.set('lang', lo.id);
        localStorage.setItem('cv-lang', lo.id);
        langSwitcher.querySelectorAll('button').forEach(b => {
          const active = b.dataset.lang === lo.id;
          b.style.background = active ? 'var(--accent-bg)' : 'transparent';
          b.style.boxShadow = active ? 'var(--shadow-inset)' : 'none';
          b.style.color = active ? 'var(--accent)' : 'var(--text-muted)';
        });
        // Re-render the whole upload screen to update all text
        this.container.textContent = '';
        this.render();
      });
      langSwitcher.appendChild(btn);
    }

    // Wrap theme + lang switchers in a row
    const switcherRow = document.createElement('div');
    switcherRow.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;';
    switcherRow.appendChild(themeSwitcher);
    switcherRow.appendChild(langSwitcher);
    screen.appendChild(switcherRow);

    // Hints at the very bottom
    const hintsWrapper = document.createElement('div');
    hintsWrapper.style.cssText = 'text-align:center;margin-top:8px;';
    const subtitle = document.createElement('p');
    subtitle.style.cssText = 'color:var(--text-muted);font-size:12px;';
    subtitle.textContent = t('upload.subtitle');
    hintsWrapper.appendChild(subtitle);
    const hintPath = document.createElement('p');
    hintPath.style.cssText = 'color:var(--text-muted);font-size:12px;margin-top:4px;';
    hintPath.textContent = t('upload.hint');
    hintsWrapper.appendChild(hintPath);

    screen.appendChild(hintsWrapper);

    // Spacer to push credit to bottom
    const spacer = document.createElement('div');
    spacer.style.cssText = 'flex:1;min-height:80px;';
    screen.appendChild(spacer);

    // Credit at very bottom
    const credit = document.createElement('p');
    credit.style.cssText = 'color:var(--text-muted);font-size:11px;opacity:0.5;text-align:center;padding-bottom:32px;';
    credit.textContent = t('upload.footer');
    screen.appendChild(credit);

    // Error banner
    const errorBanner = document.createElement('div');
    errorBanner.className = 'banner banner-error hidden';
    errorBanner.id = 'upload-error';
    errorBanner.setAttribute('role', 'alert');
    errorBanner.setAttribute('aria-live', 'assertive');
    screen.appendChild(errorBanner);

    this.container.appendChild(screen);

    // Check for cached data
    this.checkCache(screen);
  }

  createNameInput(label, defaultValue) {
    const group = document.createElement('div');
    group.className = 'name-input-group';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    group.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue;
    group.appendChild(input);

    return group;
  }

  /**
   * Import one or more user-selected local files (.json and/or .zip) as a
   * single transaction. Never fetches, opens, or prefetches anything.
   */
  async handleFiles(files) {
    if (this._importBusy) return;
    const list = Array.from(files || []);
    if (list.length === 0) return;
    this._importBusy = true;
    state.set('loading', true);
    this.showLoading();

    this.runWorkerImport(list);
  }

  /**
   * Release the busy lock, tear down the worker, and restore the upload screen.
   * Call this BEFORE showing any error banner so the banner survives the DOM
   * rebuild.
   */
  finishImport() {
    this.releaseWorker();
    this.showUploadScreen();
  }

  /** Release the busy lock and terminate/drop the current worker. */
  releaseWorker() {
    this._importBusy = false;
    if (this._worker) {
      try { this._worker.terminate(); } catch (e) { /* ignore */ }
      this._worker = null;
    }
  }

  /**
   * Post the selected File list to the worker once and handle its messages.
   * @param {File[]} files
   */
  runWorkerImport(files) {
    let worker;
    try {
      worker = new ParseWorker();
    } catch (err) {
      state.set('loading', false);
      this.finishImport();
      this.showError('upload.errorParse');
      return;
    }
    this._worker = worker;

    worker.onmessage = (msg) => {
      const data = msg.data || {};
      switch (data.type) {
        case 'status':
          break;
        case 'progress':
          state.set('loadingProgress', { current: data.current, total: data.total });
          this.updateProgress(data.current, data.total);
          break;
        case 'manifest':
          // Guide only — never touches the cache or conversation state.
          this.manifestData = data.manifest || null;
          state.set('loading', false);
          this.finishImport();
          break;
        case 'no_conversations':
          // Only non-conversation packages (e.g. memories) were selected.
          state.set('loading', false);
          this.finishImport();
          this.showError('upload.errorNoConversations');
          break;
        case 'done':
          if (!data.conversations || data.conversations.length === 0) {
            state.set('loading', false);
            this.finishImport();
            this.showError('upload.errorEmpty');
            break;
          }
          // Clear loading FIRST so src/main.js's 'conversations' subscriber
          // (which requires loading === false) actually renders the main view.
          state.set('loading', false);
          // Do NOT rebuild the upload screen here: the app transitions to the
          // main view when conversations are committed below.
          this.releaseWorker();
          // Commit as ONE transaction only after a fully successful parse.
          state.set('conversations', data.conversations);
          saveToCache(data.conversations, this.cacheMeta(data)).catch(() => {});
          if (data.duplicates > 0) {
            this.showError('upload.dedup', { n: data.duplicates });
          }
          break;
        case 'error':
          state.set('loading', false);
          this.finishImport();
          if (data.code === 'parse_failed' && data.detail) {
            this.showError('upload.errorParseDetail', { detail: data.detail });
          } else {
            this.showError(this.errorMessageFor(data));
          }
          break;
        default:
          break;
      }
    };
    worker.onerror = () => {
      state.set('loading', false);
      this.finishImport();
      this.showError('upload.errorParse');
    };
    try {
      worker.postMessage({ files });
    } catch (err) {
      state.set('loading', false);
      this.finishImport();
      this.showError('upload.errorParse');
    }
  }

  cacheMeta(data) {
    const meta = Array.isArray(data.fileMeta) ? data.fileMeta : [];
    return {
      fileName: meta.map(m => m.fileName).filter(Boolean).join(', '),
      fileSize: meta.reduce((sum, m) => sum + (m.fileSize || 0), 0),
      convCount: data.conversations ? data.conversations.length : 0,
    };
  }

  /**
   * Resolve a worker error code to the active language at the UI boundary.
   * Unknown codes fall back to a generic parse error.
   */
  errorMessageFor(data) {
    const byCode = {
      unsupported_selected_file: 'upload.errorJson',
      unsupported_selected_zip: 'upload.errorMissingConvs',
      zip_read_failed: 'upload.errorZip',
      invalid_json: 'upload.errorShape',
      unsupported_shape: 'upload.errorShape',
      read_failed: 'upload.errorRead',
      parse_failed: 'upload.errorParse',
    };
    return byCode[data.code] || 'upload.errorParse';
  }

  setManifestData(manifest) {
    this.manifestData = manifest || null;
    this.renderManifestGuide();
  }

  /**
   * Render the persistent manifest guide into this.manifestSlot.
   *
   * Privacy:
   *   - No manifest URL, instructions string, or content is persisted or logged.
   *   - Instructions text is ignored entirely.
   *   - Each optional link is a user-initiated HTTPS claude.ai anchor only
   *     (noopener/noreferrer, built with DOM + textContent), validated
   *     independently. No fetch/prefetch/window.open.
   */
  renderManifestGuide() {
    const slot = this.manifestSlot;
    if (!slot) return;
    slot.textContent = '';
    const data = this.manifestData;
    if (!data) return;

    const card = document.createElement('section');
    card.className = 'manifest-card';
    card.setAttribute('aria-labelledby', 'manifest-title');

    const header = document.createElement('div');
    header.className = 'manifest-header';
    const icon = document.createElement('span');
    icon.className = 'manifest-header-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.appendChild(createIcon('file', 20));
    header.appendChild(icon);
    const heading = document.createElement('div');
    heading.className = 'manifest-heading';
    const title = document.createElement('h2');
    title.id = 'manifest-title';
    title.className = 'manifest-title';
    title.textContent = t('manifest.title');
    heading.appendChild(title);
    const summary = document.createElement('p');
    summary.className = 'manifest-summary';
    summary.textContent = t('manifest.totalFiles', { n: data.totalFiles });
    heading.appendChild(summary);
    header.appendChild(heading);
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'manifest-dismiss';
    dismiss.setAttribute('aria-label', t('manifest.dismiss'));
    dismiss.title = t('manifest.dismiss');
    const closeIcon = createIcon('close', 16);
    closeIcon.setAttribute('aria-hidden', 'true');
    dismiss.appendChild(closeIcon);
    dismiss.addEventListener('click', () => this.setManifestData(null));
    header.appendChild(dismiss);
    card.appendChild(header);

    if (data.conversationFiles && data.conversationFiles.length > 0) {
      const download = document.createElement('div');
      download.className = 'manifest-step';
      const stepHeader = document.createElement('div');
      stepHeader.className = 'manifest-step-header';
      const stepNumber = document.createElement('span');
      stepNumber.className = 'manifest-step-number';
      stepNumber.textContent = '01';
      stepHeader.appendChild(stepNumber);
      const listLabel = document.createElement('h3');
      listLabel.className = 'manifest-step-title';
      listLabel.textContent = t('manifest.files');
      stepHeader.appendChild(listLabel);
      const counts = document.createElement('span');
      counts.className = 'manifest-part-count';
      counts.textContent = t('manifest.partCount', { n: data.totalPartCount });
      stepHeader.appendChild(counts);
      download.appendChild(stepHeader);
      const body = document.createElement('p');
      body.className = 'manifest-step-body';
      body.textContent = t('manifest.body');
      download.appendChild(body);

      const ul = document.createElement('ul');
      ul.className = 'manifest-file-list';
      for (const f of data.conversationFiles) {
        const li = document.createElement('li');
        li.className = 'manifest-file';
        const fileIcon = createIcon('zip', 16);
        fileIcon.className = 'manifest-file-icon';
        fileIcon.setAttribute('aria-hidden', 'true');
        li.appendChild(fileIcon);
        const fileInfo = document.createElement('span');
        fileInfo.className = 'manifest-file-info';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'manifest-file-name';
        nameSpan.textContent = f.filename;
        fileInfo.appendChild(nameSpan);
        const part = document.createElement('span');
        part.className = 'manifest-file-part';
        part.textContent = t('manifest.part', { n: f.part });
        fileInfo.appendChild(part);
        li.appendChild(fileInfo);

        // Per-file link, each URL validated independently.
        if (this.isSafeClaudeUrl(f.exportUrl)) {
          const link = document.createElement('a');
          link.className = 'manifest-file-link';
          link.href = f.exportUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.setAttribute('aria-label', t('manifest.openFile', { filename: f.filename }));
          link.textContent = t('manifest.openLink') + ' ↗';
          li.appendChild(link);
        } else {
          const unavailable = document.createElement('span');
          unavailable.className = 'manifest-link-unavailable';
          unavailable.textContent = t('manifest.noLink');
          li.appendChild(unavailable);
        }
        ul.appendChild(li);
      }
      download.appendChild(ul);
      card.appendChild(download);

      const importStep = document.createElement('div');
      importStep.className = 'manifest-step manifest-import';
      const importHeader = document.createElement('div');
      importHeader.className = 'manifest-step-header';
      const importNumber = document.createElement('span');
      importNumber.className = 'manifest-step-number';
      importNumber.textContent = '02';
      importHeader.appendChild(importNumber);
      const importTitle = document.createElement('h3');
      importTitle.className = 'manifest-step-title';
      importTitle.textContent = t('manifest.importTitle');
      importHeader.appendChild(importTitle);
      importStep.appendChild(importHeader);
      const importBody = document.createElement('p');
      importBody.className = 'manifest-step-body';
      importBody.textContent = t('manifest.importBody');
      importStep.appendChild(importBody);
      card.appendChild(importStep);
    } else {
      // Manifest with no conversation parts: explain, don't just show "0".
      const none = document.createElement('p');
      none.className = 'manifest-empty';
      none.textContent = t('manifest.none');
      card.appendChild(none);
    }

    const privacy = document.createElement('div');
    privacy.className = 'manifest-privacy';
    const shield = createIcon('shield', 14);
    shield.setAttribute('aria-hidden', 'true');
    privacy.appendChild(shield);
    const privacyText = document.createElement('p');
    privacyText.textContent = t('manifest.privacy');
    privacy.appendChild(privacyText);
    card.appendChild(privacy);

    slot.appendChild(card);
  }

  isSafeClaudeUrl(url) {
    if (typeof url !== 'string' || url === '') return false;
    try {
      const u = new URL(url);
      if (u.username || u.password) return false;
      // Exact HTTPS claude.ai origin only: no subdomains, no nonstandard ports.
      return u.origin === 'https://claude.ai';
    } catch (e) {
      return false;
    }
  }

  showLoading() {
    const screen = document.getElementById('upload-screen');
    if (!screen) return;
    screen.textContent = '';
    screen.className = 'loading-screen';
    screen.setAttribute('aria-busy', 'true');

    // Clawd gif animation (random pick)
    const clawdContainer = document.createElement('div');
    clawdContainer.className = 'clawd-container';
    clawdContainer.id = 'clawd-container';
    clawdContainer.style.cssText = 'display:flex;align-items:center;justify-content:center;';

    const clawdGifs = [imgBubbles, imgCelebrate, imgIdea, imgLove, imgMusic, imgRepair, imgThinking, imgWatch];
    const idx = Math.floor(Math.random() * clawdGifs.length);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const gif = document.createElement('img');
      gif.src = clawdGifs[idx];
      gif.alt = t('loading.alt');
      gif.style.cssText = 'width:100px;height:100px;image-rendering:pixelated;';
      clawdContainer.appendChild(gif);
    }

    screen.appendChild(clawdContainer);

    const loadingText = document.createElement('div');
    loadingText.className = 'loading-text';
    loadingText.id = 'loading-text';
    loadingText.textContent = t('upload.loading');
    screen.appendChild(loadingText);

    const progressContainer = document.createElement('div');
    progressContainer.className = 'loading-progress';
    progressContainer.setAttribute('role', 'progressbar');
    progressContainer.setAttribute('aria-label', t('upload.loading'));
    progressContainer.setAttribute('aria-valuemin', '0');
    progressContainer.setAttribute('aria-valuemax', '100');
    progressContainer.setAttribute('aria-valuenow', '0');
    const progressBar = document.createElement('div');
    progressBar.className = 'loading-progress-bar';
    progressBar.id = 'loading-progress-bar';
    progressBar.style.width = '0%';
    progressContainer.appendChild(progressBar);
    screen.appendChild(progressContainer);
  }

  updateProgress(current, total) {
    const text = document.getElementById('loading-text');
    const bar = document.getElementById('loading-progress-bar');
    if (text) text.textContent = t('upload.loadingProgress', { current, total });
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    if (bar) bar.style.width = `${percent}%`;
    bar?.parentElement?.setAttribute('aria-valuenow', String(percent));
  }

  showUploadScreen() {
    this.container.textContent = '';
    this.render();
  }

  async checkCache(screen) {
    const info = await getCacheInfo();
    if (!info) return;

    // Insert cache banner before the upload zone
    const banner = document.createElement('div');
    banner.style.cssText = 'width:100%;max-width:504px;background:var(--bg-card);border:none;border-radius:20px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:var(--shadow);transition:box-shadow 0.2s,transform 0.2s;';
    banner.addEventListener('mouseenter', () => { banner.style.boxShadow = 'var(--shadow-sm)'; banner.style.transform = 'translateY(-1px)'; });
    banner.addEventListener('mouseleave', () => { banner.style.boxShadow = 'var(--shadow)'; banner.style.transform = ''; });

    const info_div = document.createElement('div');
    const title = document.createElement('div');
    title.style.cssText = 'font-size:13px;font-weight:600;color:var(--section-title-color, var(--text-muted));margin-bottom:3px;';
    title.textContent = t('upload.cacheFound');
    info_div.appendChild(title);

    const detail = document.createElement('div');
    detail.style.cssText = 'font-size:12px;color:var(--text-muted);';
    const date = new Date(info.parseDate);
    const sizeStr = info.fileSize > 1024 * 1024
      ? (info.fileSize / (1024 * 1024)).toFixed(1) + ' MB'
      : (info.fileSize / 1024).toFixed(0) + ' KB';
    detail.textContent = `${t('upload.cacheConvs', { n: info.convCount })} · ${sizeStr} · ${date.toLocaleString(getLang() === 'en' ? 'en-US' : 'zh-CN')}`;
    info_div.appendChild(detail);
    banner.appendChild(info_div);

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:8px;flex-shrink:0;';

    const loadBtn = document.createElement('button');
    loadBtn.style.cssText = 'padding:7px 14px;border:none;border-radius:var(--radius-sm);background:var(--btn-primary-bg, var(--text-secondary));color:var(--btn-primary-text, #fff);cursor:pointer;font-size:12px;font-weight:500;transition:all 0.2s;box-shadow:var(--shadow-xs);';
    loadBtn.addEventListener('mouseenter', () => { loadBtn.style.opacity = '0.85'; loadBtn.style.transform = 'translateY(-1px)'; loadBtn.style.boxShadow = 'var(--shadow-sm)'; });
    loadBtn.addEventListener('mouseleave', () => { loadBtn.style.opacity = '1'; loadBtn.style.transform = ''; loadBtn.style.boxShadow = 'var(--shadow-xs)'; });
    loadBtn.textContent = t('upload.cacheLoad');
    loadBtn.addEventListener('click', async () => {
      loadBtn.textContent = t('upload.cacheLoading');
      loadBtn.disabled = true;
      try {
        const cached = await loadFromCache();
        if (cached && cached.conversations.length > 0) {
          state.set('loading', false);
          state.set('conversations', cached.conversations);
        } else {
          this.showError('upload.cacheCorrupt');
          loadBtn.textContent = t('upload.cacheLoad');
          loadBtn.disabled = false;
        }
      } catch (e) {
        this.showRawError(t('upload.cacheFail') + e.message);
        loadBtn.textContent = t('upload.cacheLoad');
        loadBtn.disabled = false;
      }
    });
    btnGroup.appendChild(loadBtn);

    const clearBtn = document.createElement('button');
    clearBtn.style.cssText = 'padding:7px 14px;border:none;border-radius:var(--radius-sm);background:var(--bg-input);color:var(--text-secondary);cursor:pointer;font-size:12px;transition:all 0.2s;box-shadow:var(--shadow-xs);';
    clearBtn.addEventListener('mouseenter', () => { clearBtn.style.transform = 'translateY(-1px)'; clearBtn.style.boxShadow = 'var(--shadow-sm)'; });
    clearBtn.addEventListener('mouseleave', () => { clearBtn.style.transform = ''; clearBtn.style.boxShadow = 'var(--shadow-xs)'; });
    clearBtn.textContent = t('upload.cacheClear');
    clearBtn.addEventListener('click', async () => {
      await clearCache();
      banner.remove();
    });
    btnGroup.appendChild(clearBtn);

    banner.appendChild(btnGroup);

    // Insert after upload zone
    const uploadZone = screen.querySelector('.upload-zone');
    if (uploadZone && uploadZone.nextSibling) {
      screen.insertBefore(banner, uploadZone.nextSibling);
    } else {
      screen.appendChild(banner);
    }
  }

  /**
   * Show an error banner. `key` is an i18n key resolved in the active language
   * (both selectable languages are supported); an already-localized custom
   * message may also be passed for interpolated/raw strings.
   * @param {string} key
   * @param {Object} [vars]
   */
  showError(key, vars) {
    this.showRawError(vars ? t(key, vars) : t(key));
  }

  /** Show a pre-localized message string. */
  showRawError(text) {
    const banner = document.getElementById('upload-error');
    if (!banner) return;
    banner.textContent = String(text == null ? '' : text);
    banner.classList.remove('hidden');
    clearTimeout(this._errorTimer);
    this._errorTimer = setTimeout(() => banner.classList.add('hidden'), 7000);
  }
}
