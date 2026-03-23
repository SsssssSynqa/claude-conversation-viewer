/**
 * FileUpload component — drag-drop upload + Clawd loading animation.
 */

import { state } from '../store/state.js';
import { saveToCache, getCacheInfo, loadFromCache, clearCache } from '../utils/cache.js';
import { createIcon } from '../utils/icons.js';
import ParseWorker from '../parser/worker.js?worker&inline';

// Claude spark logo SVG (hardcoded asset, safe)
const SPARK_SVG = '<svg overflow="visible" width="100%" height="100%" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M96 40L99.5 42l0 1.5-1 3.5-42.5 10-4-9.93L96 40z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(330deg) scaleY(1.09) rotate(-330deg)"/><path d="M80.1 10.59l4.9 1.03 1.3 1.6 1.24 3.84-.51 2.45L58.5 58.5 49 49l25.3-34.51 5.8-3.9z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(300deg) scaleY(.925) rotate(-300deg)"/><path d="M55.5 4.5l3-2 2.5 1 2.5 3.5-6.85 41.16L52 45l-2-5.5 3.5-31 2-4z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(270deg) scaleY(1.075) rotate(-270deg)"/><path d="M23.43 5.16l3.08-3.94 2.01-.46 3.99.58 1.97 1.54 14.35 31.8 5.19 15.11-6.07 3.38L24.8 11.19l-1.38-6.03z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(240deg) scaleY(.94) rotate(-240deg)"/><path d="M8.5 27l-1-4 3-3.5 3.5.5 1 0 21 15.5 6.5 5 9 7-5 8.5-4.5-3.5-3-3L10 29 8.5 27z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(210deg) scaleY(1.06) rotate(-210deg)"/><path d="M2.5 53L.24 50.5l0-2.22L2.5 47.5 28 49l25 2-.81 4.98L4.5 53.5 2.5 53z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(180deg) scaleY(.955) rotate(-180deg)"/><path d="M17.5 79.03H12.5l-2-2.29V74l8.5-6L53.5 46 57 52 17.5 79.03z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(150deg) scaleY(1.111) rotate(-150deg)"/><path d="M27 93l-2 .5-3-1.5.5-2.5L52 50.5 56 56 34 85l-7 8z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(120deg) scaleY(1.103) rotate(-120deg)"/><path d="M52 98l-1.5 2-3 1-2.5-2-1.5-3L51 56l4.5.5L52 98z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(90deg) scaleY(1.229) rotate(-90deg)"/><path d="M77.5 87v4l-.5 1.5-2 1-3.5-.47L47.47 57.26 57 50l8 14.5.75 5.25L77.5 87z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(60deg) scaleY(1.119) rotate(-60deg)"/><path d="M89 81l.5 2.5-1.5 2-1.5-.5-8.5-6-13-11.5-10-7 3-9.5 5 3 3 5.5 23 21.5z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(30deg) scaleY(1.082) rotate(-30deg)"/><path d="M82.5 55.5L95 56.5l3 2 2 3v2.16l-5.5 2.34L66.5 59 55 58.5l3-10.5 8 6 16.5 1.5z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(0deg) scaleY(.998) rotate(0deg)"/></svg>';

export class FileUpload {
  constructor(container) {
    this.container = container;
    this.render();
  }

  render() {
    const screen = document.createElement('div');
    screen.className = 'upload-screen';
    screen.id = 'upload-screen';

    // Title — Claude greeting style with spark logo
    const greetingRow = document.createElement('div');
    greetingRow.style.cssText = 'display:flex;align-items:center;gap:14px;justify-content:center;';

    // Spark logo (hardcoded SVG asset, safe for innerHTML)
    const sparkEl = document.createElement('span');
    sparkEl.style.cssText = 'width:42px;height:42px;display:inline-flex;color:var(--accent);flex-shrink:0;';
    const sparkTemplate = document.createElement('template');
    sparkTemplate.innerHTML = SPARK_SVG; // Safe: hardcoded constant, not user input
    sparkEl.appendChild(sparkTemplate.content);
    greetingRow.appendChild(sparkEl);

    const h1 = document.createElement('h1');
    h1.style.cssText = 'font-family:var(--font-display);font-size:2.5rem;font-weight:400;color:var(--text-primary);line-height:1.3;';
    h1.textContent = 'Claude 对话记忆查看器';
    greetingRow.appendChild(h1);
    screen.appendChild(greetingRow);

    const subtitle = document.createElement('p');
    subtitle.style.cssText = 'color:var(--text-muted);margin-top:4px;font-size:0.95rem;';
    subtitle.textContent = '上传 Claude 导出的 JSON 文件，回顾你的每一段对话';
    screen.appendChild(subtitle);

    // Theme switcher
    const themeSwitcher = document.createElement('div');
    themeSwitcher.style.cssText = 'display:flex;gap:6px;margin-top:12px;padding:4px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-card);';

    const themes = [
      { id: 'light', iconName: 'sun' },
      { id: 'dark', iconName: 'moon' },
      { id: 'claude', iconName: null }, // uses spark SVG
    ];

    for (const t of themes) {
      const btn = document.createElement('button');
      btn.dataset.theme = t.id;
      const isActive = state.get('theme') === t.id;
      btn.style.cssText = `display:flex;align-items:center;justify-content:center;width:36px;height:36px;border:none;border-radius:${parseInt(getComputedStyle(document.documentElement).getPropertyValue('--radius-sm')) || 8}px;cursor:pointer;transition:all var(--transition-fast);background:${isActive ? 'var(--accent-bg)' : 'transparent'};color:${isActive ? 'var(--accent)' : 'var(--text-muted)'};`;

      if (t.iconName) {
        btn.appendChild(createIcon(t.iconName, 18));
      } else {
        // Spark logo for Claude theme
        const sparkSmall = document.createElement('span');
        sparkSmall.style.cssText = 'width:18px;height:18px;display:inline-flex;';
        const st = document.createElement('template');
        st.innerHTML = SPARK_SVG; // Safe: hardcoded constant
        sparkSmall.appendChild(st.content);
        btn.appendChild(sparkSmall);
      }

      btn.addEventListener('click', () => {
        state.set('theme', t.id);
        // Update active states
        themeSwitcher.querySelectorAll('button').forEach(b => {
          const active = b.dataset.theme === t.id;
          b.style.background = active ? 'var(--accent-bg)' : 'transparent';
          b.style.color = active ? 'var(--accent)' : 'var(--text-muted)';
        });
      });

      themeSwitcher.appendChild(btn);
    }
    screen.appendChild(themeSwitcher);

    // Upload zone
    const zone = document.createElement('div');
    zone.className = 'upload-zone';
    zone.id = 'upload-zone';

    const icon = document.createElement('div');
    icon.className = 'upload-zone-icon';
    icon.textContent = '\uD83D\uDCC1';
    zone.appendChild(icon);

    const text = document.createElement('div');
    text.className = 'upload-zone-text';

    const line1 = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = '点击选择';
    line1.appendChild(strong);
    line1.appendChild(document.createTextNode(' 或拖拽 JSON 文件到这里'));
    text.appendChild(line1);

    const line2 = document.createElement('p');
    line2.style.fontSize = '0.85rem';
    line2.style.marginTop = '8px';
    line2.textContent = 'Claude Settings → Data Export → 下载的 conversations.json';
    text.appendChild(line2);

    zone.appendChild(text);

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
      if (file) this.handleFile(file);
    });

    screen.appendChild(zone);

    // Name config
    const nameConfig = document.createElement('div');
    nameConfig.className = 'name-config';

    const nameTitle = document.createElement('div');
    nameTitle.className = 'name-config-title';
    nameTitle.textContent = '显示名称设置';
    nameConfig.appendChild(nameTitle);

    const nameInputs = document.createElement('div');
    nameInputs.className = 'name-inputs';

    const names = state.get('displayNames');

    const humanGroup = this.createNameInput('用户显示名', names.human);
    humanGroup.querySelector('input').id = 'name-human';

    const assistantGroup = this.createNameInput('助手显示名', names.assistant);
    assistantGroup.querySelector('input').id = 'name-assistant';

    nameInputs.appendChild(humanGroup);
    nameInputs.appendChild(assistantGroup);
    nameConfig.appendChild(nameInputs);

    // Buttons row
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;margin-top:12px;';

    const saveBtn = document.createElement('button');
    saveBtn.style.cssText = 'padding:8px 20px;border:none;border-radius:var(--radius-sm);background:var(--gradient-header);color:#fff;cursor:pointer;font-size:0.85rem;font-weight:600;display:flex;align-items:center;gap:6px;';
    saveBtn.appendChild(createIcon('save', 14));
    saveBtn.appendChild(document.createTextNode(' 保存并应用'));
    saveBtn.addEventListener('click', () => {
      const humanVal = document.getElementById('name-human')?.value || 'Synqa';
      const assistantVal = document.getElementById('name-assistant')?.value || 'Sylux';
      const newNames = { human: humanVal, assistant: assistantVal };
      state.set('displayNames', newNames);
      localStorage.setItem('cv-names', JSON.stringify(newNames));
      saveBtn.textContent = '';
      saveBtn.appendChild(createIcon('check', 14));
      saveBtn.appendChild(document.createTextNode(' 已保存'));
      setTimeout(() => {
        saveBtn.textContent = '';
        saveBtn.appendChild(createIcon('save', 14));
        saveBtn.appendChild(document.createTextNode(' 保存并应用'));
      }, 1500);
    });
    btnRow.appendChild(saveBtn);

    const resetBtn = document.createElement('button');
    resetBtn.style.cssText = 'padding:8px 20px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-input);color:var(--text-secondary);cursor:pointer;font-size:0.85rem;display:flex;align-items:center;gap:6px;';
    resetBtn.appendChild(createIcon('reset', 14));
    resetBtn.appendChild(document.createTextNode(' 重置'));
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
      this.showError('请上传 JSON 格式的文件');
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
          this.showError('解析失败，请刷新页面重试');
        };
        worker.postMessage({ jsonString: e.target.result });
      } catch (err) {
        state.set('loading', false);
        this.showUploadScreen();
        this.showError('文件读取失败: ' + err.message);
      }
    };
    reader.onerror = () => {
      state.set('loading', false);
      this.showError('文件读取失败');
    };
    reader.readAsText(file);
  }

  showLoading() {
    const screen = document.getElementById('upload-screen');
    if (!screen) return;
    screen.textContent = '';
    screen.className = 'loading-screen';

    // Clawd crab animation
    const clawdContainer = document.createElement('div');
    clawdContainer.className = 'clawd-container';
    clawdContainer.id = 'clawd-container';

    const crab = document.createElement('div');
    crab.className = 'clawd-crab';
    clawdContainer.appendChild(crab);

    // Bubbles
    for (let i = 0; i < 5; i++) {
      const bubble = document.createElement('div');
      bubble.className = 'clawd-bubble';
      bubble.style.animationDelay = `${i * 0.4}s`;
      clawdContainer.appendChild(bubble);
    }

    screen.appendChild(clawdContainer);

    const loadingText = document.createElement('div');
    loadingText.className = 'loading-text';
    loadingText.id = 'loading-text';
    loadingText.textContent = '正在搬运你的记忆...';
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
    if (text) text.textContent = `正在搬运你的记忆... ${current}/${total} 段对话`;
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
    banner.style.cssText = 'width:100%;max-width:480px;background:var(--accent-bg);border:1px solid var(--accent);border-radius:var(--radius);padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;';

    const info_div = document.createElement('div');
    const title = document.createElement('div');
    title.style.cssText = 'font-size:0.9rem;font-weight:600;color:var(--accent);margin-bottom:4px;';
    title.textContent = '发现上次的数据缓存';
    info_div.appendChild(title);

    const detail = document.createElement('div');
    detail.style.cssText = 'font-size:0.78rem;color:var(--text-secondary);';
    const date = new Date(info.parseDate);
    const sizeStr = info.fileSize > 1024 * 1024
      ? (info.fileSize / (1024 * 1024)).toFixed(1) + ' MB'
      : (info.fileSize / 1024).toFixed(0) + ' KB';
    detail.textContent = `${info.convCount} 段对话 · ${sizeStr} · ${date.toLocaleString('zh-CN')}`;
    info_div.appendChild(detail);
    banner.appendChild(info_div);

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:8px;flex-shrink:0;';

    const loadBtn = document.createElement('button');
    loadBtn.style.cssText = 'padding:8px 16px;border:none;border-radius:var(--radius-sm);background:var(--accent);color:#fff;cursor:pointer;font-size:0.85rem;font-weight:600;';
    loadBtn.textContent = '加载缓存';
    loadBtn.addEventListener('click', async () => {
      loadBtn.textContent = '加载中...';
      loadBtn.disabled = true;
      try {
        const cached = await loadFromCache();
        if (cached && cached.conversations.length > 0) {
          state.set('loading', false);
          state.set('conversations', cached.conversations);
        } else {
          this.showError('缓存数据损坏，请重新上传');
        }
      } catch (e) {
        this.showError('加载缓存失败: ' + e.message);
        loadBtn.textContent = '加载缓存';
        loadBtn.disabled = false;
      }
    });
    btnGroup.appendChild(loadBtn);

    const clearBtn = document.createElement('button');
    clearBtn.style.cssText = 'padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:transparent;color:var(--text-muted);cursor:pointer;font-size:0.8rem;';
    clearBtn.textContent = '清除';
    clearBtn.addEventListener('click', async () => {
      await clearCache();
      banner.remove();
    });
    btnGroup.appendChild(clearBtn);

    banner.appendChild(btnGroup);

    // Insert before upload zone
    const uploadZone = screen.querySelector('.upload-zone');
    if (uploadZone) {
      screen.insertBefore(banner, uploadZone);
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
