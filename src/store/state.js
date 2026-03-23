/**
 * Lightweight pub/sub state management.
 * Components subscribe to state changes via state.on('key', callback).
 * State mutations via state.set('key', value) trigger subscribers.
 */
class Store {
  constructor(initial = {}) {
    this._state = { ...initial };
    this._listeners = {};
  }

  get(key) {
    return this._state[key];
  }

  set(key, value) {
    this._state[key] = value;
    const keyListeners = this._listeners[key];
    if (keyListeners) {
      for (let i = 0; i < keyListeners.length; i++) {
        keyListeners[i](value);
      }
    }
    const wildcard = this._listeners['*'];
    if (wildcard) {
      for (let i = 0; i < wildcard.length; i++) {
        wildcard[i](key, value);
      }
    }
  }

  on(key, fn) {
    if (!this._listeners[key]) this._listeners[key] = [];
    this._listeners[key].push(fn);
    return () => {
      this._listeners[key] = this._listeners[key].filter(f => f !== fn);
    };
  }
}

function loadDisplayNames() {
  try {
    const saved = localStorage.getItem('cv-names');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return { human: 'Synqa', assistant: 'Sylux' };
}

export const state = new Store({
  conversations: [],
  filteredConversations: [],
  currentConversationIndex: -1,
  searchQuery: '',
  filters: { dateFrom: null, dateTo: null, role: 'all', contentType: 'all' },
  theme: localStorage.getItem('cv-theme') || 'auto',
  displayNames: loadDisplayNames(),
  showThinking: true,
  showToolUse: true,
  showFlags: false,
  viewMode: 'conversation', // 'conversation' | 'search'
  loading: false,
  loadingProgress: { current: 0, total: 0 },
  selectedConversations: new Set(),
});
