/**
 * FileUpload component — drag-drop upload + Clawd loading animation.
 */

import { state } from '../store/state.js';
import { saveToCache, getCacheInfo, loadFromCache, clearCache } from '../utils/cache.js';
import ParseWorker from '../parser/worker.js?worker&inline';

export class FileUpload {
  constructor(container) {
    this.container = container;
    this.render();
  }

  render() {
    const screen = document.createElement('div');
    screen.className = 'upload-screen';
    screen.id = 'upload-screen';

    // Title
    const h1 = document.createElement('h1');
    h1.className = 'toolbar-title';
    h1.style.fontSize = '2.2rem';
    h1.textContent = 'Claude 对话记忆查看器';
    screen.appendChild(h1);

    const subtitle = document.createElement('p');
    subtitle.style.color = 'var(--text-secondary)';
    subtitle.style.marginTop = '-8px';
    subtitle.textContent = '上传 Claude 导出的 JSON 文件，回顾你的每一段对话';
    screen.appendChild(subtitle);

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
    saveBtn.textContent = '\uD83D\uDCBE 保存并应用';
    saveBtn.addEventListener('click', () => {
      const humanVal = document.getElementById('name-human')?.value || 'Synqa';
      const assistantVal = document.getElementById('name-assistant')?.value || 'Sylux';
      const newNames = { human: humanVal, assistant: assistantVal };
      state.set('displayNames', newNames);
      localStorage.setItem('cv-names', JSON.stringify(newNames));
      saveBtn.textContent = '\u2705 已保存';
      setTimeout(() => { saveBtn.textContent = '\uD83D\uDCBE 保存并应用'; }, 1500);
    });
    btnRow.appendChild(saveBtn);

    const resetBtn = document.createElement('button');
    resetBtn.style.cssText = 'padding:8px 20px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-input);color:var(--text-secondary);cursor:pointer;font-size:0.85rem;display:flex;align-items:center;gap:6px;';
    resetBtn.textContent = '\uD83D\uDD04 重置';
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
    banner.style.cssText = 'width:100%;max-width:560px;background:var(--accent-bg);border:1px solid var(--accent);border-radius:var(--radius);padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;';

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
