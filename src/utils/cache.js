/**
 * IndexedDB cache for parsed conversation data.
 * Stores parsed conversations so users don't need to re-upload large JSON files.
 * Data is chunked to avoid IndexedDB size limits per entry.
 */

const DB_NAME = 'cv-cache';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save parsed conversations to IndexedDB (chunked).
 * @param {Array} conversations - Parsed conversation array
 * @param {Object} metadata - { fileSize, fileName, parseDate }
 */
export async function saveToCache(conversations, metadata = {}) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Clear old data
    store.clear();

    // Save metadata
    store.put({
      id: 'meta',
      type: 'metadata',
      convCount: conversations.length,
      fileName: metadata.fileName || '',
      fileSize: metadata.fileSize || 0,
      parseDate: new Date().toISOString(),
      version: 2, // Cache version for invalidation
    });

    // Chunk the data
    const jsonStr = JSON.stringify(conversations);
    const totalChunks = Math.ceil(jsonStr.length / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = jsonStr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      store.put({
        id: 'chunk_' + i,
        type: 'data',
        data: chunk,
        index: i,
        total: totalChunks,
      });
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    db.close();
    return true;
  } catch (e) {
    console.warn('Cache save failed:', e);
    return false;
  }
}

/**
 * Load cached conversations from IndexedDB.
 * @returns {{ conversations: Array, metadata: Object } | null}
 */
export async function loadFromCache() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    // Check metadata
    const metaReq = store.get('meta');
    const meta = await new Promise((resolve, reject) => {
      metaReq.onsuccess = () => resolve(metaReq.result);
      metaReq.onerror = () => reject(metaReq.error);
    });

    if (!meta || meta.version !== 2) {
      db.close();
      return null;
    }

    // Load all chunks
    const allReq = store.getAll();
    const allEntries = await new Promise((resolve, reject) => {
      allReq.onsuccess = () => resolve(allReq.result);
      allReq.onerror = () => reject(allReq.error);
    });

    db.close();

    const chunks = allEntries
      .filter(e => e.type === 'data')
      .sort((a, b) => a.index - b.index);

    if (chunks.length === 0) return null;

    const jsonStr = chunks.map(c => c.data).join('');
    const conversations = JSON.parse(jsonStr);

    return {
      conversations,
      metadata: {
        convCount: meta.convCount,
        fileName: meta.fileName,
        fileSize: meta.fileSize,
        parseDate: meta.parseDate,
      },
    };
  } catch (e) {
    console.warn('Cache load failed:', e);
    return null;
  }
}

/**
 * Check if cache exists without loading data.
 * @returns {Object|null} metadata or null
 */
export async function getCacheInfo() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const metaReq = store.get('meta');
    const meta = await new Promise((resolve, reject) => {
      metaReq.onsuccess = () => resolve(metaReq.result);
      metaReq.onerror = () => reject(metaReq.error);
    });
    db.close();
    if (!meta || meta.version !== 2) return null;
    return {
      convCount: meta.convCount,
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      parseDate: meta.parseDate,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Clear the cache.
 */
export async function clearCache() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    await new Promise((resolve) => { tx.oncomplete = resolve; });
    db.close();
  } catch (e) {
    console.warn('Cache clear failed:', e);
  }
}
