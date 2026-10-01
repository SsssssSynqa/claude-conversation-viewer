/**
 * Lightweight pub/sub state management.
 * Components subscribe to state changes via state.on('key', callback).
 * State mutations via state.set('key', value) trigger subscribers.
 */
import { normalizeEntry, resolveCollection, createEntry, isSourceMessageId } from '../utils/collection.js';

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

function getStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (e) {
    return null;
  }
}

function loadDisplayNames() {
  try {
    const storage = getStorage();
    const saved = storage ? storage.getItem('cv-names') : null;
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return { human: 'Synqa', assistant: 'Sylux' };
}

const COLLECTION_KEY = 'cv-export-collection';

export const state = new Store({
  conversations: [],
  filteredConversations: [],
  currentConversationIndex: -1,
  searchQuery: '',
  sidebarCollapsed: getStorage()?.getItem('cv-sidebar-collapsed') === 'true',
  lang: getStorage()?.getItem('cv-lang') || 'zh',
  theme: getStorage()?.getItem('cv-theme') || 'light',
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
    const storage = getStorage();
    const saved = storage ? storage.getItem('cv-desensitize-words') : null;
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return [];
}

export function saveDesensitizeWords(words) {
  const storage = getStorage();
  if (storage) storage.setItem('cv-desensitize-words', JSON.stringify(words));
}

function loadExportCollection() {
  try {
    const storage = getStorage();
    const saved = storage ? storage.getItem(COLLECTION_KEY) : null;
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.map(normalizeEntry).filter(Boolean);
    }
  } catch (e) { /* ignore */ }
  return []; // Array of normalized collection entries (see utils/collection.js)
}

/** Persist the current canonical collection. */
export function saveExportCollection() {
  const storage = getStorage();
  if (!storage) return;
  const collection = state.get('exportCollection') || [];
  storage.setItem(COLLECTION_KEY, JSON.stringify(collection));
}

/**
 * Promote reliable legacy matches to source UUIDs and persist the canonical
 * collection after updating state. Unresolved entries remain intact. Consumers
 * use the same resolver when displaying or exporting the collection.
 *
 * @param {Array} entries - raw persisted entries
 * @returns {Array} the canonical collection now stored in state
 */
export function reconcileCollection(entries) {
  const resolved = resolveCollection(entries, state.get('conversations') || []);
  const normalized = resolved.entries.map(entry => {
    const source = resolved.byKey.get(entry.key);
    return source.msg && isSourceMessageId(source.msg.uuid)
      ? createEntry(source.conv, source.msg, source.index, entry.convName)
      : entry;
  });
  state.set('exportCollection', normalized);
  saveExportCollection();
  return normalized;
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
