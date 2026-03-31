/**
 * MessageView — Right panel showing messages for selected conversation.
 * Two modes: View (default) and Select (for batch operations).
 */

import { state, saveExportCollection } from '../store/state.js';
import { renderMarkdown, escapeHtml } from '../utils/markdown.js';
import { formatTimestamp, formatShortTime, formatDate, formatLocalDateStamp, getTimeDiffMinutes } from '../utils/time.js';
import { desensitize } from '../utils/desensitize.js';
import { createIcon } from '../utils/icons.js';
import { StatsPanel } from './StatsPanel.js';
import { showLoading, hideLoading } from './Loading.js';
import { t } from '../i18n.js';

export class MessageView {
  constructor(container) {
    this.container = container;
    this.statsPanel = new StatsPanel();
    this.selectedIndices = new Set();
    this.selectMode = false;
    this.unsubscribers = [];
    this.activeExportDropdown = null;
    this.handleDocumentClick = (e) => {
      if (!this.activeExportDropdown) return;
      if (this.activeExportDropdown.wrapper.contains(e.target)) return;
      this.activeExportDropdown.dropdown.classList.add('hidden');
      this.activeExportDropdown = null;
    };
    document.addEventListener('click', this.handleDocumentClick);
    this.render();
    this.unsubscribers.push(
      state.on('currentConversationIndex', () => { this.selectedIndices.clear(); this.selectMode = false; this.renderConversation(); }),
      state.on('showThinking', () => this.renderConversation()),
      state.on('showToolUse', () => this.renderConversation()),
      state.on('showFlags', () => this.renderConversation()),
      state.on('displayNames', () => this.renderConversation()),
      state.on('desensitize', () => this.renderConversation()),
      state.on('desensitizeWords', () => { if (state.get('desensitize')) this.renderConversation(); }),
      state.on('highlightMessageIndex', () => this._applyHighlightFromState()),
      state.on('exportCollection', () => this.renderConversation()),
      state.on('theme', () => this.renderConversation()),
    );
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
      empty.textContent = t('msgView.empty');
      this.container.appendChild(empty);
    }
  }

  renderConversation() {
    const index = state.get('currentConversationIndex');
    const conversations = state.get('filteredConversations') || [];
    if (index < 0 || index >= conversations.length) { this.renderEmpty(); return; }

    const conv = conversations[index];
    const names = state.get('displayNames');
    const showThinking = state.get('showThinking');
    const showToolUse = state.get('showToolUse');
    const showFlags = state.get('showFlags');
    const collection = state.get('exportCollection') || [];
    const allMessageKeys = conv.messages.map((_, i) => conv.uuid + ':' + i);
    const allInCollection = allMessageKeys.length > 0 && allMessageKeys.every(key => collection.some(item => item.key === key));

    this.container.textContent = '';
    this._removeSelectionToolbar();

    // ---- Header ----
    const header = document.createElement('div');
    header.className = 'message-header-card';
    header.style.cssText = 'flex-shrink:0;';

    const headerTop = document.createElement('div');
    headerTop.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;';

    const titleSection = document.createElement('div');
    titleSection.style.cssText = 'flex:1;min-width:0;';
    const titleEl = document.createElement('h2');
    titleEl.style.cssText = 'font-family:var(--font-display);font-size:1.2rem;font-weight:400;margin-bottom:4px;';
    titleEl.textContent = conv.name || t('msgView.unnamed');
    titleSection.appendChild(titleEl);

    // Time span
    const firstMsg = conv.messages[0];
    const lastMsg = conv.messages[conv.messages.length - 1];
    if (firstMsg?.createdAt && lastMsg?.createdAt) {
      const timeSpan = document.createElement('div');
      timeSpan.style.cssText = 'font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;';
      timeSpan.textContent = formatTimestamp(firstMsg.createdAt) + ' \u2014 ' + formatTimestamp(lastMsg.createdAt);
      titleSection.appendChild(timeSpan);
    }

    const metaEl = document.createElement('div');
    metaEl.style.cssText = 'font-size:0.78rem;color:var(--text-muted);display:flex;gap:12px;flex-wrap:wrap;';
    const statItems = [conv.stats.messageCount + t('msgView.msgCount'), (names.human || 'Human') + ': ' + conv.stats.humanChars.toLocaleString() + ' 字', (names.assistant || 'Assistant') + ': ' + conv.stats.assistantChars.toLocaleString() + ' 字'];
    if (conv.stats.hasThinking) statItems.push(conv.stats.thinkingCount + ' 次思考');
    for (const s of statItems) { const sp = document.createElement('span'); sp.textContent = s; metaEl.appendChild(sp); }
    titleSection.appendChild(metaEl);
    headerTop.appendChild(titleSection);

    // Header buttons
    const headerBtns = document.createElement('div');
    headerBtns.style.cssText = 'display:flex;gap:8px;flex-shrink:0;align-items:center;flex-wrap:wrap;justify-content:flex-end;';

    // Toggle switch — pill shape with sliding circle
    const toggleOuter = document.createElement('div');
    toggleOuter.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;cursor:pointer;';

    const toggleLabel = document.createElement('span');
    toggleLabel.style.cssText = 'font-size:0.75rem;color:var(--text-muted);user-select:none;';
    toggleLabel.textContent = this.selectMode ? t('msgView.selectMode') : t('msgView.viewMode');

    const toggleTrack = document.createElement('div');
    toggleTrack.style.cssText = `width:44px;height:24px;border-radius:12px;position:relative;transition:background 0.2s;${this.selectMode ? 'background:var(--accent);' : 'background:var(--border-strong);'}`;

    const toggleThumb = document.createElement('div');
    toggleThumb.style.cssText = `width:20px;height:20px;border-radius:50%;background:#fff;position:absolute;top:2px;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2);${this.selectMode ? 'left:22px;' : 'left:2px;'}`;
    toggleTrack.appendChild(toggleThumb);

    toggleOuter.appendChild(toggleLabel);
    toggleOuter.appendChild(toggleTrack);
    toggleOuter.addEventListener('click', () => {
      this.selectMode = !this.selectMode;
      if (!this.selectMode) this.selectedIndices.clear();
      this.renderConversation();
    });
    headerBtns.appendChild(toggleOuter);

    // Add all to collection
    const addAllBtn = this._headerBtn(allInCollection ? t('msgView.addedToCollection') : t('msgView.addToCollection'), allInCollection ? 'check' : 'star', () => {
      const collection = state.get('exportCollection') || [];
      for (let i = 0; i < conv.messages.length; i++) {
        const msg = conv.messages[i];
        const key = conv.uuid + ':' + i;
        if (collection.some(item => item.key === key)) continue;
        collection.push({ key, convUuid: conv.uuid, convName: conv.name || t('msgView.unnamed2'), msgIndex: i, sender: msg.sender, preview: (msg.searchText || '').substring(0, 80), timestamp: msg.createdAt });
      }
      state.set('exportCollection', collection);
      saveExportCollection();
    });
    headerBtns.appendChild(addAllBtn);

    // Export dropdown
    const exportWrapper = document.createElement('div');
    exportWrapper.style.cssText = 'position:relative;';
    const exportBtn = this._headerBtn(t('msgView.exportThis'), 'export');
    exportBtn.appendChild(document.createTextNode(' \u25BE'));
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = dropdown.classList.contains('hidden');
      if (this.activeExportDropdown && this.activeExportDropdown.dropdown !== dropdown) {
        this.activeExportDropdown.dropdown.classList.add('hidden');
      }
      dropdown.classList.toggle('hidden');
      this.activeExportDropdown = willOpen ? { wrapper: exportWrapper, dropdown } : null;
    });
    exportWrapper.appendChild(exportBtn);

    const dropdown = document.createElement('div');
    dropdown.className = 'export-dropdown hidden';
    dropdown.style.cssText = 'position:absolute;right:0;top:100%;margin-top:4px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow);z-index:100;min-width:160px;overflow:hidden;';
    for (const fmt of [{key:'md',label:'Markdown'},{key:'txt',label:'纯文本'},{key:'html',label:'HTML'},{key:'json',label:'JSON'}]) {
      const item = document.createElement('div');
      item.style.cssText = 'padding:8px 14px;cursor:pointer;font-size:0.82rem;color:var(--text-secondary);transition:background 0.15s;';
      item.textContent = fmt.label;
      item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-card-hover)');
      item.addEventListener('mouseleave', () => item.style.background = '');
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.add('hidden');
        this.activeExportDropdown = null;
        this._quickExportConversation(conv, fmt.key);
      });
      dropdown.appendChild(item);
    }
    exportWrapper.appendChild(dropdown);
    headerBtns.appendChild(exportWrapper);

    headerTop.appendChild(headerBtns);
    header.appendChild(headerTop);
    this.container.appendChild(header);

    // ---- Messages ----
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'messages-scroll';
    scrollContainer.style.cssText = 'flex:1;overflow-y:auto;padding:16px 0;';

    let prevTimestamp = null;

    for (let mi = 0; mi < conv.messages.length; mi++) {
      const msg = conv.messages[mi];
      const msgKey = conv.uuid + ':' + mi;
      const isCollected = collection.some(item => item.key === msgKey);

      // Time separator
      if (prevTimestamp && msg.createdAt) {
        const diffMinutes = getTimeDiffMinutes(prevTimestamp, msg.createdAt);
        if (diffMinutes > 60) {
          const sep = document.createElement('div');
          sep.className = 'time-separator';
          sep.style.cssText = 'text-align:center;padding:16px 0;color:var(--text-muted);font-size:0.8rem;';
          const hours = Math.floor(diffMinutes / 60);
          sep.textContent = '\u2014 ' + (hours > 24 ? Math.floor(hours / 24) + t('msgView.daysLater') : hours + t('msgView.hoursLater')) + ' \u2014';
          scrollContainer.appendChild(sep);
        }
      }
      prevTimestamp = msg.createdAt;

      const isHuman = msg.sender === 'human';
      const isClaude = state.get('theme') === 'claude';
      const msgEl = document.createElement('div');
      msgEl.className = 'message-block ' + (isHuman ? 'message-human' : 'message-assistant');
      msgEl.dataset.msgIndex = mi;
      // Claude theme: let CSS handle all styling (no inline bg)
      if (isClaude) {
        msgEl.style.cssText = 'position:relative;';
      } else {
        msgEl.style.cssText = 'position:relative;background:' + (isHuman ? 'var(--message-human-bg)' : 'var(--message-assistant-bg)') + ';';
      }

      // Selection checkbox (only in select mode)
      if (this.selectMode) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = this.selectedIndices.has(mi);
        checkbox.style.cssText = 'position:absolute;left:6px;top:14px;accent-color:var(--accent);cursor:pointer;z-index:2;';
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) this.selectedIndices.add(mi);
          else this.selectedIndices.delete(mi);
          this._updateSelectionToolbar(conv);
          // Visual feedback
          msgEl.style.outline = checkbox.checked ? '2px solid var(--accent)' : 'none';
          msgEl.style.outlineOffset = '-2px';
        });
        msgEl.appendChild(checkbox);
        if (this.selectedIndices.has(mi)) {
          msgEl.style.outline = '2px solid var(--accent)';
          msgEl.style.outlineOffset = '-2px';
        }
      }

      // Sender name
      const senderEl = document.createElement('div');
      senderEl.className = 'message-sender';
      if (isClaude) {
        // Claude theme: no sender name for either human or assistant (matches official)
        senderEl.style.cssText = 'display:none;';
      } else {
        senderEl.style.cssText = 'font-weight:600;font-size:0.85rem;margin-bottom:6px;display:flex;align-items:center;gap:6px;color:' + (isHuman ? 'var(--accent)' : 'var(--text-primary)') + ';';
        senderEl.appendChild(createIcon(isHuman ? 'user' : 'bot', 14));
        senderEl.appendChild(document.createTextNode(isHuman ? (names.human || 'Human') : (names.assistant || 'Assistant')));
      }
      msgEl.appendChild(senderEl);

      // Message content
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';

      if (msg.files.length > 0) {
        const filesEl = document.createElement('div');
        filesEl.style.cssText = 'margin-bottom:8px;display:flex;gap:8px;flex-wrap:wrap;';
        for (const fileName of msg.files) {
          const fileTag = document.createElement('span');
          fileTag.className = 'badge badge-tool';
          fileTag.textContent = fileName;
          filesEl.appendChild(fileTag);
        }
        bubble.appendChild(filesEl);
      }

      if (isClaude && !isHuman) {
        // Claude theme: group thinking+tool into a timeline, text renders separately
        const timelineBlocks = [];
        const textBlocks = [];
        const flagBlocks = [];
        for (const block of msg.contentBlocks) {
          if (block.type === 'thinking' && showThinking) timelineBlocks.push(block);
          else if ((block.type === 'tool_use' || block.type === 'tool_result') && showToolUse) timelineBlocks.push(block);
          else if (block.type === 'text') textBlocks.push(block);
          else if (block.type === 'flag' && showFlags) flagBlocks.push(block);
        }
        if (timelineBlocks.length > 0) this._renderClaudeTimeline(bubble, timelineBlocks);
        for (const block of textBlocks) this.renderTextBlock(bubble, block);
        for (const block of flagBlocks) this.renderFlagBlock(bubble, block);
      } else {
        for (const block of msg.contentBlocks) {
          switch (block.type) {
            case 'text': this.renderTextBlock(bubble, block); break;
            case 'thinking': if (showThinking) this.renderThinkingBlock(bubble, block); break;
            case 'tool_use': if (showToolUse) this.renderToolBlock(bubble, block); break;
            case 'tool_result': if (showToolUse) this.renderToolResultBlock(bubble, block); break;
            case 'flag': if (showFlags) this.renderFlagBlock(bubble, block); break;
          }
        }
      }
      msgEl.appendChild(bubble);

      // ---- Message Footer: timestamp + action buttons ----
      const footer = document.createElement('div');
      if (isClaude) {
        footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:4px;opacity:0;height:0;overflow:hidden;transition:all 0.15s;';
      } else {
        footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:12px;opacity:0.55;transition:opacity 0.15s;';
      }

      const timeEl = document.createElement('span');
      timeEl.style.cssText = 'font-size:0.72rem;color:var(--text-muted);';
      timeEl.textContent = formatTimestamp(msg.createdAt);
      footer.appendChild(timeEl);

      const actionBtns = document.createElement('div');
      actionBtns.style.cssText = 'display:flex;gap:4px;';

      actionBtns.appendChild(this._createActionBtn('复制', () => this._copyMessage(msg)));
      actionBtns.appendChild(this._createActionBtn(isCollected ? '已精选' : '+精选', () => {
        if (isCollected) return;
        this._addToCollection(conv, mi, msg);
        // Auto enter select mode and select this message
        if (!this.selectMode) {
          this.selectMode = true;
          this.selectedIndices.add(mi);
          this.renderConversation();
        }
      }, isCollected));
      actionBtns.appendChild(this._createActionBtn('选择到这里', () => {
        if (!this.selectMode) { this.selectMode = true; }
        this._selectToHere(mi, conv);
        this.renderConversation();
      }));

      footer.appendChild(actionBtns);
      msgEl.appendChild(footer);

      // Show footer on hover
      if (isClaude) {
        msgEl.addEventListener('mouseenter', () => { footer.style.opacity = '1'; footer.style.height = 'auto'; footer.style.overflow = 'visible'; });
        msgEl.addEventListener('mouseleave', () => { footer.style.opacity = '0'; footer.style.height = '0'; footer.style.overflow = 'hidden'; });
      } else {
        msgEl.addEventListener('mouseenter', () => footer.style.opacity = '1');
        msgEl.addEventListener('mouseleave', () => { if (!footer.dataset.pinned) footer.style.opacity = '0.55'; });
      }

      scrollContainer.appendChild(msgEl);
    }

    this.container.appendChild(scrollContainer);
    if (this.selectMode) this._updateSelectionToolbar(conv);
    this._applyHighlightFromState();
  }

  // ---- Header Button Helper ----
  _headerBtn(text, iconName, onClick) {
    const btn = document.createElement('button');
    btn.className = 'neu-ghost-btn';
    btn.style.cssText = 'font-size:0.78rem;white-space:nowrap;transition:all 0.15s;display:flex;align-items:center;gap:4px;';
    if (iconName) btn.appendChild(createIcon(iconName, 13));
    btn.appendChild(document.createTextNode(' ' + text));
    btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'var(--accent)'; btn.style.color = 'var(--accent)'; });
    btn.addEventListener('mouseleave', () => { if (!btn.dataset.active) { btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--text-secondary)'; }});
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
  }

  // ---- Action Buttons ----
  _createActionBtn(text, onClick, active = false) {
    const btn = document.createElement('button');
    btn.className = 'neu-ghost-btn';
    btn.style.cssText = 'padding:4px 10px;font-size:0.7rem;transition:all 0.15s;white-space:nowrap;';
    btn.textContent = text;
    if (active) {
      btn.dataset.active = 'true';
      btn.style.color = 'var(--accent)';
      btn.style.borderColor = 'var(--accent)';
    }
    btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'var(--accent)'; btn.style.color = 'var(--accent)'; });
    btn.addEventListener('mouseleave', () => {
      if (!btn.dataset.active) {
        btn.style.borderColor = 'var(--border)';
        btn.style.color = 'var(--text-muted)';
      }
    });
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

  _selectToHere(mi, conv) {
    // Find the closest selected index before mi as the range start
    let startIdx = -1;
    for (const idx of this.selectedIndices) { if (idx < mi && idx > startIdx) startIdx = idx; }
    // If no selected index before mi, start from mi itself
    if (startIdx < 0) startIdx = mi;
    for (let i = startIdx; i <= mi; i++) this.selectedIndices.add(i);
  }

  _addToCollection(conv, mi, msg) {
    const collection = state.get('exportCollection') || [];
    const key = conv.uuid + ':' + mi;
    if (collection.some(item => item.key === key)) return;
    collection.push({ key, convUuid: conv.uuid, convName: conv.name || t('msgView.unnamed2'), msgIndex: mi, sender: msg.sender, preview: (msg.searchText || '').substring(0, 80), timestamp: msg.createdAt });
    state.set('exportCollection', collection);
    saveExportCollection();
  }

  // ---- Selection Toolbar (bottom bar, only in select mode) ----
  _updateSelectionToolbar(conv) {
    this._removeSelectionToolbar();
    if (!this.selectMode || this.selectedIndices.size === 0) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'selection-toolbar';
    toolbar.className = 'selection-toolbar';
    toolbar.style.cssText = 'display:flex;align-items:center;gap:12px;z-index:50;';

    const info = document.createElement('span');
    info.style.cssText = 'font-size:0.85rem;color:var(--text-primary);font-weight:600;';
    info.textContent = '已选 ' + this.selectedIndices.size + ' 条';
    toolbar.appendChild(info);

    toolbar.appendChild(Object.assign(document.createElement('div'), { style: 'flex:1;' }));

    toolbar.appendChild(this._toolbarBtn('复制', () => {
      const sorted = [...this.selectedIndices].sort((a, b) => a - b);
      const names = state.get('displayNames');
      let text = '';
      for (const idx of sorted) {
        const msg = conv.messages[idx];
        const sender = msg.sender === 'human' ? (names.human || 'Human') : (names.assistant || 'Assistant');
        text += `[${sender}] ${formatTimestamp(msg.createdAt)}\n`;
        for (const block of msg.contentBlocks) { if (block.type === 'text') text += block.text + '\n'; }
        text += '\n---\n\n';
      }
      navigator.clipboard.writeText(text.trim()).catch(() => {});
    }));

    toolbar.appendChild(this._toolbarBtn('加入精选集', () => {
      const collection = state.get('exportCollection') || [];
      for (const idx of this.selectedIndices) {
        const msg = conv.messages[idx];
        const key = conv.uuid + ':' + idx;
        if (collection.some(item => item.key === key)) continue;
        collection.push({ key, convUuid: conv.uuid, convName: conv.name || t('msgView.unnamed2'), msgIndex: idx, sender: msg.sender, preview: (msg.searchText || '').substring(0, 80), timestamp: msg.createdAt });
      }
      state.set('exportCollection', collection);
      saveExportCollection();
    }));

    const exportBtn = this._toolbarBtn('导出选中', () => this._exportMessages(conv, [...this.selectedIndices].sort((a, b) => a - b).map(idx => conv.messages[idx])));
    exportBtn.style.background = 'var(--accent)'; exportBtn.style.color = '#fff'; exportBtn.style.borderColor = 'var(--accent)';
    toolbar.appendChild(exportBtn);

    toolbar.appendChild(this._toolbarBtn('取消', () => { this.selectMode = false; this.selectedIndices.clear(); this.renderConversation(); }));

    this.container.appendChild(toolbar);
  }

  _removeSelectionToolbar() { document.getElementById('selection-toolbar')?.remove(); }

  _toolbarBtn(text, onClick) {
    const btn = document.createElement('button');
    btn.className = 'neu-ghost-btn';
    btn.style.cssText = 'font-size:0.82rem;transition:all 0.15s;white-space:nowrap;';
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  // ---- Quick Export ----
  _quickExportConversation(conv, format = 'md') {
    import('../utils/export.js').then(({ exportAsText, exportAsMarkdown, exportAsHTML, downloadFile }) => {
      const options = { includeThinking: state.get('showThinking'), includeToolUse: state.get('showToolUse'), includeFlags: state.get('showFlags'), displayNames: state.get('displayNames') };
      const dateSuffix = formatLocalDateStamp();
      const nameBase = this._sanitizeFilename(conv.name || '对话');
      let content, filename, mimeType;
      switch (format) {
        case 'txt': content = exportAsText([conv], options); filename = `${nameBase}_${dateSuffix}.txt`; mimeType = 'text/plain;charset=utf-8'; break;
        case 'html': content = exportAsHTML([conv], options); filename = `${nameBase}_${dateSuffix}.html`; mimeType = 'text/html;charset=utf-8'; break;
        case 'json': content = JSON.stringify([conv], null, 2); filename = `${nameBase}_${dateSuffix}.json`; mimeType = 'application/json;charset=utf-8'; break;
        default: content = exportAsMarkdown([conv], options); filename = `${nameBase}_${dateSuffix}.md`; mimeType = 'text/markdown;charset=utf-8'; break;
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
          if (block.type === 'text') output += this._toMarkdownCodeBlock(block.text) + '\n\n';
          else if (block.type === 'thinking' && block.thinking) output += `> 思考过程\n\n${this._toMarkdownCodeBlock(block.thinking)}\n\n`;
        }
        output += '---\n\n';
      }
      const dateSuffix = formatLocalDateStamp();
      const safeName = this._sanitizeFilename(conv.name || '对话');
      downloadFile(output, `${safeName}_节选_${dateSuffix}.md`, 'text/markdown;charset=utf-8');
    });
  }

  _sanitizeFilename(name) {
    return (name || '对话').replace(/[/\\?%*:|"<>]/g, '_').trim().slice(0, 120) || '对话';
  }

  _toMarkdownCodeBlock(text) {
    const content = text || '';
    const matches = Array.from(content.matchAll(/`{3,}/g));
    const fenceLength = matches.length > 0 ? Math.max(...matches.map(m => m[0].length)) + 1 : 3;
    const fence = '`'.repeat(fenceLength);
    return `${fence}text\n${content}\n${fence}`;
  }

  _applyHighlightFromState() {
    const msgIndex = state.get('highlightMessageIndex');
    if (msgIndex === undefined || msgIndex === null || msgIndex < 0) return;

    requestAnimationFrame(() => {
      const messagesScroll = this.container.querySelector('.messages-scroll');
      if (!messagesScroll) return;

      const messageBlocks = messagesScroll.querySelectorAll('.message-block');
      const targetBlock = messageBlocks[msgIndex];
      if (!targetBlock) return;

      targetBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetBlock.style.transition = 'box-shadow 0.3s, outline 0.3s';
      targetBlock.style.outline = '2px solid var(--accent)';
      targetBlock.style.boxShadow = '0 0 12px var(--accent-bg)';

      setTimeout(() => {
        targetBlock.style.outline = 'none';
        targetBlock.style.boxShadow = 'none';
      }, 2500);

      state.set('highlightMessageIndex', null);
    });
  }

  destroy() {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    document.removeEventListener('click', this.handleDocumentClick);
    this.activeExportDropdown = null;
  }

  // ---- Content Renderers ----
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

  /** Claude theme: timeline-style thinking/tool rendering (precise claude.ai replica) */
  _renderClaudeTimeline(parent, blocks) {
    const thinkingBlocks = blocks.filter(b => b.type === 'thinking');
    const toolBlocks = blocks.filter(b => b.type === 'tool_use' || b.type === 'tool_result');
    const lastThinking = thinkingBlocks[thinkingBlocks.length - 1];
    const summaryText = lastThinking?.summaries?.[0] || (toolBlocks.length > 0 ? toolBlocks[0].toolName : 'Thinking...');

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin:8px 0 4px;font-family:var(--font-anthropic-ui);';

    // Chevron SVG (down arrow, rotated -90 when collapsed) — exact claude.ai path
    const makeChevronSvg = () => {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '16');
      svg.setAttribute('viewBox', '0 0 20 20');
      svg.setAttribute('fill', 'currentColor');
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', 'M14.128 7.165a.502.502 0 0 1 .744.67l-4.5 5-.078.07a.5.5 0 0 1-.666-.07l-4.5-5-.06-.082a.501.501 0 0 1 .729-.656l.075.068L10 11.752z');
      svg.appendChild(path);
      return svg;
    };

    // Summary button — 10.5px, sans-serif, muted color, with SVG chevron
    const summaryBtn = document.createElement('button');
    summaryBtn.style.cssText = 'display:inline-flex;align-items:center;gap:3px;cursor:pointer;color:var(--text-muted);font-size:10.5px;line-height:1.4;font-family:var(--font-anthropic-ui);user-select:none;border:none;background:none;padding:3px 6px;margin-left:-6px;border-radius:6px;transition:background 0.15s;';
    summaryBtn.addEventListener('mouseenter', () => summaryBtn.style.background = 'var(--sidebar-hover)');
    summaryBtn.addEventListener('mouseleave', () => summaryBtn.style.background = 'none');

    const summarySpan = document.createElement('span');
    summarySpan.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    summarySpan.textContent = summaryText;

    const chevronWrap = document.createElement('span');
    chevronWrap.style.cssText = 'display:inline-flex;flex-shrink:0;transition:transform 0.2s;transform:rotate(-90deg);';
    chevronWrap.appendChild(makeChevronSvg());

    summaryBtn.appendChild(summarySpan);
    summaryBtn.appendChild(chevronWrap);
    wrapper.appendChild(summaryBtn);

    // Timeline container (initially hidden)
    const timeline = document.createElement('div');
    timeline.style.cssText = 'margin-top:4px;padding-left:2px;display:none;overflow:hidden;transition:max-height 0.3s ease-out;';

    let isExpanded = false;
    summaryBtn.addEventListener('click', () => {
      isExpanded = !isExpanded;
      timeline.style.display = isExpanded ? 'block' : 'none';
      chevronWrap.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
    });

    // Build timeline node data
    const items = [];
    for (const block of blocks) {
      if (block.type === 'thinking') {
        const text = block.summaries?.[0] || (block.thinking ? block.thinking.substring(0, 120) + '\u2026' : 'Thinking...');
        items.push({ type: 'thinking', text, detail: block.thinking });
      } else if (block.type === 'tool_use') {
        items.push({ type: 'tool', text: block.toolName || 'Tool', detail: block.toolInput ? JSON.stringify(block.toolInput, null, 2) : '' });
      } else if (block.type === 'tool_result') {
        items.push({ type: 'result', text: typeof block.result === 'string' ? block.result.substring(0, 80) : 'Result', detail: typeof block.result === 'string' ? block.result : JSON.stringify(block.result, null, 2) });
      }
    }

    // Icon: 16x16 container, 20x20 SVG fill, color text-500 (muted)
    // Connector line: 1px wide, bg-border-300 rgba(31,30,29,0.15)
    const makeStepIcon = (type) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'width:16px;height:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--text-muted);';
      const icon = createIcon(type === 'thinking' ? 'clock' : type === 'done' ? 'check' : 'tool', 14);
      icon.style.cssText = 'color:var(--text-muted);';
      wrap.appendChild(icon);
      return wrap;
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isLast = i === items.length - 1;

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;';

      // Left: icon column (flex col, 16px wide, pt-1)
      const iconCol = document.createElement('div');
      iconCol.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:16px;flex-shrink:0;padding-top:3px;';
      iconCol.appendChild(makeStepIcon(item.type));

      if (!isLast) {
        const line = document.createElement('div');
        line.style.cssText = 'width:1px;flex:1;margin-top:3px;background:rgba(31,30,29,0.15);';
        iconCol.appendChild(line);
      }
      row.appendChild(iconCol);

      // Right: text (10.5px, text-200 color, sans-serif)
      const textCol = document.createElement('div');
      textCol.style.cssText = 'flex:1;padding-top:2px;font-size:10.5px;line-height:1.4;color:var(--text-secondary);min-width:0;font-family:var(--font-anthropic-ui);';
      textCol.textContent = item.text;

      if (item.detail && item.type === 'thinking') {
        textCol.style.cursor = 'pointer';
        const fullText = item.detail;
        let textExpanded = false;
        textCol.addEventListener('click', (e) => {
          e.stopPropagation();
          textExpanded = !textExpanded;
          if (textExpanded) {
            textCol.style.whiteSpace = 'pre-wrap';
            textCol.style.wordBreak = 'break-word';
            textCol.style.maxHeight = '300px';
            textCol.style.overflowY = 'auto';
            textCol.textContent = desensitize(fullText);
          } else {
            textCol.style.whiteSpace = '';
            textCol.style.maxHeight = '';
            textCol.style.overflowY = '';
            textCol.textContent = item.text;
          }
        });
      }

      row.appendChild(textCol);
      timeline.appendChild(row);
    }

    // "Done" node
    const doneRow = document.createElement('div');
    doneRow.style.cssText = 'display:flex;gap:8px;';
    const doneIconCol = document.createElement('div');
    doneIconCol.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:16px;flex-shrink:0;padding-top:3px;';
    doneIconCol.appendChild(makeStepIcon('done'));
    const doneText = document.createElement('div');
    doneText.style.cssText = 'font-size:10.5px;color:var(--text-secondary);padding-top:2px;font-family:var(--font-anthropic-ui);';
    doneText.textContent = 'Done';
    doneRow.appendChild(doneIconCol);
    doneRow.appendChild(doneText);
    timeline.appendChild(doneRow);

    wrapper.appendChild(timeline);
    parent.appendChild(wrapper);
  }

  renderThinkingBlock(parent, block) {
    const details = document.createElement('details');
    details.className = 'thinking-block';
    details.style.cssText = 'margin:8px 0;background:var(--thinking-bg);border:1px solid var(--thinking-border);border-radius:var(--radius-sm);overflow:hidden;';
    const summary = document.createElement('summary');
    summary.style.cssText = 'padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--thinking-text);user-select:none;';
    summary.appendChild(createIcon('thought', 14));
    const label = document.createElement('span');
    label.style.fontWeight = '600';
    label.textContent = '思考过程';
    summary.appendChild(label);
    if (block.durationText) { const dur = document.createElement('span'); dur.className = 'badge badge-thinking'; dur.textContent = block.durationText; summary.appendChild(dur); }
    if (block.summaries && block.summaries.length > 0) { const st = document.createElement('span'); st.style.cssText = 'color:var(--text-muted);font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;'; st.textContent = '\u2014 ' + block.summaries[0]; summary.appendChild(st); }
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
    summary.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:0.85rem;color:var(--text-secondary);user-select:none;display:flex;align-items:center;gap:6px;';
    summary.appendChild(createIcon('tool', 14));
    summary.appendChild(document.createTextNode(block.toolName || 'Tool'));
    details.appendChild(summary);
    const content = document.createElement('div');
    content.style.cssText = 'padding:12px 16px;font-size:0.8rem;';
    if (block.toolInput && Object.keys(block.toolInput).length > 0) {
      const il = document.createElement('div'); il.style.cssText = 'font-weight:600;margin-bottom:4px;color:var(--text-muted);'; il.textContent = 'Input:'; content.appendChild(il);
      const ip = document.createElement('pre'); ip.style.cssText = 'background:var(--code-bg);padding:8px;border-radius:4px;overflow-x:auto;font-family:var(--font-mono);font-size:0.8rem;color:var(--text-secondary);'; ip.textContent = JSON.stringify(block.toolInput, null, 2); content.appendChild(ip);
    }
    if (block.result) {
      const rl = document.createElement('div'); rl.style.cssText = 'font-weight:600;margin:8px 0 4px;color:var(--text-muted);'; rl.textContent = 'Result:'; content.appendChild(rl);
      const rp = document.createElement('pre'); rp.style.cssText = 'background:var(--code-bg);padding:8px;border-radius:4px;overflow-x:auto;font-family:var(--font-mono);font-size:0.8rem;color:var(--text-secondary);max-height:200px;overflow-y:auto;'; rp.textContent = typeof block.result === 'string' ? block.result : JSON.stringify(block.result, null, 2); content.appendChild(rp);
    }
    details.appendChild(content);
    parent.appendChild(details);
  }

  renderToolResultBlock(parent, block) {
    const div = document.createElement('div');
    div.className = 'tool-result-block';
    div.style.cssText = 'margin:8px 0;background:var(--tool-bg);border:1px solid var(--tool-border);border-radius:var(--radius-sm);padding:12px 16px;';
    const label = document.createElement('div');
    label.style.cssText = 'font-size:0.8rem;font-weight:600;color:var(--text-muted);margin-bottom:4px;display:flex;align-items:center;gap:6px;';
    label.appendChild(createIcon('tool', 14));
    label.appendChild(document.createTextNode('Tool Result'));
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
    badge.appendChild(createIcon('flag', 12));
    badge.appendChild(document.createTextNode(' ' + (block.flagType || 'flag')));
    div.appendChild(badge);
    if (block.helpline) { const ht = document.createElement('span'); ht.style.cssText = 'font-size:0.8rem;color:var(--text-muted);'; ht.textContent = block.helpline.name || ''; div.appendChild(ht); }
    parent.appendChild(div);
  }
}
