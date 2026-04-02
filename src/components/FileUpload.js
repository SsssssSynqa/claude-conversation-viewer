/**
 * FileUpload component — drag-drop upload + Clawd loading animation.
 */

import { state } from '../store/state.js';
import { saveToCache, getCacheInfo, loadFromCache, clearCache } from '../utils/cache.js';
import { createIcon } from '../utils/icons.js';
import { SPARK_SVG } from '../utils/spark.js';
import { t } from '../i18n.js';
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
    this.render();
  }

  render() {
    const screen = document.createElement('div');
    screen.className = 'upload-screen';
    screen.id = 'upload-screen';

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
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    fileInput.id = 'file-input';
    zone.appendChild(fileInput);

    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this.handleFile(file);
    });
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (file) this.handleFile(file);
    });

    screen.appendChild(zone);

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

    const assistantGroup = this.createNameInput(t('upload.assistantName'), names.assistant);
    assistantGroup.querySelector('input').id = 'name-assistant';

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
    screen.appendChild(themeSwitcher);

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

  handleFile(file) {
    if (!file.name.endsWith('.json')) {
      this.showError(t('upload.errorJson'));
      return;
    }

    state.set('loading', true);
    this.showLoading();

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const worker = new ParseWorker();
        worker.onmessage = (msg) => {
          const data = msg.data;
          switch (data.type) {
            case 'progress':
              state.set('loadingProgress', { current: data.current, total: data.total });
              this.updateProgress(data.current, data.total);
              break;
            case 'done':
              state.set('loading', false);
              if (!data.conversations || data.conversations.length === 0) {
                this.showUploadScreen();
                this.showError(t('upload.errorEmpty'));
                worker.terminate();
                break;
              }
              state.set('conversations', data.conversations);
              // Cache parsed data for next visit
              saveToCache(data.conversations, {
                fileName: file.name,
                fileSize: file.size,
              }).catch(() => {});
              worker.terminate();
              break;
            case 'error':
              state.set('loading', false);
              this.showUploadScreen();
              this.showError(data.message);
              worker.terminate();
              break;
          }
        };
        worker.onerror = (err) => {
          // Worker crash — fallback to main thread
          state.set('loading', false);
          this.showUploadScreen();
          this.showError(t('upload.errorParse'));
          worker.terminate();
        };
        worker.postMessage({ jsonString: e.target.result });
      } catch (err) {
        state.set('loading', false);
        this.showUploadScreen();
        this.showError(t('upload.errorRead') + ': ' + err.message);
      }
    };
    reader.onerror = () => {
      state.set('loading', false);
      this.showUploadScreen();
      this.showError(t('upload.errorRead'));
    };
    reader.readAsText(file);
  }

  showLoading() {
    const screen = document.getElementById('upload-screen');
    if (!screen) return;
    screen.textContent = '';
    screen.className = 'loading-screen';

    // Clawd gif animation (random pick)
    const clawdContainer = document.createElement('div');
    clawdContainer.className = 'clawd-container';
    clawdContainer.id = 'clawd-container';
    clawdContainer.style.cssText = 'display:flex;align-items:center;justify-content:center;';

    const clawdGifs = [imgBubbles, imgCelebrate, imgIdea, imgLove, imgMusic, imgRepair, imgThinking, imgWatch];
    const idx = Math.floor(Math.random() * clawdGifs.length);
    const gif = document.createElement('img');
    gif.src = clawdGifs[idx];
    gif.alt = 'Clawd loading';
    gif.style.cssText = 'width:100px;height:100px;image-rendering:pixelated;';
    clawdContainer.appendChild(gif);

    screen.appendChild(clawdContainer);

    const loadingText = document.createElement('div');
    loadingText.className = 'loading-text';
    loadingText.id = 'loading-text';
    loadingText.textContent = t('upload.loading');
    screen.appendChild(loadingText);

    const progressContainer = document.createElement('div');
    progressContainer.className = 'loading-progress';
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
    if (bar) bar.style.width = `${(current / total) * 100}%`;
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
    detail.textContent = `${t('upload.cacheConvs', { n: info.convCount })} · ${sizeStr} · ${date.toLocaleString('zh-CN')}`;
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
          this.showError(t('upload.cacheCorrupt'));
          loadBtn.textContent = t('upload.cacheLoad');
          loadBtn.disabled = false;
        }
      } catch (e) {
        this.showError(t('upload.cacheFail') + e.message);
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

  showError(message) {
    const banner = document.getElementById('upload-error');
    if (banner) {
      banner.textContent = message;
      banner.classList.remove('hidden');
      setTimeout(() => banner.classList.add('hidden'), 5000);
    }
  }
}
