/**
 * MessageView — Right panel showing messages for selected conversation.
 * Two modes: View (default) and Select (for batch operations).
 */

import { state, saveExportCollection } from '../store/state.js';
import { resolveCollection, createEntry, identityForMessage } from '../utils/collection.js';
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
      this._closeExportDropdown();
    };
    this.handleDocumentKeydown = (e) => {
      if (e.key !== 'Escape' || !this.activeExportDropdown) return;
      this._closeExportDropdown(true);
    };
    document.addEventListener('click', this.handleDocumentClick);
    document.addEventListener('keydown', this.handleDocumentKeydown);
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
    this.container.classList.add('content-area');
    this.container.classList.remove('content-shell');
    this.container.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;position:relative;';
    this.renderEmpty();
  }

  renderEmpty() {
    // Drop any open quick-export menu so no detached wrapper survives a re-render.
    this._closeExportDropdown();
    this._focusModeToggleAfterRender = false;
    this.container.textContent = '';
    this.container.classList.remove('stats-panel-shell');
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
    // Drop any open quick-export menu before the DOM is replaced.
    this._closeExportDropdown();
    const index = state.get('currentConversationIndex');
    const conversations = state.get('filteredConversations') || [];
    if (index < 0 || index >= conversations.length) { this.renderEmpty(); return; }

    const conv = conversations[index];
    this.container.scrollTop = 0;
    const names = state.get('displayNames');
    const showThinking = state.get('showThinking');
    const showToolUse = state.get('showToolUse');
    const showFlags = state.get('showFlags');
    const allConversations = state.get('conversations') || [];
    const resolution = resolveCollection(state.get('exportCollection') || [], allConversations);
    const messageKeys = conv.messages.map((msg, i) => identityForMessage(conv, msg, i));
    // Collected messages for THIS conversation, keyed by canonical identity so
    // both freshly-added entries and evidence/legacy-resolved entries match.
    const collectedKeys = new Set();
    for (const entry of resolution.entries) {
      const res = resolution.byKey.get(entry.key);
      if (res && res.msg && res.conv === conv) {
        collectedKeys.add(identityForMessage(res.conv, res.msg, res.index));
      }
    }
    const allInCollection = messageKeys.length > 0 && messageKeys.every(key => key != null && collectedKeys.has(key));

    this.container.textContent = '';
    this.container.classList.remove('stats-panel-shell');
    this._removeSelectionToolbar();

    // ---- Header ----
    const header = document.createElement('div');
    header.className = 'message-header-card content-constrained';
    header.style.cssText = 'flex-shrink:0;';

    const headerTop = document.createElement('div');
    headerTop.className = 'message-header-top';

    const titleSection = document.createElement('div');
    titleSection.className = 'message-title-section';
    titleSection.style.cssText = 'flex:1;min-width:0;';
    const titleEl = document.createElement('h1');
    titleEl.className = 'message-title';
    titleEl.textContent = conv.name || t('msgView.unnamed');
    titleSection.appendChild(titleEl);

    // Time span
    const firstMsg = conv.messages[0];
    const lastMsg = conv.messages[conv.messages.length - 1];
    if (firstMsg?.createdAt && lastMsg?.createdAt) {
      const timeSpan = document.createElement('div');
      timeSpan.className = 'message-time-range';
      timeSpan.style.cssText = 'font-size:0.78rem;color:var(--text-muted);margin-bottom:4px;';
      timeSpan.textContent = formatTimestamp(firstMsg.createdAt) + ' \u2014 ' + formatTimestamp(lastMsg.createdAt);
      titleSection.appendChild(timeSpan);
    }

    const metaEl = document.createElement('div');
    metaEl.className = 'message-meta';
    metaEl.style.cssText = 'font-size:0.78rem;color:var(--text-muted);display:flex;gap:12px;flex-wrap:wrap;';
    const statItems = [
      conv.stats.messageCount + ' ' + t('msgView.msgCount'),
      (names.human || 'Human') + ': ' + t('msgView.characterCount', { n: conv.stats.humanChars.toLocaleString() }),
      (names.assistant || 'Assistant') + ': ' + t('msgView.characterCount', { n: conv.stats.assistantChars.toLocaleString() }),
    ];
    if (conv.stats.hasThinking) statItems.push(conv.stats.thinkingCount + ' ' + t('msgView.thinkingCountUnit'));
    for (const s of statItems) { const sp = document.createElement('span'); sp.textContent = s; metaEl.appendChild(sp); }
    titleSection.appendChild(metaEl);
    headerTop.appendChild(titleSection);

    // Header buttons
    const headerBtns = document.createElement('div');
    headerBtns.className = 'message-header-actions';

    // Mode toggle — native switch button (keyboard operable, labelled + checked state)
    const toggleOuter = document.createElement('button');
    toggleOuter.type = 'button';
    toggleOuter.className = 'message-mode-toggle';
    toggleOuter.setAttribute('role', 'switch');
    toggleOuter.setAttribute('aria-checked', this.selectMode ? 'true' : 'false');
    toggleOuter.title = this.selectMode ? t('msgView.selectMode') : t('msgView.viewMode');

    const toggleLabel = document.createElement('span');
    toggleLabel.className = 'message-mode-toggle-label';
    toggleLabel.textContent = this.selectMode ? t('msgView.selectMode') : t('msgView.viewMode');

    const toggleTrack = document.createElement('span');
    toggleTrack.className = 'message-mode-toggle-track' + (this.selectMode ? ' active' : '');

    const toggleThumb = document.createElement('span');
    toggleThumb.className = 'message-mode-toggle-thumb';
    toggleTrack.appendChild(toggleThumb);

    toggleOuter.appendChild(toggleLabel);
    toggleOuter.appendChild(toggleTrack);
    toggleOuter.setAttribute('aria-pressed', this.selectMode ? 'true' : 'false');
    toggleOuter.addEventListener('click', () => {
      this.selectMode = !this.selectMode;
      if (!this.selectMode) this.selectedIndices.clear();
      // The toggle is recreated by the re-render; remember to restore focus to
      // the live replacement so keyboard users are not dropped onto <body>.
      this._focusModeToggleAfterRender = true;
      this.renderConversation();
    });
    headerBtns.appendChild(toggleOuter);

    // Add all to collection
    const addAllBtn = this._headerBtn(allInCollection ? t('msgView.addedToCollection') : t('msgView.addToCollection'), allInCollection ? 'check' : 'star', () => {
      this._addMessagesToCollection(conv, conv.messages.map((_, i) => i));
    });
    headerBtns.appendChild(addAllBtn);

    // Export dropdown — native trigger + native menu items with Escape/outside
    // close and focus return to the (still-present) trigger.
    const exportWrapper = document.createElement('div');
    exportWrapper.className = 'export-dropdown-wrapper';
    const exportBtn = this._headerBtn(t('msgView.exportThis'), 'export');
    exportBtn.classList.add('export-dropdown-trigger');
    exportBtn.setAttribute('aria-haspopup', 'menu');
    exportBtn.setAttribute('aria-expanded', 'false');
    const exportChevron = document.createElement('span');
    exportChevron.className = 'export-dropdown-chevron';
    exportChevron.setAttribute('aria-hidden', 'true');
    exportChevron.textContent = '\u25BE';
    exportBtn.appendChild(exportChevron);

    const dropdown = document.createElement('div');
    dropdown.className = 'export-dropdown hidden';
    dropdown.setAttribute('role', 'menu');
    dropdown.setAttribute('aria-label', t('msgView.exportThis'));

    const menuItems = [];
    const focusItem = (i) => {
      if (menuItems.length === 0) return;
      const idx = (i + menuItems.length) % menuItems.length;
      const target = menuItems[idx];
      if (target && typeof target.focus === 'function') target.focus();
    };

    // Single canonical open/close. Every close path funnels through
    // this.activeExportDropdown so no detached wrapper survives a re-render.
    const openMenu = (focusFirst) => {
      if (this.activeExportDropdown && this.activeExportDropdown.dropdown !== dropdown) {
        this._closeExportDropdown();
      }
      dropdown.classList.remove('hidden');
      exportBtn.setAttribute('aria-expanded', 'true');
      this.activeExportDropdown = { wrapper: exportWrapper, dropdown, trigger: exportBtn };
      if (focusFirst) focusItem(0);
    };
    const closeMenu = (returnFocus) => {
      if (!dropdown.classList.contains('hidden')) this._closeExportDropdown(returnFocus);
    };

    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dropdown.classList.contains('hidden')) openMenu(true);
      else closeMenu(false);
    });
    exportBtn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu(true);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        openMenu(false);
        focusItem(menuItems.length - 1);
      } else if (e.key === 'Escape') {
        closeMenu(true);
      }
    });
    dropdown.addEventListener('keydown', (e) => {
      const current = menuItems.indexOf(globalThis.document.activeElement);
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          closeMenu(true);
          break;
        case 'ArrowDown':
          e.preventDefault();
          focusItem(current + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          focusItem(current - 1);
          break;
        case 'Home':
          e.preventDefault();
          focusItem(0);
          break;
        case 'End':
          e.preventDefault();
          focusItem(menuItems.length - 1);
          break;
        case 'Tab':
          // Let Tab move naturally, but never leave an open menu behind.
          closeMenu(false);
          break;
        default:
          break;
      }
    });

    for (const fmt of [{key:'md',label:'Markdown'},{key:'txt',label:t('export.plainText')},{key:'html',label:'HTML'},{key:'json',label:'JSON'}]) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'export-dropdown-item';
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
      item.textContent = fmt.label;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenu(true);
        this._quickExportConversation(conv, fmt.key);
      });
      dropdown.appendChild(item);
      menuItems.push(item);
    }
    exportWrapper.appendChild(exportBtn);
    exportWrapper.appendChild(dropdown);
    headerBtns.appendChild(exportWrapper);

    headerTop.appendChild(headerBtns);
    header.appendChild(headerTop);
    this.container.appendChild(header);

    // ---- Messages ----
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'messages-scroll';
    const messagesInner = document.createElement('div');
    messagesInner.className = 'messages-inner content-constrained';
    scrollContainer.appendChild(messagesInner);

    let prevTimestamp = null;

    for (let mi = 0; mi < conv.messages.length; mi++) {
      const msg = conv.messages[mi];
      const msgKey = identityForMessage(conv, msg, mi);
      const isCollected = msgKey != null && collectedKeys.has(msgKey);

      // Time separator
      if (prevTimestamp && msg.createdAt) {
        const diffMinutes = getTimeDiffMinutes(prevTimestamp, msg.createdAt);
        if (diffMinutes > 60) {
          const sep = document.createElement('div');
          sep.className = 'time-separator';
          sep.style.cssText = 'text-align:center;padding:16px 0;color:var(--text-muted);font-size:0.8rem;';
          const hours = Math.floor(diffMinutes / 60);
          sep.textContent = '\u2014 ' + (hours > 24 ? Math.floor(hours / 24) + t('msgView.daysLater') : hours + t('msgView.hoursLater')) + ' \u2014';
          messagesInner.appendChild(sep);
        }
      }
      prevTimestamp = msg.createdAt;

      const isHuman = msg.sender === 'human';
      const isClaude = state.get('theme') === 'claude';
      const msgEl = document.createElement('div');
      msgEl.className = 'message-block ' + (isHuman ? 'message-human' : 'message-assistant');
      msgEl.dataset.msgIndex = mi;
      msgEl.style.position = 'relative';

      // Selection checkbox (only in select mode)
      if (this.selectMode) {
        msgEl.classList.add('message-selectable');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.setAttribute('aria-label', t('msgView.selectMessage', { n: mi + 1 }));
        checkbox.checked = this.selectedIndices.has(mi);
        checkbox.style.cssText = 'position:absolute;left:6px;top:14px;accent-color:var(--accent);cursor:pointer;z-index:2;';
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) this.selectedIndices.add(mi);
          else this.selectedIndices.delete(mi);
          this._updateSelectionToolbar(conv);
          msgEl.classList.toggle('message-selected', checkbox.checked);
        });
        msgEl.appendChild(checkbox);
        if (this.selectedIndices.has(mi)) {
          msgEl.classList.add('message-selected');
        }
      }

      // Sender name
      const senderEl = document.createElement('div');
      senderEl.className = 'message-sender';
      if (isClaude) {
        // Claude theme: no sender name for either human or assistant (matches official)
        senderEl.style.cssText = 'display:none;';
      } else {
        senderEl.style.cssText = 'font-weight:600;font-size:0.85rem;margin-bottom:6px;display:flex;align-items:center;gap:6px;color:' + (isHuman ? 'var(--accent-ink)' : 'var(--text-primary)') + ';';
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
      footer.className = 'message-footer';

      const timeEl = document.createElement('span');
      timeEl.style.cssText = 'font-size:0.72rem;color:var(--text-muted);';
      timeEl.textContent = formatTimestamp(msg.createdAt);
      footer.appendChild(timeEl);

      const actionBtns = document.createElement('div');
      actionBtns.style.cssText = 'display:flex;gap:4px;';

      actionBtns.appendChild(this._createActionBtn(t('msgView.copy'), () => this._copyMessage(msg)));
      actionBtns.appendChild(this._createActionBtn(isCollected ? t('msgView.collected') : t('msgView.collect'), () => {
        if (isCollected) return;
        this._addToCollection(conv, mi, msg);
        // Auto enter select mode and select this message
        if (!this.selectMode) {
          this.selectMode = true;
          this.selectedIndices.add(mi);
          this.renderConversation();
        }
      }, isCollected));
      actionBtns.appendChild(this._createActionBtn(t('msgView.selectToHere'), () => {
        if (!this.selectMode) { this.selectMode = true; }
        this._selectToHere(mi, conv);
        this.renderConversation();
      }));

      footer.appendChild(actionBtns);
      msgEl.appendChild(footer);

      messagesInner.appendChild(msgEl);
    }

    this.container.appendChild(scrollContainer);
    if (this.selectMode) this._updateSelectionToolbar(conv);
    this._applyHighlightFromState();

    // Restore keyboard focus to the recreated mode toggle after an explicit
    // toggle activation (focus would otherwise fall back to <body>).
    if (this._focusModeToggleAfterRender) {
      this._focusModeToggleAfterRender = false;
      const toggle = this.container.querySelector('.message-mode-toggle');
      if (toggle && typeof toggle.focus === 'function') toggle.focus();
    }
  }

  // ---- Header Button Helper ----
  _headerBtn(text, iconName, onClick) {
    const btn = document.createElement('button');
    btn.className = 'neu-ghost-btn';
    btn.classList.add('message-header-btn');
    if (iconName) btn.appendChild(createIcon(iconName, 15));
    btn.appendChild(document.createTextNode(' ' + text));
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
  }

  // ---- Action Buttons ----
  _createActionBtn(text, onClick, active = false) {
    const btn = document.createElement('button');
    btn.className = 'neu-ghost-btn';
    btn.classList.add('message-action-btn');
    btn.textContent = text;
    if (active) {
      btn.dataset.active = 'true';
    }
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return btn;
  }

  _copyMessage(msg) {
    let text = '';
    for (const block of msg.contentBlocks) {
      if (block.type === 'text') text += block.text + '\n';
      else if (block.type === 'thinking' && block.thinking) text += `\n[${t('msgView.thinking')}]\n${block.thinking}\n`;
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
    this._addMessagesToCollection(conv, [mi]);
  }

  /**
   * Add one or more messages to the collection using the shared resolver for
   * dedup and the canonical identity (conv uuid + source message uuid where
   * present, else conversation key + conservative evidence). Returns the number
   * actually added (0 when everything was already collected).
   */
  _addMessagesToCollection(conv, indices) {
    const all = state.get('conversations') || [];
    const current = state.get('exportCollection') || [];
    // Existing keys + resolved targets, so we never add a duplicate of an
    // already-collected message (including one added via evidence/legacy).
    const resolved = resolveCollection(current, all);
    const existingKeys = new Set();
    const existingTargets = new Map();
    for (const entry of resolved.entries) {
      existingKeys.add(entry.key);
      const res = resolved.byKey.get(entry.key);
      if (res && res.msg) {
        if (!existingTargets.has(res.conv)) existingTargets.set(res.conv, new Set());
        existingTargets.get(res.conv).add(res.index);
      }
    }

    const added = [];
    let blocked = false;
    for (const idx of indices) {
      const msg = conv.messages[idx];
      if (!msg) continue;
      const entry = createEntry(conv, msg, idx, t('msgView.unnamed2'));
      if (!entry) { blocked = true; continue; }
      if (existingKeys.has(entry.key)) continue;
      if (!existingTargets.has(conv)) existingTargets.set(conv, new Set());
      if (existingTargets.get(conv).has(idx)) continue;
      existingKeys.add(entry.key);
      existingTargets.get(conv).add(idx);
      added.push(entry);
    }
    if (added.length > 0) {
      state.set('exportCollection', current.concat(added));
      saveExportCollection();
    }
    if (blocked) this._showCollectNotice();
    return added.length;
  }

  /**
   * Show a brief, translated notice when a conversation has no usable source
   * discriminator so its messages cannot be collected (rare: no uuid, name,
   * timestamps or text anywhere). Avoids a silent no-op.
   */
  _showCollectNotice() {
    const existing = this.container.querySelector('.collect-notice');
    if (existing) return;
    const notice = document.createElement('div');
    notice.className = 'collect-notice';
    notice.setAttribute('role', 'status');
    notice.style.cssText = 'position:absolute;bottom:16px;left:50%;transform:translateX(-50%);z-index:60;padding:8px 14px;border-radius:10px;background:var(--surface-raised,var(--bg-card));color:var(--text-secondary);font-size:0.78rem;box-shadow:var(--shadow);';
    notice.textContent = t('msgView.collectUnavailable');
    this.container.appendChild(notice);
    setTimeout(() => notice.remove(), 4000);
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
    info.textContent = t('msgView.selectedCount', { n: this.selectedIndices.size });
    toolbar.appendChild(info);

    toolbar.appendChild(Object.assign(document.createElement('div'), { style: 'flex:1;' }));

    toolbar.appendChild(this._toolbarBtn(t('msgView.copy'), () => {
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

    toolbar.appendChild(this._toolbarBtn(t('msgView.addToCollection'), () => {
      this._addMessagesToCollection(conv, [...this.selectedIndices]);
    }));

    const exportBtn = this._toolbarBtn(t('msgView.exportSelected'), () => this._exportMessages(conv, [...this.selectedIndices].sort((a, b) => a - b).map(idx => conv.messages[idx])));
    exportBtn.style.background = 'var(--accent)'; exportBtn.style.color = '#fff'; exportBtn.style.borderColor = 'var(--accent)';
    toolbar.appendChild(exportBtn);

    toolbar.appendChild(this._toolbarBtn(t('msgView.cancel'), () => { this.selectMode = false; this.selectedIndices.clear(); this.renderConversation(); }));

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
      const nameBase = this._sanitizeFilename(conv.name || t('msgView.fileConversation'));
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
      let output = `# ${conv.name || t('msgView.unnamed')} (${t('msgView.excerpt')})\n\n`;
      for (const msg of messages) {
        const sender = msg.sender === 'human' ? (names.human || 'Human') : (names.assistant || 'Assistant');
        output += `## ${sender} (${formatTimestamp(msg.createdAt)})\n\n`;
        for (const block of msg.contentBlocks) {
          if (block.type === 'text') output += this._toMarkdownCodeBlock(block.text) + '\n\n';
          else if (block.type === 'thinking' && block.thinking) output += `> ${t('msgView.thinking')}\n\n${this._toMarkdownCodeBlock(block.thinking)}\n\n`;
        }
        output += '---\n\n';
      }
      const dateSuffix = formatLocalDateStamp();
      const safeName = this._sanitizeFilename(conv.name || t('msgView.fileConversation'));
      downloadFile(output, `${safeName}_${t('msgView.excerpt')}_${dateSuffix}.md`, 'text/markdown;charset=utf-8');
    });
  }

  _sanitizeFilename(name) {
    return (name || t('msgView.fileConversation')).replace(/[/\\?%*:|"<>]/g, '_').trim().slice(0, 120) || t('msgView.fileConversation');
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

      targetBlock.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center',
      });
      targetBlock.classList.add('message-highlighted');

      setTimeout(() => {
        targetBlock.classList.remove('message-highlighted');
      }, 2500);

      state.set('highlightMessageIndex', null);
    });
  }

  destroy() {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    document.removeEventListener('click', this.handleDocumentClick);
    document.removeEventListener('keydown', this.handleDocumentKeydown);
    this._closeExportDropdown();
    this.statsPanel.destroy();
  }

  /**
   * Close the open quick-export dropdown, keeping aria-expanded in sync.
   * Single canonical close used by Escape, outside-click, Tab, format
   * selection and any future re-render/cleanup path.
   * @param {boolean} [focusTrigger] - Return focus to the still-present trigger.
   */
  _closeExportDropdown(focusTrigger = false) {
    if (!this.activeExportDropdown) return;
    const { dropdown, trigger } = this.activeExportDropdown;
    this.activeExportDropdown = null;
    dropdown.classList.add('hidden');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (focusTrigger && trigger && trigger.isConnected !== false) trigger.focus();
  }

  // ---- Content Renderers ----
  renderTextBlock(parent, block) {
    const div = document.createElement('div');
    div.className = 'message-text';
    div.style.cssText = 'word-break:break-word;';
    const safeHtml = renderMarkdown(desensitize(block.text));
    const template = document.createElement('template');
    template.innerHTML = safeHtml;
    div.appendChild(template.content);
    parent.appendChild(div);
  }

  /**
   * Claude theme: lightweight inline summary + timeline for thinking/tool blocks.
   *
   * Hierarchy (kept deliberately airy, not a heavy admin card):
   *   - summary row: chevron + summary label + duration + counts (native <button>)
   *   - expanded timeline: one row per block (thinking / tool_use / tool_result)
   *   - each row exposes its full payload through an on-demand native <details>
   *
   * Text is written with textContent only. Thinking text is run through the
   * existing screen-display desensitize() the same way renderThinkingBlock does;
   * this does not expand or claim any whole-tool redaction policy.
   */
  _renderClaudeTimeline(parent, blocks) {
    const thinkingBlocks = blocks.filter(b => b.type === 'thinking');
    const toolBlocks = blocks.filter(b => b.type === 'tool_use' || b.type === 'tool_result');
    const toolResultBlocks = blocks.filter(b => b.type === 'tool_result');
    const lastThinking = thinkingBlocks[thinkingBlocks.length - 1];
    const toolUseBlocks = toolBlocks.filter(b => b.type === 'tool_use');

    // Duration comes straight from the parser's unified formatDuration.
    const duration = lastThinking?.durationText || '';

    // Summary fallback priority: explicit summary → desensitized thinking preview
    // → first tool name → (standalone results only) a result label → generic label.
    // Screen desensitization is applied to any thinking text that can surface here
    // (same policy as the detail body). The fallback must reflect the actual
    // content type so a results-only timeline is not mislabeled as "thinking".
    const thinkingPreview = lastThinking
      ? desensitize(lastThinking.thinking || lastThinking.summaries?.[0] || '')
      : '';
    const summaryText = lastThinking?.summaries?.[0]
      ? desensitize(lastThinking.summaries[0])
      : (thinkingPreview
        || (toolUseBlocks.length > 0 ? (toolUseBlocks[0].toolName || t('msgView.toolFallback')) : '')
        || (toolResultBlocks.length > 0 ? t('msgView.toolResultLabel') : '')
        || t('msgView.thinking'));
    // Keep the summary to a single readable line; full text lives in the timeline.
    const summaryLine = String(summaryText).replace(/\s+/g, ' ').trim();
    const summaryShort = summaryLine.length > 96 ? summaryLine.slice(0, 96).trimEnd() + '\u2026' : summaryLine;

    const ns = 'http://www.w3.org/2000/svg';

    // SVG helpers — icons from reference, sizes from claude.ai
    const makeSvg = (w, h) => {
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', w); svg.setAttribute('height', h);
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.5');
      svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
      svg.style.display = 'block';
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      return svg;
    };
    const addPath = (svg, d) => { const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); svg.appendChild(p); };
    const addCircle = (svg, cx, cy, r) => { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r); svg.appendChild(c); };
    const addPolyline = (svg, pts) => { const pl = document.createElementNS(ns, 'polyline'); pl.setAttribute('points', pts); svg.appendChild(pl); };

    // Icon SVGs from reference HTML — rendered at 16x16 to match claude.ai
    const makeChevronRight = () => { const s = makeSvg('12', '12'); addPath(s, 'm9 18 6-6-6-6'); return s; };
    const makeChevronDown = () => { const s = makeSvg('12', '12'); addPath(s, 'm6 9 6 6 6-6'); return s; };
    const makeClockIcon = () => { const s = makeSvg('16', '16'); addPath(s, 'M 12 2 A 10 10 0 1 1 2 12'); addPath(s, 'M 3.34 7 v0 M 7 3.34 v0'); addPolyline(s, '12 6 12 12 16 14'); return s; };
    const makeToolIcon = () => { const s = makeSvg('16', '16'); addCircle(s, '12', '12', '10'); addCircle(s, '12', '12', '4'); return s; };
    const makeDoneIcon = () => { const s = makeSvg('16', '16'); addCircle(s, '12', '12', '10'); addPath(s, 'm9 12 2 2 4-4'); return s; };

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin:8px 0 4px;font-family:var(--font-anthropic-ui);';

    // ---- Summary row: native button, keyboard operable, aria-expanded ----
    const summaryBtn = document.createElement('button');
    summaryBtn.type = 'button';
    summaryBtn.className = 'timeline-summary';
    summaryBtn.setAttribute('aria-expanded', 'false');

    const chevronWrap = document.createElement('span');
    chevronWrap.className = 'timeline-chevron';
    chevronWrap.appendChild(makeChevronRight());
    summaryBtn.appendChild(chevronWrap);

    const summarySpan = document.createElement('span');
    summarySpan.className = 'timeline-summary-text';
    summarySpan.textContent = summaryShort;
    summaryBtn.appendChild(summarySpan);

    const metaWrap = document.createElement('span');
    metaWrap.className = 'timeline-summary-meta';
    if (duration) {
      const durEl = document.createElement('span');
      durEl.className = 'timeline-duration';
      durEl.textContent = duration;
      metaWrap.appendChild(durEl);
    }
    const counts = [];
    if (thinkingBlocks.length > 0) counts.push(thinkingBlocks.length + ' ' + t('msgView.thinkingCountUnit'));
    if (toolUseBlocks.length > 0) counts.push(toolUseBlocks.length + ' ' + t('msgView.toolCountUnit'));
    if (counts.length > 0) {
      const countEl = document.createElement('span');
      countEl.className = 'timeline-count';
      countEl.textContent = counts.join(' \u00b7 ');
      metaWrap.appendChild(countEl);
    }
    if (metaWrap.children.length > 0) summaryBtn.appendChild(metaWrap);
    wrapper.appendChild(summaryBtn);

    // ---- Timeline (initially hidden) ----
    const timeline = document.createElement('div');
    timeline.className = 'timeline-body';
    timeline.hidden = true;

    let isExpanded = false;
    const setExpanded = (next) => {
      isExpanded = next;
      timeline.hidden = !isExpanded;
      summaryBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      chevronWrap.textContent = '';
      chevronWrap.appendChild(isExpanded ? makeChevronDown() : makeChevronRight());
    };
    summaryBtn.addEventListener('click', () => setExpanded(!isExpanded));

    // Build items — keep every payload visible on demand, never truncate as the
    // only access path. Each item has a stable type title plus a short preview;
    // the full payload lives in the expandable body.
    const items = [];
    for (const block of blocks) {
      if (block.type === 'thinking') {
        const raw = block.thinking || block.summaries?.[0] || '';
        const preview = desensitize(raw).replace(/\s+/g, ' ').trim();
        items.push({ type: 'thinking', block, title: t('msgView.thinking'), preview });
      } else if (block.type === 'tool_use') {
        items.push({
          type: 'tool',
          block,
          title: block.toolName || t('msgView.toolFallback'),
          preview: block.toolMessage ? String(block.toolMessage) : '',
        });
      } else if (block.type === 'tool_result') {
        const raw = typeof block.result === 'string' ? block.result : '';
        items.push({
          type: 'result',
          block,
          title: t('msgView.toolResultLabel'),
          preview: raw.replace(/\s+/g, ' ').trim(),
        });
      }
    }

    const makeRow = (iconName, item, showLine) => {
      const { block, title: titleText, preview } = item;
      const row = document.createElement('div');
      row.className = 'timeline-row';
      row.style.cssText = showLine ? '' : 'padding-bottom:0;';
      const iconCol = document.createElement('div');
      iconCol.className = 'timeline-row-icon';
      iconCol.appendChild(iconName === 'clock' ? makeClockIcon() : (iconName === 'check' ? makeDoneIcon() : makeToolIcon()));
      if (showLine) {
        const line = document.createElement('div');
        line.className = 'timeline-row-line';
        iconCol.appendChild(line);
      }
      row.appendChild(iconCol);

      const details = document.createElement('details');
      details.className = 'timeline-item';

      const summary = document.createElement('summary');
      summary.className = 'timeline-item-summary';

      const marker = document.createElement('span');
      marker.className = 'timeline-item-marker';
      marker.setAttribute('aria-hidden', 'true');
      marker.appendChild(makeChevronRight());
      summary.appendChild(marker);

      const title = document.createElement('span');
      title.className = 'timeline-item-title';
      title.textContent = titleText;
      summary.appendChild(title);
      if (preview) {
        const sub = document.createElement('span');
        sub.className = 'timeline-item-sub';
        sub.textContent = preview;
        summary.appendChild(sub);
      }
      details.appendChild(summary);

      // Keep the chevron in sync with the native open/close state.
      const syncMarker = () => {
        marker.textContent = '';
        marker.appendChild(details.open ? makeChevronDown() : makeChevronRight());
      };
      details.addEventListener('toggle', syncMarker);

      const body = document.createElement('div');
      body.className = 'timeline-item-body';
      details.appendChild(body);

      // Thinking → full reasoning text (screen desensitized like renderThinkingBlock).
      if (block.type === 'thinking') {
        const pre = document.createElement('div');
        pre.className = 'timeline-detail-text';
        pre.textContent = desensitize(block.thinking || block.summaries?.[0] || '');
        body.appendChild(pre);
      } else if (block.type === 'tool_use') {
        let hasPayload = false;
        // Full tool name (the summary title is ellipsized for narrow widths).
        if (block.toolName) {
          const nameRow = document.createElement('div');
          nameRow.className = 'timeline-detail-name';
          nameRow.textContent = block.toolName;
          body.appendChild(nameRow);
        }
        if (block.toolMessage) {
          const msg = document.createElement('div');
          msg.className = 'timeline-detail-text';
          msg.textContent = block.toolMessage;
          body.appendChild(msg);
          hasPayload = true;
        }
        if (block.toolInput && Object.keys(block.toolInput).length > 0) {
          const label = document.createElement('div');
          label.className = 'timeline-detail-label';
          label.textContent = t('msgView.toolInputLabel');
          body.appendChild(label);
          const pre = document.createElement('pre');
          pre.className = 'timeline-detail-pre';
          pre.textContent = JSON.stringify(block.toolInput, null, 2);
          body.appendChild(pre);
          hasPayload = true;
        }
        if (block.result != null) {
          const label = document.createElement('div');
          label.className = 'timeline-detail-label';
          label.textContent = t('msgView.toolResultLabel');
          body.appendChild(label);
          const pre = document.createElement('pre');
          pre.className = 'timeline-detail-pre';
          pre.textContent = typeof block.result === 'string' ? block.result : JSON.stringify(block.result, null, 2);
          body.appendChild(pre);
          hasPayload = true;
        }
        if (!hasPayload) {
          const empty = document.createElement('div');
          empty.className = 'timeline-detail-empty';
          empty.textContent = t('msgView.toolNoInput');
          body.appendChild(empty);
        }
      } else if (block.type === 'tool_result') {
        const pre = document.createElement('pre');
        pre.className = 'timeline-detail-pre';
        pre.textContent = typeof block.result === 'string' ? block.result : JSON.stringify(block.result, null, 2);
        body.appendChild(pre);
      }

      row.appendChild(details);
      return row;
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const iconName = item.type === 'thinking' ? 'clock' : 'tool';
      timeline.appendChild(makeRow(iconName, item, true));
    }
    // Final "Done" marker row (no payload).
    {
      const row = document.createElement('div');
      row.className = 'timeline-row timeline-row-done';
      const iconCol = document.createElement('div');
      iconCol.className = 'timeline-row-icon';
      iconCol.appendChild(makeDoneIcon());
      row.appendChild(iconCol);
      const done = document.createElement('div');
      done.className = 'timeline-done-text';
      done.textContent = t('msgView.done');
      row.appendChild(done);
      timeline.appendChild(row);
    }

    wrapper.appendChild(timeline);
    parent.appendChild(wrapper);
  }

  renderThinkingBlock(parent, block) {
    const details = document.createElement('details');
    details.className = 'thinking-block';
    const summary = document.createElement('summary');
    summary.appendChild(createIcon('thought', 14));
    const label = document.createElement('span');
    label.className = 'block-detail-title';
    label.style.fontWeight = '600';
    label.textContent = t('msgView.thinking');
    summary.appendChild(label);
    if (block.durationText) { const dur = document.createElement('span'); dur.className = 'badge badge-thinking'; dur.textContent = block.durationText; summary.appendChild(dur); }
    if (block.summaries && block.summaries.length > 0) { const st = document.createElement('span'); st.className = 'block-detail-preview'; st.textContent = '\u2014 ' + desensitize(block.summaries[0]); summary.appendChild(st); }
    const chevron = createIcon('chevronDown', 12);
    chevron.className = 'block-detail-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    summary.appendChild(chevron);
    details.appendChild(summary);
    const content = document.createElement('div');
    content.className = 'block-detail-content';
    content.textContent = desensitize(block.thinking);
    details.appendChild(content);
    parent.appendChild(details);
  }

  renderToolBlock(parent, block) {
    const details = document.createElement('details');
    details.className = 'tool-block';
    const summary = document.createElement('summary');
    summary.appendChild(createIcon('tool', 14));
    const name = document.createElement('span');
    name.className = 'block-detail-title';
    name.textContent = block.toolName || t('msgView.toolFallback');
    summary.appendChild(name);
    const chevron = createIcon('chevronDown', 12);
    chevron.className = 'block-detail-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    summary.appendChild(chevron);
    details.appendChild(summary);
    const content = document.createElement('div');
    content.className = 'block-detail-content';
    if (block.toolInput && Object.keys(block.toolInput).length > 0) {
      const il = document.createElement('div'); il.className = 'block-detail-label'; il.textContent = t('msgView.toolInputLabel'); content.appendChild(il);
      const ip = document.createElement('pre'); ip.className = 'block-detail-pre'; ip.textContent = JSON.stringify(block.toolInput, null, 2); content.appendChild(ip);
    }
    if (block.result) {
      const rl = document.createElement('div'); rl.className = 'block-detail-label'; rl.textContent = t('msgView.toolResultLabel'); content.appendChild(rl);
      const rp = document.createElement('pre'); rp.className = 'block-detail-pre'; rp.textContent = typeof block.result === 'string' ? block.result : JSON.stringify(block.result, null, 2); content.appendChild(rp);
    }
    details.appendChild(content);
    parent.appendChild(details);
  }

  renderToolResultBlock(parent, block) {
    const div = document.createElement('div');
    div.className = 'tool-result-block';
    const label = document.createElement('div');
    label.className = 'block-detail-label';
    label.style.cssText = 'display:flex;align-items:center;gap:6px;';
    label.appendChild(createIcon('tool', 14));
    label.appendChild(document.createTextNode(t('msgView.toolResultLabel')));
    div.appendChild(label);
    const pre = document.createElement('pre');
    pre.className = 'block-detail-pre';
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
