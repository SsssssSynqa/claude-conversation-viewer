/**
 * ExportPanel — Full-page export panel replacing the modal dialog.
 * Features: export collection ("精选集"), one-click export all, per-conversation export.
 */

import { state, saveExportCollection } from '../store/state.js';
import { exportAsText, exportAsMarkdown, exportAsHTML, downloadFile, encodeUTF8 } from '../utils/export.js';
import { formatTimestamp, formatDate, formatLocalDateStamp } from '../utils/time.js';
import JSZip from 'jszip';

export class ExportPanel {
  constructor() {
    this._unsubCollection = null;
    this.format = 'md';
    this.options = {
      includeThinking: true,
      includeToolUse: false,
      includeFlags: false,
      addBOM: true,
      filePrefix: '',
      fileSuffix: '',
    };
  }

  destroy() {
    this._unsubCollection?.();
    this._unsubCollection = null;
  }

  render(container) {
    // Clean up previous subscription
    this._unsubCollection?.();
    container.textContent = '';
    container.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding:20px 24px 16px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg-secondary);';

    const title = document.createElement('h2');
    title.style.cssText = 'font-size:1.15rem;font-weight:600;color:var(--text-primary);margin-bottom:12px;';
    title.textContent = '导出中心';
    header.appendChild(title);

    // Format + Options row
    const configRow = document.createElement('div');
    configRow.style.cssText = 'display:flex;gap:16px;align-items:center;flex-wrap:wrap;';

    // Format selector
    const formatGroup = document.createElement('div');
    formatGroup.style.cssText = 'display:flex;gap:6px;align-items:center;';
    const formatLabel = document.createElement('span');
    formatLabel.style.cssText = 'font-size:0.8rem;color:var(--text-muted);';
    formatLabel.textContent = '格式:';
    formatGroup.appendChild(formatLabel);

    const formats = [
      { value: 'md', label: 'Markdown' },
      { value: 'txt', label: '纯文本' },
      { value: 'html', label: 'HTML' },
      { value: 'json', label: 'JSON' },
    ];
    for (const fmt of formats) {
      const btn = document.createElement('button');
      btn.dataset.format = fmt.value;
      btn.style.cssText = 'padding:4px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:' + (fmt.value === this.format ? 'var(--accent-bg)' : 'transparent') + ';color:' + (fmt.value === this.format ? 'var(--accent)' : 'var(--text-secondary)') + ';cursor:pointer;font-size:0.8rem;transition:all 0.15s;';
      if (fmt.value === this.format) btn.style.borderColor = 'var(--accent)';
      btn.textContent = fmt.label;
      btn.addEventListener('click', () => {
        this.format = fmt.value;
        formatGroup.querySelectorAll('button').forEach(b => {
          const active = b.dataset.format === this.format;
          b.style.background = active ? 'var(--accent-bg)' : 'transparent';
          b.style.color = active ? 'var(--accent)' : 'var(--text-secondary)';
          b.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
        });
      });
      formatGroup.appendChild(btn);
    }
    configRow.appendChild(formatGroup);

    // Separator
    const sep = document.createElement('span');
    sep.style.cssText = 'width:1px;height:20px;background:var(--border);';
    configRow.appendChild(sep);

    // Options toggles (inline)
    const optToggles = [
      { key: 'includeThinking', label: '含思考' },
      { key: 'includeToolUse', label: '含工具' },
      { key: 'includeFlags', label: '含标记' },
      { key: 'addBOM', label: 'BOM (Excel兼容)' },
    ];
    for (const opt of optToggles) {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:0.8rem;color:var(--text-secondary);cursor:pointer;';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = this.options[opt.key];
      input.style.accentColor = 'var(--accent)';
      input.addEventListener('change', () => { this.options[opt.key] = input.checked; });
      label.appendChild(input);
      label.appendChild(document.createTextNode(opt.label));
      configRow.appendChild(label);
    }

    header.appendChild(configRow);

    // File naming row
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:10px;';

    const prefixLabel = document.createElement('span');
    prefixLabel.style.cssText = 'font-size:0.8rem;color:var(--text-muted);';
    prefixLabel.textContent = '文件名前缀:';
    nameRow.appendChild(prefixLabel);

    const prefixInput = document.createElement('input');
    prefixInput.type = 'text';
    prefixInput.placeholder = '可选';
    prefixInput.style.cssText = 'padding:4px 8px;background:var(--bg-input);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:0.8rem;width:100px;';
    prefixInput.addEventListener('input', () => { this.options.filePrefix = prefixInput.value; });
    nameRow.appendChild(prefixInput);

    const suffixLabel = document.createElement('span');
    suffixLabel.style.cssText = 'font-size:0.8rem;color:var(--text-muted);';
    suffixLabel.textContent = '后缀:';
    nameRow.appendChild(suffixLabel);

    const suffixInput = document.createElement('input');
    suffixInput.type = 'text';
    suffixInput.placeholder = '可选';
    suffixInput.style.cssText = 'padding:4px 8px;background:var(--bg-input);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:0.8rem;width:100px;';
    suffixInput.addEventListener('input', () => { this.options.fileSuffix = suffixInput.value; });
    nameRow.appendChild(suffixInput);

    header.appendChild(nameRow);
    container.appendChild(header);

    // Scrollable content
    const content = document.createElement('div');
    content.style.cssText = 'flex:1;overflow-y:auto;padding:16px 24px;';

    // ---- Section 1: Quick Actions ----
    const quickSection = document.createElement('div');
    quickSection.style.cssText = 'margin-bottom:24px;';

    const quickTitle = this._sectionTitle('快捷导出');
    quickSection.appendChild(quickTitle);

    const quickRow = document.createElement('div');
    quickRow.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;';

    const conversations = state.get('conversations') || [];

    const exportAllBtn = this._createExportBtn(
      '\uD83D\uDCE6 导出全部对话',
      conversations.length + ' 段对话',
      () => this._doExport(conversations)
    );
    quickRow.appendChild(exportAllBtn);

    // ZIP export
    const exportZipBtn = this._createExportBtn(
      '\uD83D\uDCE6 批量导出 ZIP',
      conversations.length + ' 段对话，每段一个文件',
      () => this._doZipExport(conversations)
    );
    quickRow.appendChild(exportZipBtn);

    const filtered = state.get('filteredConversations') || [];
    if (filtered.length !== conversations.length) {
      const exportFilteredBtn = this._createExportBtn(
        '\uD83D\uDD0D 导出筛选结果',
        filtered.length + ' 段对话',
        () => this._doExport(filtered)
      );
      quickRow.appendChild(exportFilteredBtn);
    }

    quickSection.appendChild(quickRow);
    content.appendChild(quickSection);

    // ---- Section 2: Export Collection ("精选集") ----
    const collectionSection = document.createElement('div');
    collectionSection.style.cssText = 'margin-bottom:24px;';
    collectionSection.id = 'export-collection-section';

    this._renderCollectionSection(collectionSection);
    // Subscribe to exportCollection changes so the section auto-refreshes
    this._unsubCollection = state.on('exportCollection', () => {
      this._renderCollectionSection(collectionSection);
    });
    content.appendChild(collectionSection);

    // ---- Section 3: Per-conversation Export ----
    const convSection = document.createElement('div');
    convSection.style.cssText = 'margin-bottom:24px;';

    const convTitle = this._sectionTitle('按对话导出（' + conversations.length + '）');
    convSection.appendChild(convTitle);

    const convList = document.createElement('div');
    convList.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

    for (const conv of conversations) {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);transition:background 0.15s;';
      item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-card-hover)');
      item.addEventListener('mouseleave', () => item.style.background = '');

      const info = document.createElement('div');
      info.style.cssText = 'min-width:0;flex:1;';

      const name = document.createElement('div');
      name.style.cssText = 'font-size:0.9rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;';
      name.textContent = conv.name || '未命名对话';
      info.appendChild(name);

      const meta = document.createElement('div');
      meta.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-top:2px;';
      const firstTs = conv.messages[0]?.createdAt;
      const lastTs = conv.messages[conv.messages.length - 1]?.createdAt;
      let metaText = conv.stats.messageCount + ' 条消息';
      if (firstTs && lastTs) {
        metaText += ' \u00B7 ' + formatTimestamp(firstTs) + ' \u2014 ' + formatTimestamp(lastTs);
      }
      meta.textContent = metaText;
      info.appendChild(meta);

      item.appendChild(info);

      const btn = document.createElement('button');
      btn.style.cssText = 'padding:4px 12px;border:1px solid var(--border);border-radius:4px;background:transparent;color:var(--text-muted);cursor:pointer;font-size:0.75rem;transition:all 0.15s;white-space:nowrap;flex-shrink:0;margin-left:12px;';
      btn.textContent = '导出';
      btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'var(--accent)'; btn.style.color = 'var(--accent)'; });
      btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--text-muted)'; });
      btn.addEventListener('click', () => this._doExport([conv]));
      item.appendChild(btn);

      convList.appendChild(item);
    }

    convSection.appendChild(convList);
    content.appendChild(convSection);

    container.appendChild(content);
  }

  _renderCollectionSection(section) {
    section.textContent = '';
    const collection = state.get('exportCollection') || [];

    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;';

    const title = this._sectionTitle('精选集（' + collection.length + ' 条）');
    title.style.marginBottom = '0';
    titleRow.appendChild(title);

    if (collection.length > 0) {
      const btnGroup = document.createElement('div');
      btnGroup.style.cssText = 'display:flex;gap:8px;';

      const exportBtn = document.createElement('button');
      exportBtn.style.cssText = 'padding:4px 12px;border:none;border-radius:4px;background:var(--accent);color:#fff;cursor:pointer;font-size:0.8rem;font-weight:600;';
      exportBtn.textContent = '导出精选集';
      exportBtn.addEventListener('click', () => this._exportCollection());
      btnGroup.appendChild(exportBtn);

      const clearBtn = document.createElement('button');
      clearBtn.style.cssText = 'padding:4px 12px;border:1px solid var(--border);border-radius:4px;background:transparent;color:var(--text-muted);cursor:pointer;font-size:0.8rem;';
      clearBtn.textContent = '清空';
      clearBtn.addEventListener('click', () => {
        state.set('exportCollection', []);
        saveExportCollection();
        this._renderCollectionSection(section);
      });
      btnGroup.appendChild(clearBtn);

      titleRow.appendChild(btnGroup);
    }
    section.appendChild(titleRow);

    if (collection.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:20px;text-align:center;color:var(--text-muted);font-size:0.85rem;border:1px dashed var(--border);border-radius:var(--radius-sm);';
      empty.textContent = '精选集为空。在对话中选择消息并点击"+精选"添加到这里。';
      section.appendChild(empty);
      return;
    }

    // Group by conversation
    const grouped = new Map();
    for (const item of collection) {
      if (!grouped.has(item.convUuid)) {
        grouped.set(item.convUuid, {
          convName: item.convName,
          items: [],
        });
      }
      grouped.get(item.convUuid).items.push(item);
    }

    for (const [, group] of grouped) {
      const { convName, items } = group;
      const groupEl = document.createElement('div');
      groupEl.style.cssText = 'border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;overflow:hidden;';

      const groupHeader = document.createElement('div');
      groupHeader.style.cssText = 'padding:8px 14px;background:var(--bg-secondary);font-size:0.82rem;font-weight:600;color:var(--accent);';
      groupHeader.textContent = convName + ' (' + items.length + ')';
      groupEl.appendChild(groupHeader);

      for (const item of items) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 14px;border-bottom:1px solid var(--separator-color);';

        const names = state.get('displayNames');
        const senderName = item.sender === 'human' ? (names.human || 'Human') : (names.assistant || 'Assistant');

        const info = document.createElement('div');
        info.style.cssText = 'min-width:0;flex:1;';

        const senderSpan = document.createElement('span');
        senderSpan.style.cssText = 'font-size:0.78rem;font-weight:600;color:' + (item.sender === 'human' ? 'var(--accent)' : 'var(--text-primary)') + ';margin-right:8px;';
        senderSpan.textContent = senderName;
        info.appendChild(senderSpan);

        const preview = document.createElement('span');
        preview.style.cssText = 'font-size:0.78rem;color:var(--text-muted);';
        preview.textContent = item.preview;
        info.appendChild(preview);

        row.appendChild(info);

        const removeBtn = document.createElement('button');
        removeBtn.style.cssText = 'padding:2px 8px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;font-size:0.75rem;';
        removeBtn.textContent = '\u2715';
        removeBtn.addEventListener('click', () => {
          const coll = state.get('exportCollection').filter(c => c.key !== item.key);
          state.set('exportCollection', coll);
          saveExportCollection();
          this._renderCollectionSection(section);
        });
        row.appendChild(removeBtn);

        groupEl.appendChild(row);
      }
      section.appendChild(groupEl);
    }
  }

  _exportCollection() {
    const collection = state.get('exportCollection') || [];
    if (collection.length === 0) return;

    const conversations = state.get('conversations') || [];
    const names = state.get('displayNames');
    const dateSuffix = formatLocalDateStamp();

    // JSON format — export raw message data
    if (this.format === 'json') {
      const jsonData = this._buildCollectionData(collection, conversations);
      downloadFile(JSON.stringify(jsonData, null, 2), `精选集_${dateSuffix}.json`, 'application/json;charset=utf-8');
      return;
    }

    // HTML format
    if (this.format === 'html') {
      const fakeConvs = this._buildCollectionAsConversations(collection, conversations);
      const content = exportAsHTML(fakeConvs, { ...this.options, displayNames: names });
      downloadFile(content, `精选集_${dateSuffix}.html`, 'text/html;charset=utf-8');
      return;
    }

    // Text and Markdown formats
    const isTxt = this.format === 'txt';
    const collectionConvs = this._buildCollectionAsConversations(collection, conversations);
    let output = isTxt ? '精选集导出\n' + '='.repeat(40) + '\n\n' : '# 精选集导出\n\n';

    output += isTxt
      ? exportAsText(collectionConvs, { ...this.options, displayNames: names })
      : exportAsMarkdown(collectionConvs, { ...this.options, displayNames: names });

    const ext = isTxt ? 'txt' : 'md';
    const mime = isTxt ? 'text/plain;charset=utf-8' : 'text/markdown;charset=utf-8';
    downloadFile(output, `精选集_${dateSuffix}.${ext}`, mime);
  }

  _buildCollectionData(collection, conversations) {
    const result = [];
    const grouped = new Map();
    for (const item of collection) {
      if (!grouped.has(item.convUuid)) grouped.set(item.convUuid, []);
      grouped.get(item.convUuid).push(item);
    }
    for (const [convUuid, items] of grouped) {
      const conv = conversations.find(c => c.uuid === convUuid);
      if (!conv) continue;
      const msgs = items.sort((a, b) => a.msgIndex - b.msgIndex).map(item => conv.messages[item.msgIndex]).filter(Boolean);
      result.push({ name: conv.name, uuid: conv.uuid, messages: msgs });
    }
    return result;
  }

  _buildCollectionAsConversations(collection, conversations) {
    const grouped = new Map();
    for (const item of collection) {
      if (!grouped.has(item.convUuid)) grouped.set(item.convUuid, []);
      grouped.get(item.convUuid).push(item);
    }
    const result = [];
    for (const [convUuid, items] of grouped) {
      const conv = conversations.find(c => c.uuid === convUuid);
      if (!conv) continue;
      const msgs = items.sort((a, b) => a.msgIndex - b.msgIndex).map(item => conv.messages[item.msgIndex]).filter(Boolean);
      result.push({ ...conv, messages: msgs, stats: { ...conv.stats, messageCount: msgs.length } });
    }
    return result;
  }

  _buildFilename(nameBase) {
    const dateSuffix = formatLocalDateStamp();
    const prefix = this.options.filePrefix ? this.options.filePrefix + '_' : '';
    const suffix = this.options.fileSuffix ? '_' + this.options.fileSuffix : '';
    const extMap = { md: '.md', txt: '.txt', html: '.html', json: '.json' };
    const safeBase = this._sanitizeFilename(nameBase);
    return `${prefix}${safeBase}_${dateSuffix}${suffix}${extMap[this.format] || '.md'}`;
  }

  _exportContent(conversations) {
    const options = { ...this.options, displayNames: state.get('displayNames') };
    switch (this.format) {
      case 'txt': return exportAsText(conversations, options);
      case 'html': return exportAsHTML(conversations, options);
      case 'json': return JSON.stringify(conversations, null, 2);
      default: return exportAsMarkdown(conversations, options);
    }
  }

  _doExport(conversations) {
    const nameBase = conversations.length === 1 ? (conversations[0].name || '对话') : '对话导出';
    const content = this._exportContent(conversations);
    const filename = this._buildFilename(nameBase);
    const mimeMap = { md: 'text/markdown', txt: 'text/plain', html: 'text/html', json: 'application/json' };
    downloadFile(content, filename, (mimeMap[this.format] || 'text/plain') + ';charset=utf-8', this.options.addBOM);
  }

  async _doZipExport(conversations) {
    const zip = new JSZip();
    const options = { ...this.options, displayNames: state.get('displayNames') };
    const extMap = { md: '.md', txt: '.txt', html: '.html', json: '.json' };
    const ext = extMap[this.format] || '.md';

    for (let i = 0; i < conversations.length; i++) {
      const conv = conversations[i];
      const name = this._sanitizeFilename(conv.name || '未命名_' + i);
      let content;
      switch (this.format) {
        case 'txt': content = exportAsText([conv], options); break;
        case 'html': content = exportAsHTML([conv], options); break;
        case 'json': content = JSON.stringify([conv], null, 2); break;
        default: content = exportAsMarkdown([conv], options); break;
      }
      const isText = ['txt', 'md', 'json'].includes(this.format);
      zip.file(name + ext, isText ? encodeUTF8(content, this.options.addBOM) : content);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '对话导出_' + formatLocalDateStamp() + '.zip';
    a.click();
    URL.revokeObjectURL(url);
  }

  _sectionTitle(text) {
    const el = document.createElement('div');
    el.style.cssText = 'font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);font-weight:600;margin-bottom:12px;';
    el.textContent = text;
    return el;
  }

  _createExportBtn(text, sub, onClick) {
    const btn = document.createElement('button');
    btn.style.cssText = 'padding:14px 20px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-card);cursor:pointer;text-align:left;transition:all 0.15s;min-width:180px;';
    btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'var(--accent)'; btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; });
    btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'var(--border)'; btn.style.boxShadow = 'none'; });

    const mainText = document.createElement('div');
    mainText.style.cssText = 'font-size:0.9rem;color:var(--text-primary);font-weight:600;margin-bottom:4px;';
    mainText.textContent = text;
    btn.appendChild(mainText);

    const subText = document.createElement('div');
    subText.style.cssText = 'font-size:0.75rem;color:var(--text-muted);';
    subText.textContent = sub;
    btn.appendChild(subText);

    btn.addEventListener('click', onClick);
    return btn;
  }

  _sanitizeFilename(name) {
    return (name || '对话').replace(/[/\\?%*:|"<>]/g, '_').trim().slice(0, 120) || '对话';
  }
}
