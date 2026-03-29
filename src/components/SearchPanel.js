/**
 * SearchPanel — Full-page search panel that replaces the content area.
 * Features: keyword search, date range filter, role/type filter, result list with jump-to-message.
 */

import { state, resetSidebarFilter } from '../store/state.js';
import { formatTimestamp } from '../utils/time.js';
import { escapeHtml } from '../utils/markdown.js';
import { t } from '../i18n.js';

export class SearchPanel {
  constructor() {
    this.results = [];
    this.searchTimer = null;
    this.currentQuery = '';
    this.filters = {
      role: 'all',
      contentType: 'all',
      dateFrom: '',
      dateTo: '',
    };
  }

  /**
   * Render the search panel into the given container (replaces content area).
   */
  render(container) {
    clearTimeout(this.searchTimer);
    container.textContent = '';
    container.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;';

    // ---- Search Header ----
    const header = document.createElement('div');
    header.className = 'search-panel-header';
    header.style.cssText = `
      padding: 20px 24px 16px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      background: var(--bg-secondary);
    `;

    const title = document.createElement('h2');
    title.style.cssText = 'font-size:1.15rem;font-weight:600;margin-bottom:16px;color:var(--text-primary);';
    title.textContent = t('search.title');
    header.appendChild(title);

    // Keyword input row
    const searchRow = document.createElement('div');
    searchRow.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;width:100%;';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = t('search.placeholder');
    searchInput.id = 'search-panel-input';
    searchInput.style.cssText = `
      flex: 1;
      padding: 10px 14px 10px 36px;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 0.9rem;
      font-family: var(--font-family);
      transition: border-color 0.15s;
    `;
    searchInput.addEventListener('focus', () => {
      searchInput.style.borderColor = 'var(--accent)';
    });
    searchInput.addEventListener('blur', () => {
      searchInput.style.borderColor = 'var(--border)';
    });
    searchInput.addEventListener('input', () => {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.doSearch(), 300);
    });

    const inputWrapper = document.createElement('div');
    inputWrapper.style.cssText = 'flex:1;position:relative;';

    const searchIcon = document.createElement('span');
    searchIcon.style.cssText = 'position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:0.9rem;pointer-events:none;';
    searchIcon.textContent = '\uD83D\uDD0D';
    inputWrapper.appendChild(searchIcon);
    inputWrapper.appendChild(searchInput);
    searchRow.appendChild(inputWrapper);

    header.appendChild(searchRow);

    // ---- Filter Row ----
    const filterRow = document.createElement('div');
    filterRow.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;';

    // Date range
    const dateFromInput = this._createDateInput('search-date-from', t('search.startDate'));
    const dateSep = document.createElement('span');
    dateSep.style.cssText = 'color:var(--text-muted);font-size:0.85rem;';
    dateSep.textContent = t('search.dateSep');
    const dateToInput = this._createDateInput('search-date-to', t('search.endDate'));

    dateFromInput.addEventListener('change', () => {
      this.filters.dateFrom = dateFromInput.value;
      this.doSearch();
    });
    dateToInput.addEventListener('change', () => {
      this.filters.dateTo = dateToInput.value;
      this.doSearch();
    });

    filterRow.appendChild(dateFromInput);
    filterRow.appendChild(dateSep);
    filterRow.appendChild(dateToInput);

    // Separator
    const sep = document.createElement('span');
    sep.style.cssText = 'width:1px;height:20px;background:var(--border);margin:0 4px;';
    filterRow.appendChild(sep);

    // Role filter
    const roleSelect = this._createSelect('search-role', [
      { value: 'all', label: t('search.allRoles') },
      { value: 'human', label: t('search.humanOnly') },
      { value: 'assistant', label: t('search.aiOnly') },
    ]);
    roleSelect.addEventListener('change', () => {
      this.filters.role = roleSelect.value;
      this.doSearch();
    });
    filterRow.appendChild(roleSelect);

    // Content type filter
    const typeSelect = this._createSelect('search-type', [
      { value: 'all', label: t('search.allTypes') },
      { value: 'thinking', label: t('search.withThinking') },
      { value: 'tool', label: t('search.withToolUse') },
      { value: 'flag', label: t('search.withFlags') },
    ]);
    typeSelect.addEventListener('change', () => {
      this.filters.contentType = typeSelect.value;
      this.doSearch();
    });
    filterRow.appendChild(typeSelect);

    // Clear filters button
    const clearBtn = document.createElement('button');
    clearBtn.style.cssText = `
      padding: 6px 12px;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    `;
    clearBtn.textContent = t('search.clearFilters');
    clearBtn.addEventListener('mouseenter', () => {
      clearBtn.style.borderColor = 'var(--accent)';
      clearBtn.style.color = 'var(--accent)';
    });
    clearBtn.addEventListener('mouseleave', () => {
      clearBtn.style.borderColor = 'var(--border)';
      clearBtn.style.color = 'var(--text-muted)';
    });
    clearBtn.addEventListener('click', () => {
      this.filters = { role: 'all', contentType: 'all', dateFrom: '', dateTo: '' };
      this.currentQuery = '';
      dateFromInput.value = '';
      dateToInput.value = '';
      roleSelect.value = 'all';
      typeSelect.value = 'all';
      searchInput.value = '';
      this.results = [];
      this._renderResults(resultsContainer, statsBar);
    });
    filterRow.appendChild(clearBtn);

    header.appendChild(filterRow);
    container.appendChild(header);

    // ---- Stats Bar ----
    const statsBar = document.createElement('div');
    statsBar.id = 'search-stats-bar';
    statsBar.style.cssText = `
      padding: 8px 24px;
      font-size: 0.8rem;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      display: none;
    `;
    container.appendChild(statsBar);

    // ---- Results Container ----
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'search-results-container';
    resultsContainer.style.cssText = 'flex:1;overflow-y:auto;';
    container.appendChild(resultsContainer);

    // Show initial empty state
    this._renderEmptyState(resultsContainer);

    // Focus input
    setTimeout(() => searchInput.focus(), 100);
  }

  doSearch() {
    const input = document.getElementById('search-panel-input');
    const query = input ? input.value.trim().toLowerCase() : '';
    this.currentQuery = query;

    const conversations = state.get('conversations') || [];
    const results = [];
    const maxResults = 200;

    const { role, contentType, dateFrom, dateTo } = this.filters;
    const dateFromTs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : 0;
    const dateToTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;

    for (let ci = 0; ci < conversations.length && results.length < maxResults; ci++) {
      const conv = conversations[ci];

      // Content type filter on conversation level
      if (contentType === 'thinking' && !conv.stats.hasThinking) continue;
      if (contentType === 'tool' && !conv.stats.hasTools) continue;
      if (contentType === 'flag' && !conv.stats.hasFlags) continue;

      for (let mi = 0; mi < conv.messages.length && results.length < maxResults; mi++) {
        const msg = conv.messages[mi];

        // Role filter
        if (role !== 'all' && msg.sender !== role) continue;

        // Date filter
        if (msg.createdAt) {
          const msgTs = new Date(msg.createdAt).getTime();
          if (msgTs < dateFromTs || msgTs > dateToTs) continue;
        }

        // Content type filter on message level
        if (contentType === 'thinking' && !msg.contentBlocks.some(b => b.type === 'thinking')) continue;
        if (contentType === 'tool' && !this._messageHasToolContent(msg)) continue;
        if (contentType === 'flag' && !msg.contentBlocks.some(b => b.type === 'flag')) continue;

        // Keyword search (if query is empty and we have filters, show all matching messages)
        if (query && query.length >= 1) {
          const idx = msg.searchText.indexOf(query);
          if (idx < 0) continue;

          // Extract snippet with context
          const fullText = msg.searchText;
          const start = Math.max(0, idx - 40);
          const end = Math.min(fullText.length, idx + query.length + 60);
          let snippet = (start > 0 ? '...' : '') +
            fullText.substring(start, end) +
            (end < fullText.length ? '...' : '');

          results.push({
            convIndex: ci,
            msgIndex: mi,
            convName: conv.name || '未命名',
            convUuid: conv.uuid,
            sender: msg.sender,
            timestamp: msg.createdAt,
            snippet,
            query,
            hasThinking: msg.contentBlocks.some(b => b.type === 'thinking'),
            hasTools: this._messageHasToolContent(msg),
            hasFlags: msg.contentBlocks.some(b => b.type === 'flag'),
          });
        } else if (!query && (role !== 'all' || contentType !== 'all' || dateFrom || dateTo)) {
          // Filter-only mode: show first 100 chars of message as snippet
          const snippet = msg.searchText.substring(0, 100) + (msg.searchText.length > 100 ? '...' : '');
          results.push({
            convIndex: ci,
            msgIndex: mi,
            convName: conv.name || '未命名',
            convUuid: conv.uuid,
            sender: msg.sender,
            timestamp: msg.createdAt,
            snippet,
            query: '',
            hasThinking: msg.contentBlocks.some(b => b.type === 'thinking'),
            hasTools: this._messageHasToolContent(msg),
            hasFlags: msg.contentBlocks.some(b => b.type === 'flag'),
          });
        }
      }
    }

    this.results = results;
    const resultsContainer = document.getElementById('search-results-container');
    const statsBar = document.getElementById('search-stats-bar');
    if (resultsContainer && statsBar) {
      this._renderResults(resultsContainer, statsBar);
    }
  }

  _messageHasToolContent(msg) {
    return msg.contentBlocks.some(b => b.type === 'tool_use' || b.type === 'tool_result');
  }

  _renderResults(container, statsBar) {
    container.textContent = '';

    if (this.results.length === 0 && (!this.currentQuery && this.filters.role === 'all' && this.filters.contentType === 'all' && !this.filters.dateFrom && !this.filters.dateTo)) {
      statsBar.style.display = 'none';
      this._renderEmptyState(container);
      return;
    }

    if (this.results.length === 0) {
      statsBar.style.display = 'block';
      statsBar.textContent = t('search.noResults');
      this._renderNoResults(container);
      return;
    }

    // Stats bar
    statsBar.style.display = 'block';
    const convCount = new Set(this.results.map(r => r.convIndex)).size;
    statsBar.textContent = t('search.results', { count: this.results.length, convs: convCount }) +
      (this.results.length >= 200 ? t('search.resultsLimit') : '');

    // Group results by conversation
    const grouped = new Map();
    for (const r of this.results) {
      if (!grouped.has(r.convIndex)) {
        grouped.set(r.convIndex, { convName: r.convName, results: [] });
      }
      grouped.get(r.convIndex).results.push(r);
    }

    for (const [convIdx, group] of grouped) {
      // Conversation group header
      const groupEl = document.createElement('div');
      groupEl.className = 'search-result-group';
      groupEl.style.cssText = 'border-bottom:1px solid var(--border);';

      const groupHeader = document.createElement('div');
      groupHeader.style.cssText = `
        padding: 10px 24px;
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--accent);
        background: var(--bg-secondary);
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

      const groupTitle = document.createElement('span');
      groupTitle.textContent = group.convName;
      groupHeader.appendChild(groupTitle);

      const groupCount = document.createElement('span');
      groupCount.style.cssText = 'font-weight:400;color:var(--text-muted);font-size:0.75rem;';
      groupCount.textContent = group.results.length + t('search.matchCount');
      groupHeader.appendChild(groupCount);

      groupEl.appendChild(groupHeader);

      // Individual results
      for (const r of group.results) {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.style.cssText = `
          padding: 12px 24px 12px 36px;
          cursor: pointer;
          transition: background 0.15s;
          border-bottom: 1px solid var(--separator-color);
        `;
        item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-card-hover)');
        item.addEventListener('mouseleave', () => item.style.background = '');

        // Meta line: sender + time + badges
        const meta = document.createElement('div');
        meta.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;';

        const names = state.get('displayNames');
        const senderSpan = document.createElement('span');
        senderSpan.style.cssText = 'font-size:0.8rem;font-weight:600;color:' + (r.sender === 'human' ? 'var(--accent)' : 'var(--text-primary)') + ';';
        senderSpan.textContent = r.sender === 'human' ? (names.human || 'Human') : (names.assistant || 'Assistant');
        meta.appendChild(senderSpan);

        if (r.timestamp) {
          const timeSpan = document.createElement('span');
          timeSpan.style.cssText = 'font-size:0.75rem;color:var(--text-muted);';
          timeSpan.textContent = formatTimestamp(r.timestamp);
          meta.appendChild(timeSpan);
        }

        if (r.hasThinking) {
          const badge = document.createElement('span');
          badge.className = 'badge badge-thinking';
          badge.textContent = '\uD83D\uDCAD';
          badge.style.cssText += 'font-size:0.65rem;padding:1px 5px;';
          meta.appendChild(badge);
        }
        if (r.hasTools) {
          const badge = document.createElement('span');
          badge.className = 'badge badge-tool';
          badge.textContent = '\uD83D\uDD27';
          badge.style.cssText += 'font-size:0.65rem;padding:1px 5px;';
          meta.appendChild(badge);
        }
        if (r.hasFlags) {
          const badge = document.createElement('span');
          badge.className = 'badge badge-flag';
          badge.textContent = '\u26A0\uFE0F';
          badge.style.cssText += 'font-size:0.65rem;padding:1px 5px;';
          meta.appendChild(badge);
        }

        item.appendChild(meta);

        // Snippet with highlighted match
        const snippetEl = document.createElement('div');
        snippetEl.style.cssText = 'font-size:0.85rem;color:var(--text-secondary);line-height:1.5;word-break:break-word;';

        if (r.query) {
          const lowerSnippet = r.snippet.toLowerCase();
          const matchIdx = lowerSnippet.indexOf(r.query);
          if (matchIdx >= 0) {
            snippetEl.appendChild(document.createTextNode(r.snippet.substring(0, matchIdx)));
            const mark = document.createElement('mark');
            mark.style.cssText = 'background:var(--accent-bg);color:var(--accent);padding:1px 3px;border-radius:2px;font-weight:600;';
            mark.textContent = r.snippet.substring(matchIdx, matchIdx + r.query.length);
            snippetEl.appendChild(mark);
            snippetEl.appendChild(document.createTextNode(r.snippet.substring(matchIdx + r.query.length)));
          } else {
            snippetEl.textContent = r.snippet;
          }
        } else {
          snippetEl.textContent = r.snippet;
        }

        item.appendChild(snippetEl);

        // Click to jump to conversation + message
        item.addEventListener('click', () => {
          this._jumpToMessage(r.convIndex, r.msgIndex, r.convUuid);
        });

        groupEl.appendChild(item);
      }

      container.appendChild(groupEl);
    }
  }

  _jumpToMessage(convIndex, msgIndex, convUuid) {
    const filteredConvs = state.get('filteredConversations') || [];
    const allConvs = state.get('conversations') || [];

    // Find conversation in filtered list
    let targetIdx = filteredConvs.findIndex(c => c.uuid === convUuid);
    if (targetIdx < 0) {
      // Not in filtered list, reset sidebar filter
      resetSidebarFilter();
      targetIdx = allConvs.findIndex(c => c.uuid === convUuid);
      if (targetIdx < 0) targetIdx = convIndex; // ultimate fallback
    }

    // Store the target message index for highlighting
    state.set('highlightMessageIndex', msgIndex);

    // Switch view mode back to conversation
    state.set('viewMode', 'conversation');
    state.set('currentConversationIndex', targetIdx);
  }

  _renderEmptyState(container) {
    const empty = document.createElement('div');
    empty.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted);gap:12px;padding:40px;';

    const icon = document.createElement('div');
    icon.style.cssText = 'font-size:3rem;opacity:0.5;';
    icon.textContent = '\uD83D\uDD0D';
    empty.appendChild(icon);

    const text = document.createElement('div');
    text.style.cssText = 'font-size:1rem;text-align:center;line-height:1.6;';
    text.textContent = '输入关键词或设置筛选条件开始搜索';
    empty.appendChild(text);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:0.8rem;color:var(--text-muted);text-align:center;max-width:360px;line-height:1.5;opacity:0.7;';
    hint.textContent = '支持按关键词、日期范围、发送角色和内容类型组合筛选。点击搜索结果可直接跳转到对应对话的对应位置。';
    empty.appendChild(hint);

    container.appendChild(empty);
  }

  _renderNoResults(container) {
    const empty = document.createElement('div');
    empty.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted);gap:12px;padding:40px;';

    const icon = document.createElement('div');
    icon.style.cssText = 'font-size:2.5rem;opacity:0.5;';
    icon.textContent = '\uD83D\uDE3F';
    empty.appendChild(icon);

    const text = document.createElement('div');
    text.style.cssText = 'font-size:0.95rem;text-align:center;';
    text.textContent = '没有找到匹配的内容，试试换个关键词？';
    empty.appendChild(text);

    container.appendChild(empty);
  }

  _createDateInput(id, placeholder) {
    const input = document.createElement('input');
    input.type = 'date';
    input.id = id;
    input.style.cssText = `
      padding: 6px 10px;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 0.8rem;
      font-family: var(--font-family);
    `;
    return input;
  }

  _createSelect(id, options) {
    const select = document.createElement('select');
    select.id = id;
    select.style.cssText = `
      padding: 6px 10px;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 0.8rem;
      font-family: var(--font-family);
    `;
    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    }
    return select;
  }
}
