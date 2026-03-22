/**
 * ExportDialog — Modal for export options.
 */

import { state } from '../store/state.js';
import { exportAsText, exportAsMarkdown, exportAsHTML, downloadFile } from '../utils/export.js';

export class ExportDialog {
  constructor() {
    this.overlay = null;
  }

  show() {
    if (this.overlay) this.overlay.remove();

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--bg-card);border-radius:var(--radius-lg);padding:32px;max-width:480px;width:90%;box-shadow:var(--shadow);';

    // Title
    const title = document.createElement('h3');
    title.style.cssText = 'font-size:1.1rem;margin-bottom:20px;color:var(--text-primary);';
    title.textContent = '导出对话';
    modal.appendChild(title);

    // Scope info
    const conversations = state.get('filteredConversations') || [];
    const currentIdx = state.get('currentConversationIndex');
    const selected = state.get('selectedConversations');

    const scopeInfo = document.createElement('p');
    scopeInfo.style.cssText = 'font-size:0.85rem;color:var(--text-secondary);margin-bottom:16px;';
    if (currentIdx >= 0 && currentIdx < conversations.length) {
      scopeInfo.textContent = '导出当前对话: ' + (conversations[currentIdx].name || '未命名');
    } else {
      scopeInfo.textContent = '导出全部 ' + conversations.length + ' 段对话';
    }
    modal.appendChild(scopeInfo);

    // Scope selector
    const scopeDiv = document.createElement('div');
    scopeDiv.style.cssText = 'margin-bottom:16px;';

    const scopeLabel = document.createElement('div');
    scopeLabel.style.cssText = 'font-size:0.8rem;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;';
    scopeLabel.textContent = '导出范围';
    scopeDiv.appendChild(scopeLabel);

    const scopeSelect = document.createElement('select');
    scopeSelect.id = 'export-scope';
    scopeSelect.style.cssText = 'width:100%;padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:0.9rem;';

    if (currentIdx >= 0) {
      const opt1 = document.createElement('option');
      opt1.value = 'current';
      opt1.textContent = '当前对话';
      scopeSelect.appendChild(opt1);
    }
    const opt2 = document.createElement('option');
    opt2.value = 'all';
    opt2.textContent = '全部对话 (' + conversations.length + ')';
    scopeSelect.appendChild(opt2);

    scopeDiv.appendChild(scopeSelect);
    modal.appendChild(scopeDiv);

    // Format selector
    const formatDiv = document.createElement('div');
    formatDiv.style.cssText = 'margin-bottom:16px;display:flex;gap:8px;';

    const formats = [
      { value: 'md', label: 'Markdown (.md)' },
      { value: 'txt', label: '纯文本 (.txt)' },
      { value: 'html', label: 'HTML (.html)' },
    ];

    for (const fmt of formats) {
      const btn = document.createElement('button');
      btn.dataset.format = fmt.value;
      btn.style.cssText = 'flex:1;padding:10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-input);color:var(--text-primary);cursor:pointer;font-size:0.85rem;transition:all 0.2s;';
      btn.textContent = fmt.label;
      btn.addEventListener('click', () => {
        formatDiv.querySelectorAll('button').forEach(b => {
          b.style.borderColor = 'var(--border)';
          b.style.background = 'var(--bg-input)';
        });
        btn.style.borderColor = 'var(--accent)';
        btn.style.background = 'var(--accent-bg)';
      });
      if (fmt.value === 'md') {
        btn.style.borderColor = 'var(--accent)';
        btn.style.background = 'var(--accent-bg)';
      }
      formatDiv.appendChild(btn);
    }
    modal.appendChild(formatDiv);

    // Options checkboxes
    const optionsDiv = document.createElement('div');
    optionsDiv.style.cssText = 'margin-bottom:20px;display:flex;flex-direction:column;gap:8px;';

    const checkboxes = [
      { id: 'exp-thinking', label: '包含思考过程 (COT)', checked: true },
      { id: 'exp-tools', label: '包含工具调用', checked: false },
      { id: 'exp-flags', label: '包含系统标记', checked: false },
    ];

    for (const cb of checkboxes) {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-secondary);cursor:pointer;';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = cb.id;
      input.checked = cb.checked;
      input.style.accentColor = 'var(--accent)';
      label.appendChild(input);
      label.appendChild(document.createTextNode(cb.label));
      optionsDiv.appendChild(label);
    }
    modal.appendChild(optionsDiv);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;justify-content:flex-end;';

    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'padding:10px 20px;border:1px solid var(--border);border-radius:var(--radius-sm);background:transparent;color:var(--text-secondary);cursor:pointer;font-size:0.9rem;';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', () => this.hide());
    btnRow.appendChild(cancelBtn);

    const exportBtn = document.createElement('button');
    exportBtn.style.cssText = 'padding:10px 24px;border:none;border-radius:var(--radius-sm);background:var(--accent);color:#fff;cursor:pointer;font-size:0.9rem;font-weight:600;';
    exportBtn.textContent = '导出';
    exportBtn.addEventListener('click', () => this.doExport());
    btnRow.appendChild(exportBtn);

    modal.appendChild(btnRow);
    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);
  }

  hide() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  doExport() {
    const conversations = state.get('filteredConversations') || [];
    const currentIdx = state.get('currentConversationIndex');
    const scope = document.getElementById('export-scope');
    const scopeValue = scope ? scope.value : 'all';

    let toExport;
    if (scopeValue === 'current' && currentIdx >= 0 && currentIdx < conversations.length) {
      toExport = [conversations[currentIdx]];
    } else {
      toExport = conversations;
    }

    const formatBtns = this.overlay.querySelectorAll('[data-format]');
    let format = 'md';
    for (const btn of formatBtns) {
      if (btn.style.borderColor === 'var(--accent)') {
        format = btn.dataset.format;
        break;
      }
    }

    const options = {
      includeThinking: document.getElementById('exp-thinking')?.checked ?? true,
      includeToolUse: document.getElementById('exp-tools')?.checked ?? false,
      includeFlags: document.getElementById('exp-flags')?.checked ?? false,
      displayNames: state.get('displayNames'),
    };

    let content, filename, mimeType;
    const dateSuffix = new Date().toISOString().slice(0, 10);
    const nameBase = toExport.length === 1 ? (toExport[0].name || '对话') : '对话导出';

    switch (format) {
      case 'txt':
        content = exportAsText(toExport, options);
        filename = `${nameBase}_${dateSuffix}.txt`;
        mimeType = 'text/plain;charset=utf-8';
        break;
      case 'md':
        content = exportAsMarkdown(toExport, options);
        filename = `${nameBase}_${dateSuffix}.md`;
        mimeType = 'text/markdown;charset=utf-8';
        break;
      case 'html':
        content = exportAsHTML(toExport, options);
        filename = `${nameBase}_${dateSuffix}.html`;
        mimeType = 'text/html;charset=utf-8';
        break;
    }

    downloadFile(content, filename, mimeType);
    this.hide();
  }
}
