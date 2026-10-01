/**
 * Shared import core — manifest recognition + local conversation import.
 *
 * Single entry point for turning the user's locally chosen files into parsed
 * conversations. It performs only local work (File.text / arrayBuffer + JSZip
 * decompression + JSON parsing). It never fetches, opens, or prefetches any
 * URL, and it ignores the manifest's `instructions` string.
 *
 * No DOM dependency, so it runs both inside the parser web worker (production)
 * and under node:test with synthetic fixtures — the same real code path.
 *
 * Recognized selected files:
 *   - `.json` legacy conversation export: a bare array of conversation objects
 *     `{ uuid, name, summary, created_at, updated_at, chat_messages: [] }`
 *     (see src/parser/claude.js). `chat_messages` may be empty.
 *   - `.json` Claude manifest (download list): `{ version: "1.0", instructions,
 *     created_at, total_files, data_files: [{ batch_index, export_url, category,
 *     part, filename }] }`. No conversation bodies; returned as a guide, never
 *     parsed as conversations.
 *   - `.zip` locally downloaded archive. Members named
 *     `conversations[-_]<digits>?.json` (case-insensitive, possibly nested) are
 *     decompressed and parsed; `__MACOSX/`, dotfiles and the known non-
 *     conversation categories are ignored.
 *
 * Any file extension other than `.json`/`.zip` is rejected. A selected `.zip`
 * that is conversation-relevant (or unrecognized) but yields no recognized
 * conversation JSON fails the whole import — never a silent partial success.
 */

import JSZip from 'jszip';

/** Exact manifest version this build recognizes. */
export const MANIFEST_VERSION = '1.0';

/** Manifest category that holds actual conversations. */
export const CONVERSATION_CATEGORY = 'conversations';

/**
 * Observed non-conversation manifest categories that are safe to ignore when a
 * manifest-guided user picks those packages alongside conversations.
 */
export const IGNORABLE_CATEGORIES = [
  'light_metadata',
  'projects',
  'memories',
  'feedback',
  'frames',
];

/** Conversation JSON member base name inside an archive. */
export const CONVERSATION_JSON_BASENAME_RE = /^conversations[-_]?\d*\.json$/i;

/** Category prefixes we understand ("conversations-000", "projects-001", ...). */
const KNOWN_CATEGORY_BASENAME_RE = /^([a-z_]+?)(?:[-_]\d+)?\.(json|zip)$/i;

const JSON_EXT_RE = /\.json$/i;
const ZIP_EXT_RE = /\.zip$/i;

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function makeError(message, code) {
  const err = new Error(message);
  if (code) err.code = code;
  return err;
}

// ---------------------------------------------------------------------------
// Manifest recognition
// ---------------------------------------------------------------------------

/**
 * Recognize and describe a Claude manifest object (structure only).
 * Does not read, persist, or act on `instructions`, `export_url`, or any other
 * manifest content.
 *
 * @param {unknown} value - parsed JSON value
 * @returns {null | {
 *   version: string,
 *   totalFiles: number,
 *   createdAt: string,
 *   conversationFiles: Array<{ filename: string, category: string, part: number,
 *     batchIndex: number, exportUrl: string }>,
 *   categoryCounts: Object<string, number>,
 *   totalPartCount: number,
 * }}
 */
export function detectManifest(value) {
  if (!isPlainObject(value)) return null;
  if (value.version !== MANIFEST_VERSION) return null;
  if (!Array.isArray(value.data_files)) return null;

  for (const entry of value.data_files) {
    if (!isPlainObject(entry)) return null;
    if (typeof entry.filename !== 'string' || entry.filename === '') return null;
    if (typeof entry.category !== 'string') return null;
  }

  const conversationFiles = [];
  const categoryCounts = {};
  for (const entry of value.data_files) {
    const category = entry.category;
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    if (category === CONVERSATION_CATEGORY) {
      conversationFiles.push({
        filename: entry.filename,
        category,
        part: Number.isFinite(entry.part) ? entry.part : 0,
        batchIndex: Number.isFinite(entry.batch_index) ? entry.batch_index : 0,
        // Display-only. Never fetched, opened, logged, or persisted.
        exportUrl: typeof entry.export_url === 'string' ? entry.export_url : '',
      });
    }
  }

  conversationFiles.sort((a, b) => (a.part - b.part) || (a.batchIndex - b.batchIndex));

  return {
    version: MANIFEST_VERSION,
    totalFiles: Number.isFinite(value.total_files) ? value.total_files : value.data_files.length,
    createdAt: typeof value.created_at === 'string' ? value.created_at : '',
    conversationFiles,
    categoryCounts,
    totalPartCount: conversationFiles.length,
  };
}

/**
 * Category inferred from a manifest/export filename base (last path segment).
 * @param {string} filename
 * @returns {string}
 */
export function categoryOfFilename(filename) {
  const base = String(filename || '').split(/[\\/]/).pop() || '';
  const m = KNOWN_CATEGORY_BASENAME_RE.exec(base);
  return m ? m[1].toLowerCase() : '';
}

// ---------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------

/**
 * Normalize one parsed JSON value into an array of raw conversation objects.
 *
 * Supported shapes:
 *   - bare array of conversation objects -> used as-is
 *   - single conversation object with `chat_messages` array -> wrapped
 *   - empty array -> []
 *
 * @param {unknown} value
 * @returns {Array<object>} raw conversation objects (possibly empty)
 * @throws {Error} code `unsupported_shape` on any other shape
 */
export function extractConversationsFromJson(value) {
  if (Array.isArray(value)) return value;
  if (isPlainObject(value) && Array.isArray(value.chat_messages)) return [value];
  throw makeError('unsupported_json_shape', 'unsupported_shape');
}

function normalizeArchivePath(name) {
  return String(name || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

/**
 * Decide whether an archive member path is a conversation JSON candidate.
 * @param {string} path
 * @returns {boolean}
 */
export function isConversationJsonPath(path) {
  const normalized = normalizeArchivePath(path);
  if (!normalized) return false;
  const segments = normalized.split('/');
  if (segments[0] === '__MACOSX') return false;
  const base = segments[segments.length - 1];
  if (!base || base.startsWith('.')) return false;
  return CONVERSATION_JSON_BASENAME_RE.test(base);
}

/**
 * Collect and sort conversation-JSON member names from an archive listing
 * (plain `{ name, dir }` objects, e.g. Object.values(zip.files)).
 *
 * @param {Array<{name: string, dir?: boolean}>} entries
 * @returns {Array<{ path: string, part: number }>}
 */
export function selectConversationJsonEntries(entries) {
  const result = [];
  for (const entry of entries || []) {
    if (!entry || entry.dir) continue;
    const path = normalizeArchivePath(entry.name);
    if (!isConversationJsonPath(path)) continue;
    const base = path.split('/').pop();
    const m = /^conversations[-_]?(\d+)\.json$/i.exec(base);
    result.push({ path, part: m ? parseInt(m[1], 10) : 0 });
  }
  result.sort((a, b) => (a.part - b.part) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return result;
}

/**
 * Decide whether a ZIP should be treated as conversation-relevant: it contains
 * a conversation JSON member, or its own filename references the conversations
 * category. Unrecognized ZIPs fail rather than being silently ignored.
 * @param {File|{name?:string}} file
 * @param {Array<{name:string,dir?:boolean}>} entries
 */
export function isConversationRelevantZip(file, entries) {
  if (selectConversationJsonEntries(entries).length > 0) return true;
  return categoryOfFilename(file?.name || '') === CONVERSATION_CATEGORY;
}

// ---------------------------------------------------------------------------
// Deduplication + assembly
// ---------------------------------------------------------------------------

/**
 * Merge multiple raw conversation arrays into one deduplicated set.
 *
 * Deterministic UUID dedup policy (single canonical pass):
 *   - The first occurrence of a UUID wins; later duplicates are dropped and
 *     counted.
 *   - Rows without a non-empty string UUID are never deduplicated.
 *   - Input order is preserved; the caller sorts parsed results afterward.
 *
 * @param {Array<Array<object>>} arrays
 * @returns {{ conversations: Array<object>, duplicates: number }}
 * @throws {Error} code `unsupported_shape` when a row is not an object
 */
export function mergeRawConversations(arrays) {
  const seen = new Set();
  const out = [];
  let duplicates = 0;
  for (const arr of arrays || []) {
    for (const item of arr || []) {
      if (!isPlainObject(item)) {
        throw makeError('conversation_row_not_object', 'unsupported_shape');
      }
      const uuid = item.uuid;
      if (typeof uuid === 'string' && uuid.length > 0) {
        if (seen.has(uuid)) {
          duplicates++;
          continue;
        }
        seen.add(uuid);
      }
      out.push(item);
    }
  }
  return { conversations: out, duplicates };
}

/**
 * Stable newest-first sort by created_at, matching the previous worker behavior.
 * @param {Array<{createdAt?: string}>} parsed
 * @returns {Array} sorted copy
 */
export function sortConversationsByDate(parsed) {
  return parsed.slice().sort((a, b) => {
    if (!a.createdAt || !b.createdAt) return 0;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

/**
 * Import already-parsed conversation JSON values in ONE transaction.
 *
 * @param {Array<{ label: string, value: unknown }>} sources
 * @param {{ parseConversation: (raw: object) => object|null, onProgress?: Function }} deps
 * @returns {{ conversations: Array<object>, totalRaw: number, duplicates: number }}
 * @throws {Error} code `unsupported_shape` when any source has an unsupported
 *   shape. On throw, nothing is committed to state.
 */
export function importConversationSources(sources, deps) {
  const { parseConversation, onProgress } = deps || {};
  if (typeof parseConversation !== 'function') {
    throw makeError('importConversationSources requires parseConversation');
  }

  // Phase 1: validate + normalize EVERY source up front (transactional).
  const rawPerSource = [];
  for (const source of sources || []) {
    const rows = extractConversationsFromJson(source.value);
    // A conversation row must be an object with a chat_messages array (it may
    // be empty). Anything else fails the whole import — never a silent skip.
    for (const row of rows) {
      if (!isPlainObject(row) || !Array.isArray(row.chat_messages)) {
        throw makeError('conversation_row_not_conversation', 'unsupported_shape');
      }
    }
    rawPerSource.push(rows);
  }

  const merged = mergeRawConversations(rawPerSource);
  const totalRaw = merged.conversations.length;
  const parsed = [];
  for (let i = 0; i < totalRaw; i++) {
    const conv = parseConversation(merged.conversations[i]);
    if (conv) parsed.push(conv);
    if (typeof onProgress === 'function') onProgress(i + 1, totalRaw);
  }

  return {
    conversations: sortConversationsByDate(parsed),
    totalRaw,
    duplicates: merged.duplicates,
  };
}

// ---------------------------------------------------------------------------
// File reading + the single async import entry
// ---------------------------------------------------------------------------

function splitByExtension(files) {
  const json = [];
  const zip = [];
  const unsupported = [];
  for (const file of files || []) {
    const name = file?.name || '';
    if (JSON_EXT_RE.test(name)) json.push(file);
    else if (ZIP_EXT_RE.test(name)) zip.push(file);
    else unsupported.push(name);
  }
  return { json, zip, unsupported };
}

/**
 * Read a selected File/Blob as text (local only).
 * @param {File|{name:string,text?:Function}} file
 * @returns {Promise<string>}
 */
export async function readFileText(file) {
  if (file && typeof file.text === 'function') return file.text();
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(makeError('file_read_failed', 'read_failed'));
      reader.readAsText(file);
    });
  }
  throw makeError('file_read_failed', 'read_failed');
}

/** Read a selected File/Blob as an ArrayBuffer (local only). */
async function readFileArrayBuffer(file) {
  if (file && typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return file;
}

function parseJsonText(text, label) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw makeError(`${label}: invalid JSON`, 'invalid_json');
  }
}

/** Load a ZIP File/Blob with JSZip (local only). */
async function loadZipWith(file) {
  const data = await readFileArrayBuffer(file);
  try {
    return await JSZip.loadAsync(data);
  } catch (e) {
    const err = makeError(`${file?.name || 'zip'}: zip_read_failed`, 'zip_read_failed');
    err.file = file?.name;
    throw err;
  }
}

/**
 * The single import entry used by the worker (and by tests).
 *
 * Reads the selected File/Blob objects, decompresses ZIPs locally with JSZip,
 * recognizes manifests, and returns parsed conversations in one transaction.
 * Never performs network access.
 *
 * @param {Object} payload
 * @param {Array<File|{name:string,text?:Function,arrayBuffer?:Function}>} payload.files
 * @param {(raw: object) => object|null} payload.parseConversation
 * @param {(current:number, total:number) => void} [payload.onProgress]
 * @returns {Promise<
 *   { type:'manifest', manifest:object } |
 *   { type:'done', conversations:Array, total:number, duplicates:number,
 *     fileMeta:Array, ignoredUnrelated:boolean }>}
 * @throws {Error} with `.code` in {unsupported_selected_file,
 *   unsupported_selected_zip, unsupported_shape, invalid_json, zip_read_failed,
 *   read_failed}
 */
export async function importSelectedFiles(payload) {
  const {
    files,
    parseConversation,
    onProgress,
  } = payload || {};

  if (typeof parseConversation !== 'function') {
    throw makeError('importSelectedFiles requires parseConversation');
  }

  const list = Array.from(files || []);
  const { json, zip, unsupported } = splitByExtension(list);

  if (unsupported.length > 0) {
    const err = makeError(`${unsupported[0]}: unsupported file type`, 'unsupported_selected_file');
    err.file = unsupported[0];
    throw err;
  }

  // Cache metadata derived from all accepted selected inputs.
  const fileMeta = list.map(f => ({ fileName: f.name || '', fileSize: Number(f.size) || 0 }));

  const sources = [];
  const deferredZips = [];
  let manifest = null;
  let ignoredUnrelated = false;

  // JSON files: recognize manifests first; other JSON is conversation data.
  for (const file of json) {
    const value = parseJsonText(await readFileText(file), file.name);
    const detected = detectManifest(value);
    if (detected) {
      manifest = detected;
      continue;
    }
    sources.push({ label: file.name, value });
  }

  // ZIPs: decompress locally; extract conversation members; ignore known
  // unrelated categories; fail on unknown/unsupported packages.
  for (const file of zip) {
    const zipObj = await loadZipWith(file);
    const entries = Object.values(zipObj.files);
    const selected = selectConversationJsonEntries(entries);
    if (selected.length > 0) {
      for (const entry of selected) deferredZips.push({ file, zipObj, entry });
      continue;
    }
    // Respect the observed package category from the FILENAME. A known,
    // unrelated category (e.g. memories-000.zip) is ignored even when its
    // members use opaque/UUID basenames; we never read those bodies.
    const packageCategory = categoryOfFilename(file.name || '');
    if (IGNORABLE_CATEGORIES.includes(packageCategory)) {
      ignoredUnrelated = true;
      continue;
    }
    // A conversations-category package must actually contain conversation
    // JSON — it cannot hide behind other-category members.
    const err = isConversationRelevantZip(file, entries)
      ? makeError(`${file.name}: no recognized conversation JSON`, 'unsupported_selected_zip')
      : makeError(`${file.name}: unsupported archive`, 'unsupported_selected_zip');
    err.file = file.name;
    throw err;
  }

  // A manifest without any conversation data is a guide, not an error.
  if (manifest && sources.length === 0 && deferredZips.length === 0) {
    return { type: 'manifest', manifest };
  }

  // Only non-conversation packages were selected (e.g. memories/*.zip): this
  // viewer imports conversations only, so say so explicitly rather than
  // reporting a generic empty result.
  if (sources.length === 0 && deferredZips.length === 0 && ignoredUnrelated) {
    return { type: 'no_conversations', fileMeta, ignoredUnrelated: true };
  }

  for (const { file, zipObj, entry } of deferredZips) {
    let text;
    try {
      const member = zipObj.file(entry.path);
      if (!member) throw new Error('member missing');
      text = await member.async('string');
    } catch (e) {
      throw makeError(`${file.name}/${entry.path}: zip_read_failed`, 'zip_read_failed');
    }
    sources.push({
      label: `${file.name}/${entry.path}`,
      value: parseJsonText(text, `${file.name}/${entry.path}`),
    });
  }

  const result = importConversationSources(sources, { parseConversation, onProgress });
  return {
    type: 'done',
    conversations: result.conversations,
    total: result.totalRaw,
    duplicates: result.duplicates,
    fileMeta,
    ignoredUnrelated,
  };
}
