/**
 * MessageView — Right panel showing messages for selected conversation.
 * Features: all 6 content types, message-level copy/select, selection toolbar.
 */

import { state, saveExportCollection } from '../store/state.js';
import { renderMarkdown, escapeHtml } from '../utils/markdown.js';
import { formatTimestamp, formatShortTime, formatDate, getTimeDiffMinutes } from '../utils/time.js';
import { desensitize } from '../utils/desensitize.js';
import { createIcon } from '../utils/icons.js';
import { StatsPanel } from './StatsPanel.js';

export class MessageView {
  constructor(container) {
    this.container = container;
    this.statsPanel = new StatsPanel();
    this.selectedIndices = new Set();
    this.selectionToolbar = null;
    this.render();
    state.on('currentConversationIndex', () => { this.selectedIndices.clear(); this.renderConversation(); });
    state.on('showThinking', () => this.renderConversation());
    state.on('showToolUse', () => this.renderConversation());
    state.on('showFlags', () => this.renderConversation());
    state.on('displayNames', () => this.renderConversation());
    state.on('desensitize', () => this.renderConversation());
    state.on('desensitizeWords', () => { if (state.get('desensitize')) this.renderConversation(); });
  }

  render() {
    this.container.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;position:relative;';
    this.renderEmpty();
  }

  renderEmpty() {
    this.container.textContent = '';
    this.selectedIndices.clear();
    this._removeSelectionToolbar();
    const conversations = state.get('conversations') || [];
    if (conversations.length > 0) {
      this.statsPanel.renderInline(this.container);
    } else {
      const empty = document.createElement('div');
      empty.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:1.1rem;';
      empty.textContent = '\u2190 选择一段对话开始阅读';
      this.container.appendChild(empty);
    }
  }

  renderConversation() {
    const index = state.get('currentConversationIndex');
    const conversations = state.get('filteredConversations') || [];
    if (index < 0 || index >= conversations.length) {
      this.renderEmpty();
      return;
    }

    const conv = conversations[index];
    const names = state.get('displayNames');
    const showThinking = state.get('showThinking');
    const showToolUse = state.get('showToolUse');
    const showFlags = state.get('showFlags');

    this.container.textContent = '';
    this._removeSelectionToolbar();

    // Header with time span and export button
    const header = document.createElement('div');
    header.className = 'conv-header';
    header.style.cssText = 'padding:16px 24px;border-bottom:1px solid var(--border);flex-shrink:0;';

    const headerTop = document.createElement('div');
    headerTop.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;';

    const titleSection = document.createElement('div');
    titleSection.style.cssText = 'flex:1;min-width:0;';

    const titleEl = document.createElement('h2');
    titleEl.style.cssText = 'font-size:1.2rem;font-weight:600;margin-bottom:4px;';
    titleEl.textContent = conv.name || '未命名对话';
    titleSection.appendChild(titleEl);

    // Time span
    const timeSpan = document.createElement('div');
    timeSpan.style.cssText = 'font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;';
    const firstMsg = conv.messages[0];
    const lastMsg = conv.messages[conv.messages.length - 1];
    if (firstMsg?.createdAt && lastMsg?.createdAt) {
      timeSpan.textContent = formatTimestamp(firstMsg.createdAt) + ' \u2014 ' + formatTimestamp(lastMsg.createdAt);
    }
    titleSection.appendChild(timeSpan);

    const metaEl = document.createElement('div');
    metaEl.style.cssText = 'font-size:0.8rem;color:var(--text-muted);display:flex;gap:16px;flex-wrap:wrap;';
    const stats = [
      conv.stats.messageCount + ' 条消息',
      (names.human || 'Human') + ': ' + conv.stats.humanChars.toLocaleString() + ' 字',
      (names.assistant || 'Assistant') + ': ' + conv.stats.assistantChars.toLocaleString() + ' 字',
    ];
    if (conv.stats.hasThinking) stats.push('\uD83D\uDCAD ' + conv.stats.thinkingCount + ' 次思考');
    for (const s of stats) {
      const span = document.createElement('span');
      span.textContent = s;
      metaEl.appendChild(span);
    }
    titleSection.appendChild(metaEl);
    headerTop.appendChild(titleSection);

    // Header buttons
    const headerBtns = document.createElement('div');
    headerBtns.style.cssText = 'display:flex;gap:8px;flex-shrink:0;';

    // Add all to collection button
    const addAllBtn = document.createElement('button');
    addAllBtn.style.cssText = 'padding:6px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);background:transparent;color:var(--text-secondary);cursor:pointer;font-size:0.8rem;white-space:nowrap;transition:all 0.15s;';
    addAllBtn.appendChild(createIcon('star', 14));
    addAllBtn.appendChild(document.createTextNode(' 加入精选集'));
    addAllBtn.addEventListener('mouseenter', () => { addAllBtn.style.borderColor = 'var(--accent)'; addAllBtn.style.color = 'var(--accent)'; });
    addAllBtn.addEventListener('mouseleave', () => { addAllBtn.style.borderColor = 'var(--border)'; addAllBtn.style.color = 'var(--text-secondary)'; });
    addAllBtn.addEventListener('click', () => {
      const collection = state.get('exportCollection') || [];
      for (let i = 0; i < conv.messages.length; i++) {
        const msg = conv.messages[i];
        const key = conv.uuid + ':' + i;
        if (collection.some(item => item.key === key)) continue;
        collection.push({
          key,
          convUuid: conv.uuid,
          convName: conv.name || '未命名',
          msgIndex: i,
          sender: msg.sender,
          preview: (msg.searchText || '').substring(0, 80),
          timestamp: msg.createdAt,
        });
      }
      state.set('exportCollection', collection);
      saveExportCollection();
      addAllBtn.textContent = '';
      addAllBtn.appendChild(createIcon('check', 14));
      addAllBtn.appendChild(document.createTextNode(' 已加入'));
      setTimeout(() => {
        addAllBtn.textContent = '';
        addAllBtn.appendChild(createIcon('star', 14));
        addAllBtn.appendChild(document.createTextNode(' 加入精选集'));
      }, 1200);
    });
    headerBtns.appendChild(addAllBtn);

    // Export this conversation button with format dropdown
    const exportWrapper = document.createElement('div');
    exportWrapper.style.cssText = 'position:relative;flex-shrink:0;';

    const exportBtn = document.createElement('button');
    exportBtn.style.cssText = 'padding:6px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);background:transparent;color:var(--text-secondary);cursor:pointer;font-size:0.8rem;white-space:nowrap;transition:all 0.15s;';
    exportBtn.appendChild(createIcon('export', 14));
    exportBtn.appendChild(document.createTextNode(' 导出此对话 \u25BE'));
    exportBtn.addEventListener('mouseenter', () => { exportBtn.style.borderColor = 'var(--accent)'; exportBtn.style.color = 'var(--accent)'; });
    exportBtn.addEventListener('mouseleave', () => { if (!exportWrapper.querySelector('.export-dropdown:not(.hidden)')) { exportBtn.style.borderColor = 'var(--border)'; exportBtn.style.color = 'var(--text-secondary)'; }});
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = exportWrapper.querySelector('.export-dropdown');
      dropdown.classList.toggle('hidden');
    });
    exportWrapper.appendChild(exportBtn);

    const dropdown = document.createElement('div');
    dropdown.className = 'export-dropdown hidden';
    dropdown.style.cssText = 'position:absolute;right:0;top:100%;margin-top:4px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow);z-index:100;min-width:160px;overflow:hidden;';

    const formats = [
      { key: 'md', label: 'Markdown (.md)' },
      { key: 'txt', label: '纯文本 (.txt)' },
      { key: 'html', label: 'HTML (.html)' },
      { key: 'json', label: 'JSON (.json)' },
    ];
    for (const fmt of formats) {
      const item = document.createElement('div');
      item.style.cssText = 'padding:8px 14px;cursor:pointer;font-size:0.82rem;color:var(--text-secondary);transition:background 0.15s;';
      item.textContent = fmt.label;
      item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-card-hover)');
      item.addEventListener('mouseleave', () => item.style.background = '');
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.add('hidden');
        this._quickExportConversation(conv, fmt.key);
      });
      dropdown.appendChild(item);
    }
    exportWrapper.appendChild(dropdown);

    // Close dropdown on outside click
    document.addEventListener('click', () => dropdown.classList.add('hidden'));

    headerBtns.appendChild(exportWrapper);

    headerTop.appendChild(headerBtns);

    header.appendChild(headerTop);
    this.container.appendChild(header);

    // Messages scroll container
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'messages-scroll';
    scrollContainer.style.cssText = 'flex:1;overflow-y:auto;padding:16px 0;';

    let prevTimestamp = null;

    for (let mi = 0; mi < conv.messages.length; mi++) {
      const msg = conv.messages[mi];

      // Time separator
      if (prevTimestamp && msg.createdAt) {
        const diffMinutes = getTimeDiffMinutes(prevTimestamp, msg.createdAt);
        if (diffMinutes > 60) {
          const sep = document.createElement('div');
          sep.className = 'time-separator';
          sep.style.cssText = 'text-align:center;padding:16px 0;color:var(--text-muted);font-size:0.8rem;';
          const hours = Math.floor(diffMinutes / 60);
          sep.textContent = '\u2014 ' + (hours > 24 ? Math.floor(hours / 24) + ' 天后' : hours + ' 小时后') + ' \u2014';
          scrollContainer.appendChild(sep);
        }
      }
      prevTimestamp = msg.createdAt;

      const isHuman = msg.sender === 'human';
      const msgEl = document.createElement('div');
      msgEl.className = 'message-block ' + (isHuman ? 'message-human' : 'message-assistant');
      msgEl.dataset.msgIndex = mi;
      msgEl.style.cssText = 'padding:12px 24px;background:' + (isHuman ? 'var(--message-human-bg)' : 'var(--message-assistant-bg)') + ';border-bottom:1px solid var(--separator-color);position:relative;';

      // Selection checkbox (left side)
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'msg-select-checkbox';
      checkbox.checked = this.selectedIndices.has(mi);
      checkbox.style.cssText = 'position:absolute;left:4px;top:16px;accent-color:var(--accent);cursor:pointer;opacity:0.3;transition:opacity 0.15s;z-index:2;';
      checkbox.addEventListener('change', () => this._toggleSelect(mi, conv, checkbox));
      msgEl.appendChild(checkbox);

      // Make checkbox more visible on hover
      msgEl.addEventListener('mouseenter', () => {
        checkbox.style.opacity = '1';
        actionsBar.style.opacity = '1';
      });
      msgEl.addEventListener('mouseleave', () => {
        if (!this.selectedIndices.has(mi)) checkbox.style.opacity = '0.3';
        actionsBar.style.opacity = '0';
      });
      if (this.selectedIndices.has(mi)) {
        checkbox.style.opacity = '1';
        msgEl.style.outline = '2px solid var(--accent)';
        msgEl.style.outlineOffset = '-2px';
      }

      // Message header (sender name + time + action buttons)
      const msgHeader = document.createElement('div');
      msgHeader.className = 'message-header';
      msgHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';

      const senderEl = document.createElement('span');
      senderEl.className = 'message-sender';
      senderEl.style.cssText = 'font-weight:600;font-size:0.9rem;color:' + (isHuman ? 'var(--accent)' : 'var(--text-primary)') + ';';
      senderEl.textContent = isHuman ? (names.human || 'Human') : (names.assistant || 'Assistant');
      msgHeader.appendChild(senderEl);

      // Actions bar (copy, select-to-here, add to collection)
      const actionsBar = document.createElement('div');
      actionsBar.style.cssText = 'display:flex;gap:4px;opacity:0;transition:opacity 0.15s;align-items:center;';

      // Copy button
      const copyBtn = this._createActionBtn('复制', () => this._copyMessage(msg));
      actionsBar.appendChild(copyBtn);

      // Select to here
      const selectToBtn = this._createActionBtn('选择到这里', () => this._selectToHere(mi, conv));
      actionsBar.appendChild(selectToBtn);

      // Add to collection
      const addBtn = this._createActionBtn('+精选', () => this._addToCollection(conv, mi, msg));
      actionsBar.appendChild(addBtn);

      // Timestamp
      const timeEl = document.createElement('span');
      timeEl.className = 'message-time';
      timeEl.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-left:8px;';
      timeEl.textContent = formatTimestamp(msg.createdAt);

      actionsBar.appendChild(timeEl);
      msgHeader.appendChild(actionsBar);
      msgEl.appendChild(msgHeader);

      // Message bubble
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';

      if (msg.files.length > 0) {
        const filesEl = document.createElement('div');
        filesEl.style.cssText = 'margin-bottom:8px;display:flex;gap:8px;flex-wrap:wrap;';
        for (const fileName of msg.files) {
          const fileTag = document.createElement('span');
          fileTag.className = 'badge badge-tool';
          fileTag.textContent = '\uD83D\uDCCE ' + fileName;
          filesEl.appendChild(fileTag);
        }
        bubble.appendChild(filesEl);
      }

      for (const block of msg.contentBlocks) {
        switch (block.type) {
          case 'text': this.renderTextBlock(bubble, block); break;
          case 'thinking': if (showThinking) this.renderThinkingBlock(bubble, block); break;
          case 'tool_use': if (showToolUse) this.renderToolBlock(bubble, block); break;
          case 'tool_result': if (showToolUse) this.renderToolResultBlock(bubble, block); break;
          case 'flag': if (showFlags) this.renderFlagBlock(bubble, block); break;
        }
      }

      msgEl.appendChild(bubble);
      scrollContainer.appendChild(msgEl);
    }

    this.container.appendChild(scrollContainer);
    this._updateSelectionToolbar(conv);
  }

  // ---- Action Buttons ----

  _createActionBtn(text, onClick) {
    const btn = document.createElement('button');
    btn.style.cssText = 'padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-card);color:var(--text-muted);cursor:pointer;font-size:0.7rem;transition:all 0.15s;white-space:nowrap;';
    btn.textContent = text;
    btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'var(--accent)'; btn.style.color = 'var(--accent)'; });
    btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--text-muted)'; });
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return btn;
  }

  _copyMessage(msg) {
    let text = '';
    for (const block of msg.contentBlocks) {
      if (block.type === 'text') text += block.text + '\n';
      else if (block.type === 'thinking' && block.thinking) text += '\n[思考过程]\n' + block.thinking + '\n';
    }
    navigator.clipboard.writeText(text.trim()).catch(() => {});
  }

  _toggleSelect(mi, conv, checkbox) {
    if (this.selectedIndices.has(mi)) {
      this.selectedIndices.delete(mi);
    } else {
      this.selectedIndices.add(mi);
    }
    // Update visual state without full re-render
    const msgEl = this.container.querySelector(`[data-msg-index="${mi}"]`);
    if (msgEl) {
      if (this.selectedIndices.has(mi)) {
        msgEl.style.outline = '2px solid var(--accent)';
        msgEl.style.outlineOffset = '-2px';
        checkbox.style.opacity = '1';
      } else {
        msgEl.style.outline = 'none';
        checkbox.style.opacity = '0.3';
      }
    }
    this._updateSelectionToolbar(conv);
  }

  _selectToHere(mi, conv) {
    // Find the last selected index before this one, or start from 0
    let startIdx = 0;
    for (const idx of this.selectedIndices) {
      if (idx < mi && idx >= startIdx) startIdx = idx;
    }
    // If nothing selected before, start from 0
    if (this.selectedIndices.size === 0) startIdx = 0;

    // Select all messages from startIdx to mi
    for (let i = startIdx; i <= mi; i++) {
      this.selectedIndices.add(i);
    }
    // Update checkboxes visually
    const checkboxes = this.container.querySelectorAll('.msg-select-checkbox');
    checkboxes.forEach((cb, idx) => {
      cb.checked = this.selectedIndices.has(idx);
      const msgEl = cb.closest('.message-block');
      if (msgEl) {
        if (this.selectedIndices.has(idx)) {
          msgEl.style.outline = '2px solid var(--accent)';
          msgEl.style.outlineOffset = '-2px';
          cb.style.opacity = '1';
        } else {
          msgEl.style.outline = 'none';
        }
      }
    });
    this._updateSelectionToolbar(conv);
  }

  _addToCollection(conv, mi, msg) {
    const collection = state.get('exportCollection') || [];
    const key = conv.uuid + ':' + mi;
    // Avoid duplicates
    if (collection.some(item => item.key === key)) return;

    const preview = (msg.searchText || '').substring(0, 80);
    collection.push({
      key,
      convUuid: conv.uuid,
      convName: conv.name || '未命名',
      msgIndex: mi,
      sender: msg.sender,
      preview,
      timestamp: msg.createdAt,
    });
    state.set('exportCollection', collection);
    saveExportCollection();
  }

  // ---- Selection Toolbar (bottom bar) ----

  _updateSelectionToolbar(conv) {
    if (this.selectedIndices.size === 0) {
      this._removeSelectionToolbar();
      return;
    }
    this._removeSelectionToolbar();

    const toolbar = document.createElement('div');
    toolbar.id = 'selection-toolbar';
    toolbar.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 12px 24px;
      background: var(--bg-secondary);
      border-top: 2px solid var(--accent);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 50;
      box-shadow: 0 -4px 12px rgba(0,0,0,0.15);
    `;

    const info = document.createElement('span');
    info.style.cssText = 'font-size:0.85rem;color:var(--text-primary);font-weight:600;';
    info.textContent = '已选择 ' + this.selectedIndices.size + ' 条消息';
    toolbar.appendChild(info);

    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    toolbar.appendChild(spacer);

    // Copy selected
    const copyBtn = this._createToolbarBtn('复制', () => {
      const msgs = conv.messages;
      let text = '';
      const sorted = [...this.selectedIndices].sort((a, b) => a - b);
      const names = state.get('displayNames');
      for (const idx of sorted) {
        const msg = msgs[idx];
        const sender = msg.sender === 'human' ? (names.human || 'Human') : (names.assistant || 'Assistant');
        text += `[${sender}] ${formatTimestamp(msg.createdAt)}\n`;
        for (const block of msg.contentBlocks) {
          if (block.type === 'text') text += block.text + '\n';
          else if (block.type === 'thinking' && block.thinking) text += '\n[思考过程]\n' + block.thinking + '\n';
        }
        text += '\n---\n\n';
      }
      navigator.clipboard.writeText(text.trim()).catch(() => {});
    });
    toolbar.appendChild(copyBtn);

    // Add all to collection
    const addBtn = this._createToolbarBtn('加入精选集', () => {
      const collection = state.get('exportCollection') || [];
      const sorted = [...this.selectedIndices].sort((a, b) => a - b);
      for (const idx of sorted) {
        const msg = conv.messages[idx];
        const key = conv.uuid + ':' + idx;
        if (collection.some(item => item.key === key)) continue;
        collection.push({
          key,
          convUuid: conv.uuid,
          convName: conv.name || '未命名',
          msgIndex: idx,
          sender: msg.sender,
          preview: (msg.searchText || '').substring(0, 80),
          timestamp: msg.createdAt,
        });
      }
      state.set('exportCollection', collection);
      saveExportCollection();
      addBtn.textContent = '\u2713 已加入';
      setTimeout(() => { addBtn.textContent = '加入精选集'; }, 1200);
    });
    toolbar.appendChild(addBtn);

    // Export selected directly
    const exportBtn = this._createToolbarBtn('直接导出', () => {
      const sorted = [...this.selectedIndices].sort((a, b) => a - b);
      const selectedMsgs = sorted.map(idx => conv.messages[idx]);
      this._exportMessages(conv, selectedMsgs);
    });
    exportBtn.style.background = 'var(--accent)';
    exportBtn.style.color = '#fff';
    exportBtn.style.borderColor = 'var(--accent)';
    toolbar.appendChild(exportBtn);

    // Clear selection
    const clearBtn = this._createToolbarBtn('取消选择', () => {
      this.selectedIndices.clear();
      this.renderConversation();
    });
    toolbar.appendChild(clearBtn);

    this.container.appendChild(toolbar);
    this.selectionToolbar = toolbar;
  }

  _removeSelectionToolbar() {
    const existing = document.getElementById('selection-toolbar');
    if (existing) existing.remove();
    this.selectionToolbar = null;
  }

  _createToolbarBtn(text, onClick) {
    const btn = document.createElement('button');
    btn.style.cssText = 'padding:6px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);background:transparent;color:var(--text-secondary);cursor:pointer;font-size:0.82rem;transition:all 0.15s;white-space:nowrap;';
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  // ---- Quick Export ----

  _quickExportConversation(conv, format = 'md') {
    import('../utils/export.js').then(({ exportAsText, exportAsMarkdown, exportAsHTML, downloadFile }) => {
      const options = {
        includeThinking: state.get('showThinking'),
        includeToolUse: state.get('showToolUse'),
        includeFlags: state.get('showFlags'),
        displayNames: state.get('displayNames'),
      };
      const dateSuffix = new Date().toISOString().slice(0, 10);
      const nameBase = conv.name || '对话';
      let content, filename, mimeType;
      switch (format) {
        case 'txt':
          content = exportAsText([conv], options);
          filename = `${nameBase}_${dateSuffix}.txt`;
          mimeType = 'text/plain;charset=utf-8';
          break;
        case 'html':
          content = exportAsHTML([conv], options);
          filename = `${nameBase}_${dateSuffix}.html`;
          mimeType = 'text/html;charset=utf-8';
          break;
        case 'json':
          content = JSON.stringify([conv], null, 2);
          filename = `${nameBase}_${dateSuffix}.json`;
          mimeType = 'application/json;charset=utf-8';
          break;
        default:
          content = exportAsMarkdown([conv], options);
          filename = `${nameBase}_${dateSuffix}.md`;
          mimeType = 'text/markdown;charset=utf-8';
          break;
      }
      downloadFile(content, filename, mimeType);
    });
  }

  _exportMessages(conv, messages) {
    import('../utils/export.js').then(({ downloadFile }) => {
      const names = state.get('displayNames');
      let output = `# ${conv.name || '未命名对话'}（节选）\n\n`;
      for (const msg of messages) {
        const sender = msg.sender === 'human' ? (names.human || 'Human') : (names.assistant || 'Assistant');
        output += `## ${sender} (${formatTimestamp(msg.createdAt)})\n\n`;
        for (const block of msg.contentBlocks) {
          if (block.type === 'text') output += block.text + '\n\n';
          else if (block.type === 'thinking' && block.thinking) {
            output += `> \uD83D\uDCAD **思考过程**\n>\n`;
            for (const line of block.thinking.split('\n')) output += `> ${line}\n`;
            output += '\n';
          }
        }
        output += '---\n\n';
      }
      const dateSuffix = new Date().toISOString().slice(0, 10);
      downloadFile(output, `${conv.name || '对话'}_节选_${dateSuffix}.md`, 'text/markdown;charset=utf-8');
    });
  }

  // ---- Content Renderers (unchanged) ----

  renderTextBlock(parent, block) {
    const div = document.createElement('div');
    div.className = 'message-text';
    div.style.cssText = 'line-height:1.7;word-break:break-word;';
    const safeHtml = renderMarkdown(desensitize(block.text));
    const template = document.createElement('template');
    template.innerHTML = safeHtml;
    div.appendChild(template.content);
    parent.appendChild(div);
  }

  renderThinkingBlock(parent, block) {
    const details = document.createElement('details');
    details.className = 'thinking-block';
    details.style.cssText = 'margin:8px 0;background:var(--thinking-bg);border:1px solid var(--thinking-border);border-radius:var(--radius-sm);overflow:hidden;';
    const summary = document.createElement('summary');
    summary.style.cssText = 'padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--thinking-text);user-select:none;';
    summary.appendChild(document.createTextNode('\uD83D\uDCAD '));
    const label = document.createElement('span');
    label.style.fontWeight = '600';
    label.textContent = '思考过程';
    summary.appendChild(label);
    if (block.durationText) {
      const dur = document.createElement('span');
      dur.className = 'badge badge-thinking';
      dur.textContent = block.durationText;
      summary.appendChild(dur);
    }
    if (block.summaries && block.summaries.length > 0) {
      const summaryText = document.createElement('span');
      summaryText.style.cssText = 'color:var(--text-muted);font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;';
      summaryText.textContent = '\u2014 ' + block.summaries[0];
      summary.appendChild(summaryText);
    }
    details.appendChild(summary);
    const content = document.createElement('div');
    content.style.cssText = 'padding:12px 16px;font-size:0.85rem;line-height:1.6;color:var(--text-secondary);white-space:pre-wrap;word-break:break-word;max-height:400px;overflow-y:auto;';
    content.textContent = desensitize(block.thinking);
    details.appendChild(content);
    parent.appendChild(details);
  }

  renderToolBlock(parent, block) {
    const details = document.createElement('details');
    details.className = 'tool-block';
    details.style.cssText = 'margin:8px 0;background:var(--tool-bg);border:1px solid var(--tool-border);border-radius:var(--radius-sm);overflow:hidden;';
    const summary = document.createElement('summary');
    summary.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:0.85rem;color:var(--text-secondary);user-select:none;';
    summary.textContent = '\uD83D\uDD27 ' + (block.toolName || 'Tool');
    details.appendChild(summary);
    const content = document.createElement('div');
    content.style.cssText = 'padding:12px 16px;font-size:0.8rem;';
    if (block.toolInput && Object.keys(block.toolInput).length > 0) {
      const inputLabel = document.createElement('div');
      inputLabel.style.cssText = 'font-weight:600;margin-bottom:4px;color:var(--text-muted);';
      inputLabel.textContent = 'Input:';
      content.appendChild(inputLabel);
      const inputPre = document.createElement('pre');
      inputPre.style.cssText = 'background:var(--code-bg);padding:8px;border-radius:4px;overflow-x:auto;font-family:var(--font-mono);font-size:0.8rem;color:var(--text-secondary);';
      inputPre.textContent = JSON.stringify(block.toolInput, null, 2);
      content.appendChild(inputPre);
    }
    if (block.result) {
      const resultLabel = document.createElement('div');
      resultLabel.style.cssText = 'font-weight:600;margin:8px 0 4px;color:var(--text-muted);';
      resultLabel.textContent = 'Result:';
      content.appendChild(resultLabel);
      const resultPre = document.createElement('pre');
      resultPre.style.cssText = 'background:var(--code-bg);padding:8px;border-radius:4px;overflow-x:auto;font-family:var(--font-mono);font-size:0.8rem;color:var(--text-secondary);max-height:200px;overflow-y:auto;';
      resultPre.textContent = typeof block.result === 'string' ? block.result : JSON.stringify(block.result, null, 2);
      content.appendChild(resultPre);
    }
    details.appendChild(content);
    parent.appendChild(details);
  }

  renderToolResultBlock(parent, block) {
    const div = document.createElement('div');
    div.className = 'tool-result-block';
    div.style.cssText = 'margin:8px 0;background:var(--tool-bg);border:1px solid var(--tool-border);border-radius:var(--radius-sm);padding:12px 16px;';
    const label = document.createElement('div');
    label.style.cssText = 'font-size:0.8rem;font-weight:600;color:var(--text-muted);margin-bottom:4px;';
    label.textContent = '\uD83D\uDD27 Tool Result';
    div.appendChild(label);
    const pre = document.createElement('pre');
    pre.style.cssText = 'background:var(--code-bg);padding:8px;border-radius:4px;font-family:var(--font-mono);font-size:0.8rem;color:var(--text-secondary);max-height:200px;overflow:auto;';
    pre.textContent = typeof block.result === 'string' ? block.result : JSON.stringify(block.result, null, 2);
    div.appendChild(pre);
    parent.appendChild(div);
  }

  renderFlagBlock(parent, block) {
    const div = document.createElement('div');
    div.className = 'flag-block';
    div.style.cssText = 'margin:8px 0;background:var(--flag-bg);border:1px solid var(--flag-border);border-radius:var(--radius-sm);padding:8px 12px;display:flex;align-items:center;gap:8px;';
    const badge = document.createElement('span');
    badge.className = 'badge badge-flag';
    badge.textContent = '\u26A0\uFE0F ' + (block.flagType || 'flag');
    div.appendChild(badge);
    if (block.helpline) {
      const helpText = document.createElement('span');
      helpText.style.cssText = 'font-size:0.8rem;color:var(--text-muted);';
      helpText.textContent = block.helpline.name || '';
      div.appendChild(helpText);
    }
    parent.appendChild(div);
  }
}
