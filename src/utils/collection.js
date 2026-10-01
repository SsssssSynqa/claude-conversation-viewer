/**
 * Collection ("精选集") identity + resolution.
 *
 * A collected message is primarily identified by the SOURCE conversation UUID
 * plus (whenever the export carries one) the SOURCE message UUID. When those
 * are absent (positions/generated ids, or conversations with no uuid at all)
 * identity falls back to conservative evidence matching: sender + the exact
 * captured 80-char preview prefix + exact timestamp, and only when exactly one
 * message matches. An index is NEVER treated as identity.
 *
 * `resolveCollection` is the single authoritative resolver shared by the
 * message view (collected-button state, dedup on add) and the export panel
 * (availability, export builders).
 */

/** Parser fallback id pattern for messages missing a source UUID. */
const GENERATED_ID_RE = /^msg_\d+$/;

/** Length of the preview prefix captured when a message is collected. */
const PREVIEW_LENGTH = 80;

/**
 * True when `id` is an actual source message UUID (not a generated
 * positional id and not empty).
 */
export function isSourceMessageId(id) {
  return typeof id === 'string' && id.length > 0 && !GENERATED_ID_RE.test(id);
}

/** The exact preview string captured for a message when it is collected. */
export function capturePreview(msg) {
  return String((msg && msg.searchText) || '').substring(0, PREVIEW_LENGTH);
}

/** Normalize an ISO timestamp to epoch ms (or null when unusable). */
function timeMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Deterministic key describing a conversation for uuid-less identification.
 * Keeps different uuid-less conversations distinct without hashing: uses the
 * conversation name + its first message timestamp. Returns null when there is
 * no usable discriminator at all (caller must then treat collection as
 * ambiguous rather than merging conversations).
 */
export function conversationKey(conv) {
  if (!conv) return null;
  if (conv.uuid) return conv.uuid;
  const messages = Array.isArray(conv.messages) ? conv.messages : [];
  const first = messages.length > 0 ? messages[0] : null;
  const stamp = (conv.createdAt || (first && first.createdAt) || '').trim();
  const name = (conv.name || '').trim();
  if (name || stamp) return '\u0000nokey:' + name + '\u0000' + stamp;
  // Last resort: a stable discriminator drawn from the first message's source
  // uuid / preview / first block text. Avoids collapsing distinct anonymous
  // conversations; may fail for two truly identical conversations, in which
  // case resolution stays conservative (ambiguous -> unavailable).
  if (first) {
    const sig = isSourceMessageId(first.uuid)
      ? first.uuid
      : String(first.searchText || '').substring(0, 80) || String((first.contentBlocks && first.contentBlocks[0] && first.contentBlocks[0].text) || '');
    if (sig) return '\u0000nokey:\u0000first:' + sig;
  }
  return null;
}

/** The exact-prefix preview captured from a message (lowercased for compare). */
function messagePreview(msg) {
  return capturePreview(msg).toLowerCase();
}

/**
 * Find the single message in `conv` an entry refers to, or report why not.
 *
 * Resolution order:
 *   1. Source message uuid -> exact match (unique by construction).
 *   2. Evidence: sender + exact 80-char preview prefix + exact timestamp.
 *      Requires at least a preview or a timestamp as useful evidence.
 *   3. Nothing usable -> { status: 'ambig' }.
 *
 * @returns {{status:'ok', index:number, msg:object}
 *          |{status:'ambig'}
 *          |{status:'nomatch'}}
 */
function matchEntryToConversation(entry, conv) {
  if (!entry || !conv || !Array.isArray(conv.messages)) return { status: 'ambig' };

  if (isSourceMessageId(entry.msgUuid)) {
    const idx = conv.messages.findIndex(m => m && m.uuid === entry.msgUuid);
    if (idx >= 0) return { status: 'ok', index: idx, msg: conv.messages[idx] };
    return { status: 'nomatch' };
  }

  const sender = entry.sender || null;
  const preview = String(entry.preview || '').toLowerCase();
  const eTs = timeMs(entry.timestamp);
  const hasPreview = preview.length > 0;

  // Require useful evidence; sender alone is not enough.
  if (!hasPreview && eTs == null) return { status: 'ambig' };

  const candidates = [];
  for (let i = 0; i < conv.messages.length; i++) {
    const msg = conv.messages[i];
    if (!msg) continue;
    if (sender && msg.sender !== sender) continue;
    if (hasPreview && messagePreview(msg) !== preview) continue;
    candidates.push({ index: i, msg });
  }

  if (eTs != null) {
    // Exact timestamp (epoch-equivalent) match only.
    const withTime = candidates.filter(c => timeMs(c.msg.createdAt) === eTs);
    if (withTime.length === 1) return { status: 'ok', index: withTime[0].index, msg: withTime[0].msg };
    if (withTime.length > 1) return { status: 'ambig' };
    return { status: 'nomatch' };
  }

  // No timestamp evidence: bind only on a single exact-prefix match.
  if (candidates.length === 1) return { status: 'ok', index: candidates[0].index, msg: candidates[0].msg };
  return { status: 'ambig' };
}

/**
 * Build the canonical identity string for an entry targeting a concrete
 * message. Source uuids are stable across reorder; positional/generated and
 * uuid-less conversations use conversation key + message evidence.
 */
export function identityForMessage(conv, msg) {
  const ck = conversationKey(conv);
  if (!ck) return null;
  if (isSourceMessageId(msg && msg.uuid)) return ck + '::' + msg.uuid;
  return ck + '#fallback:' + JSON.stringify([msg.sender || null, capturePreview(msg), timeMs(msg.createdAt)]);
}

/**
 * Normalize a persisted entry into the canonical shape, retaining legacy keys
 * so nothing is dropped. Never invents a new identity.
 */
export function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const convUuid = typeof raw.convUuid === 'string' ? raw.convUuid : '';
  const convName = typeof raw.convName === 'string' ? raw.convName : '';

  let msgUuid = isSourceMessageId(raw.msgUuid) ? raw.msgUuid : null;
  const hasIndex = Number.isInteger(raw.msgIndex) && raw.msgIndex >= 0;

  // Keep the persisted key verbatim; accept legacy `convUuid:index` and any
  // prior identity string without inventing a new one.
  let key = typeof raw.key === 'string' && raw.key ? raw.key : null;
  if (key && convUuid && key.startsWith(convUuid + '::')) {
    const tail = key.slice(convUuid.length + 2);
    if (isSourceMessageId(tail)) msgUuid = msgUuid || tail;
  }
  if (!key) return null;

  return {
    key,
    convUuid,
    convName,
    convKey: typeof raw.convKey === 'string' ? raw.convKey : null,
    msgUuid,
    msgIndex: hasIndex ? raw.msgIndex : null,
    sender: typeof raw.sender === 'string' ? raw.sender : null,
    preview: typeof raw.preview === 'string' ? raw.preview : '',
    timestamp: raw.timestamp || null,
  };
}

/**
 * Group currently-loaded conversations so entries can find their source.
 * Returns a lookup keyed by conversation uuid plus a list of uuid-less
 * conversations for evidence-based lookup.
 */
function indexConversations(conversations) {
  const byUuid = new Map();
  const uuidLess = [];
  for (const conv of conversations || []) {
    if (!conv) continue;
    if (conv.uuid) byUuid.set(conv.uuid, conv);
    else uuidLess.push(conv);
  }
  return { byUuid, uuidLess };
}

/**
 * Resolve one entry against loaded conversations using only reliable binding.
 * For uuid-less conversations the entry must match exactly one conversation
 * (by conversation key, else by unique message evidence).
 *
 * @returns {{conv:object|null, msg:object|null, index:number|null}}
 */
function resolveEntry(entry, indexed) {
  const { byUuid, uuidLess } = indexed;

  if (entry.convUuid) {
    const conv = byUuid.get(entry.convUuid) || null;
    if (!conv) return { conv: null, msg: null, index: null };
    const match = matchEntryToConversation(entry, conv);
    if (match.status === 'ok') return { conv, msg: match.msg, index: match.index };
    return { conv, msg: null, index: null };
  }

  // Conversation uuid absent: find the unique uuid-less conversation match.
  const matches = [];
  for (const conv of uuidLess) {
    if (entry.convKey ? conversationKey(conv) !== entry.convKey : entry.convName && conv.name !== entry.convName) continue;
    const match = matchEntryToConversation(entry, conv);
    if (match.status === 'ok') matches.push({ conv, msg: match.msg, index: match.index });
  }
  if (matches.length === 1) return matches[0];
  return { conv: null, msg: null, index: null };
}

/**
 * Resolve a whole collection. This is THE authoritative resolver.
 *
 * @returns {{
 *   entries: Array,               // normalized, order preserved
 *   ordered: Array,               // entries in current source order
 *   byKey: Map<string,{conv,msg,index}>,
 *   availableCount: number,
 *   unavailableCount: number,
 * }}
 */
export function resolveCollection(rawEntries, conversations) {
  const byKey = new Map();
  const seenKeys = new Set();
  const seenResolved = new Map();
  const entries = [];
  const indexed = indexConversations(conversations);

  for (const raw of rawEntries || []) {
    const entry = normalizeEntry(raw);
    if (!entry || seenKeys.has(entry.key)) continue;
    seenKeys.add(entry.key);

    const res = resolveEntry(entry, indexed);
    // Dedup entries that resolve to the same message (e.g. a legacy entry and
    // a canonical entry for the same source) so collected state and exports
    // count it once. Unresolved entries are always kept.
    if (res.msg) {
      if (!seenResolved.has(res.conv)) seenResolved.set(res.conv, new Set());
      const indices = seenResolved.get(res.conv);
      if (indices.has(res.index)) continue;
      indices.add(res.index);
    }
    byKey.set(entry.key, res);
    entries.push(entry);
  }

  let availableCount = 0;
  for (const entry of entries) {
    if (byKey.get(entry.key).msg) availableCount++;
  }

  const orderByConversation = new Map((conversations || []).map((c, i) => [c, i]));

  const decorated = entries.map((entry, i) => {
    const res = byKey.get(entry.key);
    const convOrder = res.conv ? orderByConversation.get(res.conv) : Infinity;
    return { entry, i, convOrder, msgOrder: res.index == null ? 99999 : res.index };
  });

  decorated.sort((a, b) => {
    if (a.convOrder !== b.convOrder) return a.convOrder - b.convOrder;
    if (a.msgOrder !== b.msgOrder) return a.msgOrder - b.msgOrder;
    return a.i - b.i;
  });

  return {
    entries,
    ordered: decorated.map(d => d.entry),
    byKey,
    availableCount,
    unavailableCount: entries.length - availableCount,
  };
}

/**
 * Build the exportable conversations (only reliably-resolved messages), in
 * current source order. Conversations with no resolved messages are omitted.
 */
export function collectionConversations(resolved, conversations) {
  const grouped = new Map();
  for (const entry of resolved.ordered) {
    const res = resolved.byKey.get(entry.key);
    if (!res || !res.msg) continue;
    if (!grouped.has(res.conv)) grouped.set(res.conv, []);
    grouped.get(res.conv).push(res.msg);
  }
  const result = [];
  for (const conv of conversations || []) {
    const messages = grouped.get(conv);
    if (!messages) continue;
    result.push({ ...conv, messages, stats: { ...conv.stats, messageCount: messages.length } });
  }
  return result;
}

/**
 * Build an entry for a message the user is collecting right now.
 * Returns null only when the conversation has no usable discriminator at all.
 */
export function createEntry(conv, msg, index, convNameFallback) {
  if (!conv || !msg) return null;
  const identity = identityForMessage(conv, msg, index);
  if (!identity) return null;
  return {
    key: identity,
    convUuid: conv.uuid || '',
    convName: conv.name || convNameFallback || '',
    convKey: conv.uuid ? null : conversationKey(conv),
    msgUuid: isSourceMessageId(msg.uuid) ? msg.uuid : null,
    msgIndex: Number.isInteger(index) && index >= 0 ? index : null,
    sender: msg.sender || null,
    preview: capturePreview(msg),
    timestamp: msg.createdAt || null,
  };
}
