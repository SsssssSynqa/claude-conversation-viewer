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
  sidebarCollapsed: localStorage.getItem('cv-sidebar-collapsed') === 'true',
  lang: localStorage.getItem('cv-lang') || 'zh',
  theme: localStorage.getItem('cv-theme') || 'light',
  displayNames: loadDisplayNames(),
  showThinking: true,
  showToolUse: true,
  showFlags: false,
  desensitize: false, // Data masking mode
  desensitizeWords: loadDesensitizeWords(),
  viewMode: 'stats', // 'conversation' | 'search' | 'export' | 'stats'
  loading: false,
  loadingProgress: { current: 0, total: 0 },
  // Export collection ("精选集")
  exportCollection: loadExportCollection(),
});

function loadDesensitizeWords() {
  try {
    const saved = localStorage.getItem('cv-desensitize-words');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return [];
}

export function saveDesensitizeWords(words) {
  localStorage.setItem('cv-desensitize-words', JSON.stringify(words));
}

function loadExportCollection() {
  try {
    const saved = localStorage.getItem('cv-export-collection');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return []; // Array of { convUuid, convName, msgIndex, sender, preview, timestamp }
}

export function saveExportCollection() {
  const collection = state.get('exportCollection');
  localStorage.setItem('cv-export-collection', JSON.stringify(collection));
}

/**
 * Reset sidebar search filter to show all conversations.
 * Use this instead of manually setting searchQuery + filteredConversations
 * in multiple components — keeps the "reset sidebar" logic in one place.
 */
export function resetSidebarFilter() {
  state.set('filteredConversations', state.get('conversations') || []);
  state.set('searchQuery', '');
}
