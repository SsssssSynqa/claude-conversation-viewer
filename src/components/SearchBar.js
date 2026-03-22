/**
 * SearchBar — Global search with filters, snippet results, and highlight.
 * Inserted into toolbar. Results shown in dropdown panel.
 */

import { state } from '../store/state.js';

export class SearchBar {
  constructor(container) {
    this.container = container;
    this.debounceTimer = null;
    this.resultsPanel = null;
    this.render();
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;flex:1;max-width:400px;';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '搜索所有对话内容...';
    input.style.cssText = 'width:100%;padding:8px 12px 8px 32px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:0.85rem;font-family:var(--font-family);';
    input.id = 'global-search';

    // Search icon
    const icon = document.createElement('span');
    icon.style.cssText = 'position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:0.85rem;pointer-events:none;';
    icon.textContent = '\uD83D\uDD0D';

    input.addEventListener('input', () => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.doSearch(input.value), 300);
    });

    input.addEventListener('focus', () => {
      if (input.value.trim() && this.resultsPanel) {
        this.resultsPanel.classList.remove('hidden');
      }
    });

    // Close results on outside click
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target) && this.resultsPanel) {
        this.resultsPanel.classList.add('hidden');
      }
    });

    wrapper.appendChild(icon);
    wrapper.appendChild(input);

    // Results panel
    this.resultsPanel = document.createElement('div');
    this.resultsPanel.className = 'search-results hidden';
    this.resultsPanel.style.cssText = 'position:absolute;top:100%;left:0;right:0;margin-top:4px;max-height:400px;overflow-y:auto;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow);z-index:300;';
    wrapper.appendChild(this.resultsPanel);

    // Filter bar below search
    const filterBar = document.createElement('div');
    filterBar.style.cssText = 'display:flex;gap:8px;align-items:center;';
    filterBar.id = 'filter-bar';

    const roleSelect = this.createFilterSelect('filter-role', [
      { value: 'all', label: '全部角色' },
      { value: 'human', label: '仅人类' },
      { value: 'assistant', label: '仅 AI' },
    ]);

    const typeSelect = this.createFilterSelect('filter-type', [
      { value: 'all', label: '全部类型' },
      { value: 'thinking', label: '有思考' },
      { value: 'tool', label: '有工具' },
      { value: 'flag', label: '有标记' },
    ]);

    filterBar.appendChild(roleSelect);
    filterBar.appendChild(typeSelect);

    roleSelect.addEventListener('change', () => this.applyFilters());
    typeSelect.addEventListener('change', () => this.applyFilters());

    this.container.appendChild(wrapper);
    this.container.appendChild(filterBar);
  }

  createFilterSelect(id, options) {
    const select = document.createElement('select');
    select.id = id;
    select.style.cssText = 'padding:4px 8px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-secondary);font-size:0.75rem;';
    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    }
    return select;
  }

  doSearch(query) {
    query = query.trim().toLowerCase();
    if (!query || query.length < 2) {
      this.resultsPanel.classList.add('hidden');
      this.resultsPanel.textContent = '';
      return;
    }

    const conversations = state.get('conversations') || [];
    const results = [];
    const maxResults = 50;

    for (let ci = 0; ci < conversations.length && results.length < maxResults; ci++) {
      const conv = conversations[ci];
      for (let mi = 0; mi < conv.messages.length && results.length < maxResults; mi++) {
        const msg = conv.messages[mi];
        const idx = msg.searchText.indexOf(query);
        if (idx >= 0) {
          // Extract snippet with context
          const fullText = msg.searchText;
          const start = Math.max(0, idx - 30);
          const end = Math.min(fullText.length, idx + query.length + 30);
          let snippet = (start > 0 ? '...' : '') +
            fullText.substring(start, end) +
            (end < fullText.length ? '...' : '');

          results.push({
            convIndex: ci,
            convName: conv.name || '未命名',
            sender: msg.sender,
            snippet,
            query,
          });
        }
      }
    }

    this.renderResults(results);
  }

  renderResults(results) {
    this.resultsPanel.textContent = '';

    if (results.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:16px;text-align:center;color:var(--text-muted);font-size:0.85rem;';
      empty.textContent = '没有找到匹配内容';
      this.resultsPanel.appendChild(empty);
      this.resultsPanel.classList.remove('hidden');
      return;
    }

    for (const r of results) {
      const item = document.createElement('div');
      item.style.cssText = 'padding:10px 14px;border-bottom:1px solid var(--separator-color);cursor:pointer;transition:background 0.15s;';
      item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-card-hover)');
      item.addEventListener('mouseleave', () => item.style.background = '');

      const header = document.createElement('div');
      header.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;';
      header.textContent = r.convName + ' \u00B7 ' + (r.sender === 'human' ? (state.get('displayNames').human || 'Human') : (state.get('displayNames').assistant || 'Assistant'));
      item.appendChild(header);

      const snippet = document.createElement('div');
      snippet.style.cssText = 'font-size:0.85rem;color:var(--text-secondary);line-height:1.4;';
      // Highlight match in snippet
      const lowerSnippet = r.snippet.toLowerCase();
      const matchIdx = lowerSnippet.indexOf(r.query);
      if (matchIdx >= 0) {
        snippet.appendChild(document.createTextNode(r.snippet.substring(0, matchIdx)));
        const mark = document.createElement('mark');
        mark.style.cssText = 'background:var(--accent-bg);color:var(--accent);padding:1px 2px;border-radius:2px;';
        mark.textContent = r.snippet.substring(matchIdx, matchIdx + r.query.length);
        snippet.appendChild(mark);
        snippet.appendChild(document.createTextNode(r.snippet.substring(matchIdx + r.query.length)));
      } else {
        snippet.textContent = r.snippet;
      }
      item.appendChild(snippet);

      item.addEventListener('click', () => {
        const filteredConvs = state.get('filteredConversations') || [];
        const allConvs = state.get('conversations') || [];
        // Find the conversation in filtered list
        const targetConv = allConvs[r.convIndex];
        const filteredIdx = filteredConvs.findIndex(c => c.uuid === targetConv.uuid);
        if (filteredIdx >= 0) {
          state.set('currentConversationIndex', filteredIdx);
        } else {
          // Not in filtered — clear filters and navigate
          state.set('filteredConversations', allConvs);
          state.set('currentConversationIndex', r.convIndex);
        }
        this.resultsPanel.classList.add('hidden');
      });

      this.resultsPanel.appendChild(item);
    }

    if (results.length >= 50) {
      const more = document.createElement('div');
      more.style.cssText = 'padding:10px;text-align:center;color:var(--text-muted);font-size:0.8rem;';
      more.textContent = '显示前 50 条结果，请缩小搜索范围查看更多';
      this.resultsPanel.appendChild(more);
    }

    this.resultsPanel.classList.remove('hidden');
  }

  applyFilters() {
    const role = document.getElementById('filter-role')?.value || 'all';
    const type = document.getElementById('filter-type')?.value || 'all';
    const allConvs = state.get('conversations') || [];

    let filtered = allConvs;

    if (type !== 'all') {
      filtered = filtered.filter(conv => {
        switch (type) {
          case 'thinking': return conv.stats.hasThinking;
          case 'tool': return conv.stats.hasTools;
          case 'flag': return conv.stats.hasFlags;
          default: return true;
        }
      });
    }

    state.set('filteredConversations', filtered);
    state.set('filters', { ...state.get('filters'), role, contentType: type });
  }
}
