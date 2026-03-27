/**
 * ConversationList — Left panel with grouped, searchable conversation list.
 */

import { state } from '../store/state.js';
import { formatDate, formatMonthKey, formatMonthLabel } from '../utils/time.js';
import { createIcon } from '../utils/icons.js';

export class ConversationList {
  constructor(container) {
    this.container = container;
    this.searchInput = null;
    this.listEl = null;
    this._unsubs = [];
    this.render();
    this._unsubs.push(state.on('filteredConversations', () => this.renderList()));
    this._unsubs.push(state.on('currentConversationIndex', () => this.renderList()));
    this._unsubs.push(state.on('searchQuery', (query) => {
      if (this.searchInput && this.searchInput.value !== query) {
        this.searchInput.value = query;
      }
    }));
  }

  destroy() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
  }

  render() {
    // Search box — neumorphic pill input
    const searchBox = document.createElement('div');
    searchBox.style.cssText = 'padding:8px 16px 8px;';

    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'sidebar-pill pill-input';

    const searchIconEl = document.createElement('span');
    searchIconEl.className = 'nav-icon';
    searchIconEl.appendChild(createIcon('search', 16));

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.className = 'history-search-input';
    this.searchInput.placeholder = '搜索对话标题...';
    this.searchInput.value = state.get('searchQuery') || '';
    this.searchInput.addEventListener('input', () => this.onSearch());

    searchWrapper.appendChild(searchIconEl);
    searchWrapper.appendChild(this.searchInput);
    searchBox.appendChild(searchWrapper);
    this.container.appendChild(searchBox);

    // List container
    this.listEl = document.createElement('div');
    this.listEl.style.cssText = 'flex:1;overflow-y:auto;padding:0 10px 16px 16px;';
    this.container.appendChild(this.listEl);

    this.renderList();
  }

  onSearch() {
    const query = this.searchInput.value.toLowerCase().trim();
    state.set('searchQuery', query);
    const all = state.get('conversations');
    if (!query) {
      state.set('filteredConversations', all);
      return;
    }
    const filtered = all.filter(c =>
      (c.name || '').toLowerCase().includes(query) ||
      (c.summary || '').toLowerCase().includes(query)
    );
    state.set('filteredConversations', filtered);
  }

  renderList() {
    const conversations = state.get('filteredConversations') || [];
    const currentIndex = state.get('currentConversationIndex');
    this.listEl.textContent = '';

    if (conversations.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:40px 20px;text-align:center;color:var(--text-muted);';
      empty.textContent = '没有找到对话';
      this.listEl.appendChild(empty);
      return;
    }

    // Group by month
    const groups = new Map();
    for (let i = 0; i < conversations.length; i++) {
      const conv = conversations[i];
      const key = formatMonthKey(conv.createdAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ conv, index: i });
    }

    for (const [monthKey, items] of groups) {
      // Month header
      const header = document.createElement('div');
      header.style.cssText = 'padding:12px 14px 4px;font-size:11px;color:var(--text-muted);font-weight:600;';
      header.textContent = formatMonthLabel(monthKey);
      this.listEl.appendChild(header);

      for (const { conv, index } of items) {
        const item = document.createElement('div');
        const isActive = index === currentIndex;
        item.className = 'sidebar-pill ' + (isActive ? 'pill-active' : 'pill-flat');
        item.style.cssText = `
          padding: 10px 16px;
          margin: 3px 0;
          cursor: pointer;
          font-size: 13px;
          height: auto;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        `;

        // Title
        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size:0.9rem;color:var(--sidebar-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;';
        titleEl.textContent = conv.name || '未命名对话';
        item.appendChild(titleEl);

        // Meta line
        const meta = document.createElement('div');
        meta.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-top:3px;display:flex;gap:8px;align-items:center;';

        const dateSpan = document.createElement('span');
        dateSpan.textContent = formatDate(conv.createdAt);
        meta.appendChild(dateSpan);

        const countSpan = document.createElement('span');
        countSpan.textContent = conv.stats.messageCount + ' 条';
        meta.appendChild(countSpan);

        if (conv.stats.hasThinking) {
          const thinkBadge = document.createElement('span');
          thinkBadge.textContent = '\uD83D\uDCAD';
          thinkBadge.title = '包含思考过程';
          thinkBadge.style.fontSize = '0.7rem';
          meta.appendChild(thinkBadge);
        }

        if (conv.stats.hasFlags) {
          const flagBadge = document.createElement('span');
          flagBadge.textContent = '\u26A0\uFE0F';
          flagBadge.title = '包含系统标记';
          flagBadge.style.fontSize = '0.7rem';
          meta.appendChild(flagBadge);
        }

        item.appendChild(meta);

        item.addEventListener('click', () => {
          state.set('viewMode', 'conversation');
          state.set('currentConversationIndex', index);
        });

        this.listEl.appendChild(item);
      }
    }
  }
}
