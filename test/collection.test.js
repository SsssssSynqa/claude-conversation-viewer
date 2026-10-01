/**
 * Regression tests for collection ("精选集") persistence, identity and export.
 *
 * These tests drive the REAL consumers:
 *   - utils/collection.resolveCollection (the single authoritative resolver)
 *   - components/ExportPanel (availability + the four export builders)
 *   - components/MessageView add paths (single / add-all / selection toolbar)
 *   - store/state reconcileCollection + localStorage persistence
 *
 * Synthetic data only. No personal exports.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// --- mutable localStorage shim, installed before the store is imported ---
const storageMap = new Map();
globalThis.localStorage = {
  getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
  setItem: (k, v) => { storageMap.set(k, String(v)); },
  removeItem: (k) => { storageMap.delete(k); },
};

const { installDom } = await import('./dom.mjs');
installDom();

const { parseConversation } = await import('../src/parser/claude.js');
const {
  resolveCollection,
  collectionConversations,
  isSourceMessageId,
  createEntry,
  conversationKey,
  capturePreview,
} = await import('../src/utils/collection.js');
const { state, saveExportCollection, reconcileCollection } = await import('../src/store/state.js');
const { ExportPanel } = await import('../src/components/ExportPanel.js');
const { MessageView } = await import('../src/components/MessageView.js');
const { exportAsText, exportAsMarkdown, exportAsHTML } = await import('../src/utils/export.js');

// ---------------------------------------------------------------- fixtures

function rawConv(uuid, name, messages) {
  return {
    uuid,
    name,
    summary: '',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    chat_messages: messages.map((m) => ({
      uuid: m.uuid,
      sender: m.sender,
      created_at: m.createdAt || '2024-01-01T00:00:00Z',
      content: [{ type: 'text', text: m.text }],
    })),
  };
}

const conv = (uuid, name, messages) => parseConversation(rawConv(uuid, name, messages));

const C1 = () => conv('conv-1', 'First', [
  { uuid: 'm-1a', sender: 'human', createdAt: '2024-01-01T00:00:00Z', text: 'alpha one' },
  { uuid: 'm-1b', sender: 'assistant', createdAt: '2024-01-01T00:01:00Z', text: 'alpha reply' },
  { uuid: 'm-1c', sender: 'human', createdAt: '2024-01-01T00:02:00Z', text: 'beta question' },
]);

/** Build a persisted entry the way MessageView now does (real createEntry). */
function entryFor(c, msg, index) {
  return createEntry(c, msg, index, 'unnamed');
}

function renderedText(panel) {
  return JSON.stringify(panel._buildCollectionData(resolveCollection(state.get('exportCollection') || [], state.get('conversations') || [])));
}

// ------------------------------------------------------------- primitives

test('isSourceMessageId accepts real uuids and rejects generated/empty', () => {
  assert.equal(isSourceMessageId('abc-123'), true);
  assert.equal(isSourceMessageId('msg_0'), false);
  assert.equal(isSourceMessageId('msg_12'), false);
  assert.equal(isSourceMessageId(''), false);
  assert.equal(isSourceMessageId(null), false);
});

test('createEntry uses source uuid, preview prefix length and exact timestamp', () => {
  const c = C1();
  const e = entryFor(c, c.messages[1], 1);
  assert.equal(e.key, 'conv-1::m-1b');
  assert.equal(e.msgUuid, 'm-1b');
  assert.equal(e.preview, capturePreview(c.messages[1]));
  assert.ok(e.preview.length <= 80);
  assert.equal(e.timestamp, '2024-01-01T00:01:00Z');
});

test('createEntry falls back to a conversation-key identity for generated message ids', () => {
  const c = conv('c-gen', 'Gen', [{ sender: 'human', text: 'no uuid' }]);
  const e = entryFor(c, c.messages[0], 0);
  assert.equal(isSourceMessageId(c.messages[0].uuid), false);
  assert.equal(e.msgUuid, null);
  assert.match(e.key, /#fallback:/);
  assert.equal(e.key, entryFor(c, c.messages[0], 2).key, 'fallback identity is independent of position');
});

// ------------------------------------- authoritative resolution only binds reliably

test('legacy index entry with mismatched preview stays unavailable (in-range index)', () => {
  const c = C1();
  // index 1 is m-1b, but the stored preview belongs to nothing here.
  const legacy = { key: 'conv-1:1', convUuid: 'conv-1', msgIndex: 1, sender: 'assistant', preview: 'totally different', timestamp: '2024-01-01T00:01:00Z' };
  const r = resolveCollection([legacy], [c]);
  assert.equal(r.byKey.get('conv-1:1').msg, null, 'mismatched preview -> unavailable');
  assert.equal(r.availableCount, 0);
  assert.equal(r.unavailableCount, 1);
});

test('legacy index entry with no usable evidence stays unavailable (in-range index)', () => {
  const c = C1();
  const legacy = { key: 'conv-1:0', convUuid: 'conv-1', msgIndex: 0 };
  const r = resolveCollection([legacy], [c]);
  assert.equal(r.byKey.get('conv-1:0').msg, null);
});

test('ambiguous legacy entry (duplicate preview+time) stays unavailable', () => {
  const c = conv('conv-dup', 'Dup', [
    { uuid: 'd1', sender: 'human', createdAt: '2024-02-01T00:00:00Z', text: 'same text' },
    { uuid: 'd2', sender: 'human', createdAt: '2024-02-01T00:00:00Z', text: 'same text' },
  ]);
  const legacy = { key: 'conv-dup:0', convUuid: 'conv-dup', msgIndex: 0, sender: 'human', preview: 'same text', timestamp: '2024-02-01T00:00:00Z' };
  const r = resolveCollection([legacy], [c]);
  assert.equal(r.byKey.get('conv-dup:0').msg, null, 'ambiguous -> unavailable');
});

test('legacy entry binds only on an exact preview-prefix + exact timestamp match', () => {
  const c = C1();
  const good = { key: 'conv-1:1', convUuid: 'conv-1', msgIndex: 1, sender: 'assistant', preview: 'alpha reply', timestamp: '2024-01-01T00:01:00Z' };
  const r = resolveCollection([good], [c]);
  const res = r.byKey.get('conv-1:1');
  assert.ok(res.msg);
  assert.equal(res.msg.uuid, 'm-1b');

  // Same preview but the timestamp changed by 2s -> must not bind.
  const badTime = { ...good, timestamp: '2024-01-01T00:01:02Z' };
  assert.equal(resolveCollection([badTime], [c]).byKey.get('conv-1:1').msg, null);
});

test('preview match is an exact captured prefix, not a substring of message text', () => {
  // A message whose text CONTAINS the short stored preview but is not the
  // captured prefix must not bind.
  const c = conv('conv-sub', 'Sub', [
    { uuid: 's1', sender: 'human', createdAt: '2024-03-01T00:00:00Z', text: 'ZZZ alpha reply appended here' },
  ]);
  const legacy = { key: 'conv-sub:0', convUuid: 'conv-sub', msgIndex: 0, sender: 'human', preview: 'alpha reply', timestamp: '2024-03-01T00:00:00Z' };
  assert.equal(resolveCollection([legacy], [c]).byKey.get('conv-sub:0').msg, null, 'substring is not enough');
});

test('removed original + another message containing its short text stays unavailable', () => {
  const c = conv('conv-x', 'X', [
    { uuid: 'n1', sender: 'human', createdAt: '2024-04-01T00:00:00Z', text: 'quote: hello world' },
  ]);
  const legacy = { key: 'conv-x:0', convUuid: 'conv-x', msgIndex: 0, sender: 'human', preview: 'hello world', timestamp: '2024-04-01T00:00:00Z' };
  assert.equal(resolveCollection([legacy], [c]).byKey.get('conv-x:0').msg, null);
});

// --------------------------------------------------------- reorder / insert

test('source-uuid identity follows a message that actually changes position', () => {
  const original = C1();
  const kept = entryFor(original, original.messages[2], 2); // m-1c at index 2
  assert.equal(kept.key, 'conv-1::m-1c');
  assert.equal(kept.msgIndex, 2);

  // Reimport: m-1c moves to index 0, an older message inserted before m-1a.
  const reimported = conv('conv-1', 'First', [
    { uuid: 'm-1c', sender: 'human', createdAt: '2024-01-01T00:02:00Z', text: 'beta question' },
    { uuid: 'm-new', sender: 'human', createdAt: '2023-12-01T00:00:00Z', text: 'inserted older' },
    { uuid: 'm-1a', sender: 'human', createdAt: '2024-01-01T00:00:00Z', text: 'alpha one' },
    { uuid: 'm-1b', sender: 'assistant', createdAt: '2024-01-01T00:01:00Z', text: 'alpha reply' },
  ]);

  const r = resolveCollection([kept], [reimported]);
  const res = r.byKey.get(kept.key);
  assert.ok(res.msg);
  assert.equal(res.msg.uuid, 'm-1c');
  assert.equal(res.index, 0, 'bound at its new position, not stored index 2');
});

test('generated-id entry reorder: binds by evidence, not by stored index', () => {
  const original = conv('c-gen', 'Gen', [
    { sender: 'human', createdAt: '2024-05-01T00:00:00Z', text: 'first message' },
    { sender: 'assistant', createdAt: '2024-05-01T00:01:00Z', text: 'second reply' },
  ]);
  const kept = entryFor(original, original.messages[1], 1); // "second reply"

  // Reimport reordered: the assistant reply is now at index 0.
  const reimported = conv('c-gen', 'Gen', [
    { sender: 'assistant', createdAt: '2024-05-01T00:01:00Z', text: 'second reply' },
    { sender: 'human', createdAt: '2024-05-01T00:00:00Z', text: 'first message' },
  ]);
  const r = resolveCollection([kept], [reimported]);
  const res = r.byKey.get(kept.key);
  assert.ok(res.msg, 'generated-id entry must still resolve by evidence');
  assert.equal(res.index, 0, 'resolved to the moved message');
  assert.ok(res.msg.searchText.includes('second reply'));
});

test('generated-id entry whose original is gone does NOT bind to the old index', () => {
  const original = conv('c-gen2', 'Gen2', [
    { sender: 'human', createdAt: '2024-06-01T00:00:00Z', text: 'original text' },
    { sender: 'assistant', createdAt: '2024-06-01T00:01:00Z', text: 'original reply' },
  ]);
  const kept = entryFor(original, original.messages[0], 0); // "original text" at index 0

  // Reimport: original removed; a DIFFERENT message now sits at index 0.
  const reimported = conv('c-gen2', 'Gen2', [
    { sender: 'human', createdAt: '2024-07-01T00:00:00Z', text: 'replacement text' },
    { sender: 'assistant', createdAt: '2024-06-01T00:01:00Z', text: 'original reply' },
  ]);
  const r = resolveCollection([kept], [reimported]);
  assert.equal(r.byKey.get(kept.key).msg, null, 'must not bind to the different message at the old index');
});

// ------------------------------------------------- absent / reappearing source

test('source absent then reappearing: availability tracks the loaded conversations', () => {
  const c = C1();
  const kept = entryFor(c, c.messages[1], 1);

  const missing = resolveCollection([kept], []);
  assert.equal(missing.byKey.get(kept.key).msg, null, 'unavailable while source absent');
  assert.equal(missing.entries.length, 1, 'entry retained');

  const restored = resolveCollection([kept], [c]);
  assert.ok(restored.byKey.get(kept.key).msg, 'available once source reappears');
});

// --------------------------------------------------------- uuid-less convs

test('two distinct uuid-less conversations stay distinct and collectable', () => {
  const a = conv('', 'Alpha conv', [{ sender: 'human', createdAt: '2024-08-01T00:00:00Z', text: 'alpha body' }]);
  const b = conv('', 'Beta conv', [{ sender: 'human', createdAt: '2024-08-02T00:00:00Z', text: 'beta body' }]);
  assert.equal(a.uuid, '');
  assert.equal(b.uuid, '');
  assert.notEqual(conversationKey(a), conversationKey(b), 'uuid-less convs must not collapse');

  const ea = entryFor(a, a.messages[0], 0);
  const eb = entryFor(b, b.messages[0], 0);
  assert.ok(ea && eb, 'collection must work for supported uuid-less conversations');

  const r = resolveCollection([ea, eb], [a, b]);
  assert.equal(r.availableCount, 2);
  assert.equal(r.byKey.get(ea.key).msg.searchText.includes('alpha body'), true);
  assert.equal(r.byKey.get(eb.key).msg.searchText.includes('beta body'), true);

  // With only one of the two loaded, the other resolves conservatively.
  const onlyA = resolveCollection([ea, eb], [a]);
  assert.ok(onlyA.byKey.get(ea.key).msg);
  assert.equal(onlyA.byKey.get(eb.key).msg, null);
});

// ------------------------------------------------------- ExportPanel consumers

function makePanel(entries, conversations, format = 'md') {
  state.set('conversations', conversations);
  state.set('exportCollection', entries);
  state.set('displayNames', { human: 'H', assistant: 'A' });
  const panel = new ExportPanel();
  panel.format = format;
  return panel;
}

test('ExportPanel renders unavailable status for ambiguous/legacy/nonmatching entries', () => {
  const c = C1();
  const legacyAmbig = { key: 'conv-1:1', convUuid: 'conv-1', msgIndex: 1, sender: 'assistant', preview: 'nope', timestamp: '2024-01-01T00:01:00Z' };
  const noEvidence = { key: 'conv-1:0', convUuid: 'conv-1', msgIndex: 0 };
  const panel = makePanel([legacyAmbig, noEvidence], [c]);

  const resolution = resolveCollection(state.get('exportCollection'), [c]);
  assert.equal(resolution.availableCount, 0);
  assert.equal(resolution.unavailableCount, 2);

  const section = globalThis.document.createElement('div');
  panel._renderCollectionSection(section);
  const text = section.textContent;
  assert.ok(text.includes('来源暂不可用'), 'unavailable status rendered');
  assert.ok(text.includes('0 条可导出'), 'availability summary rendered');
});

test('ExportPanel export builders exclude unreliably-resolved entries', () => {
  const c = C1();
  const good = entryFor(c, c.messages[0], 0);
  const bad = { key: 'conv-1:1', convUuid: 'conv-1', msgIndex: 1, sender: 'assistant', preview: 'nope', timestamp: '2024-01-01T00:01:00Z' };
  const panel = makePanel([good, bad], [c]);

  const resolution = resolveCollection(state.get('exportCollection'), [c]);
  const md = exportAsMarkdown(panel._buildCollectionAsConversations(resolution), { displayNames: { human: 'H', assistant: 'A' } });
  const json = panel._buildCollectionData(resolution);
  assert.equal(json.length, 1);
  assert.equal(json[0].messages.length, 1, 'only the reliably-resolved message is exported');
  assert.ok(json[0].messages[0].searchText.includes('alpha one'));
  assert.equal(md.includes('nope'), false, 'unavailable entry never appears in output');
});

test('all four export builders use the resolved messages in current source order', () => {
  const c = conv('conv-1', 'First', [
    { uuid: 'm-1c', sender: 'human', createdAt: '2024-01-01T00:02:00Z', text: 'beta question' },
    { uuid: 'm-1b', sender: 'assistant', createdAt: '2024-01-01T00:01:00Z', text: 'alpha reply' },
  ]);
  const origOrder = C1();
  const b = entryFor(origOrder, origOrder.messages[1], 1);
  const cc = entryFor(origOrder, origOrder.messages[2], 2);
  const panel = makePanel([b, cc], [c]);

  const resolution = resolveCollection(state.get('exportCollection'), [c]);
  const opts = { includeThinking: true, includeToolUse: true, includeFlags: true, displayNames: { human: 'H', assistant: 'A' } };
  const md = exportAsMarkdown(panel._buildCollectionAsConversations(resolution), opts);
  const txt = exportAsText(panel._buildCollectionAsConversations(resolution), opts);
  const html = exportAsHTML(panel._buildCollectionAsConversations(resolution), opts);
  const json = panel._buildCollectionData(resolution);

  assert.ok(md.indexOf('beta question') < md.indexOf('alpha reply'), 'markdown source order');
  assert.ok(txt.indexOf('beta question') < txt.indexOf('alpha reply'), 'text source order');
  assert.ok(html.indexOf('beta question') < html.indexOf('alpha reply'), 'html source order');
  assert.deepEqual(json[0].messages.map(m => m.uuid), ['m-1c', 'm-1b']);
});

test('all-unavailable collection does not download (guard actually exercised)', () => {
  const c = C1();
  const bad = { key: 'conv-1:1', convUuid: 'conv-1', msgIndex: 1, sender: 'assistant', preview: 'nope', timestamp: '2024-01-01T00:01:00Z' };
  const panel = makePanel([bad], [c]);

  const downloads = [];
  const originalCreate = globalThis.document.createElement;
  globalThis.document.createElement = (t) => {
    const el = originalCreate(t);
    if (String(t).toLowerCase() === 'a') {
      const baseClick = el.click.bind(el);
      el.click = () => { downloads.push(el.download); baseClick(); };
    }
    return el;
  };
  try {
    panel._exportCollection();
  } finally {
    globalThis.document.createElement = originalCreate;
  }
  assert.equal(downloads.length, 0, 'no download for an all-unavailable collection');

  // Sanity: with an available entry, a download DOES happen.
  const good = entryFor(c, c.messages[0], 0);
  const panel2 = makePanel([good], [c]);
  const downloads2 = [];
  globalThis.document.createElement = (t) => {
    const el = originalCreate(t);
    if (String(t).toLowerCase() === 'a') {
      const baseClick = el.click.bind(el);
      el.click = () => { downloads2.push(el.download); baseClick(); };
    }
    return el;
  };
  try {
    panel2._exportCollection();
  } finally {
    globalThis.document.createElement = originalCreate;
  }
  assert.equal(downloads2.length, 1, 'available collection downloads once');
});

// ------------------------------------------------------- MessageView consumers

/** Mount a MessageView on a conversation and return { view, conv }. */
function mountMessageView(c) {
  state.set('conversations', [c]);
  state.set('filteredConversations', [c]);
  state.set('currentConversationIndex', 0);
  state.set('viewMode', 'conversation');
  const container = globalThis.document.createElement('div');
  const view = new MessageView(container);
  // The constructor renders the empty/stats state; render the selected
  // conversation explicitly (this is what a conversations/index notification
  // does in the running app).
  view.renderConversation();
  return { view, container };
}

function findButtons(root) {
  const out = [];
  (function walk(node) {
    if (node.tagName === 'BUTTON') out.push(node);
    for (const c of node.children || []) walk(c);
  })(root);
  return out;
}

test('MessageView +Collect (single path) stores canonical identity and is idempotent', () => {
  const c = C1();
  state.set('exportCollection', []);
  const { view } = mountMessageView(c);

  // Single-message add path (the "+精选" action button).
  view._addToCollection(c, 2, c.messages[2]);
  let coll = state.get('exportCollection');
  assert.equal(coll.length, 1);
  assert.equal(coll[0].key, 'conv-1::m-1c');

  // Repeat -> no duplicate.
  view._addToCollection(c, 2, c.messages[2]);
  assert.equal(state.get('exportCollection').length, 1);

  // Add-all path -> adds the two remaining messages only.
  view._addMessagesToCollection(c, c.messages.map((_, i) => i));
  coll = state.get('exportCollection');
  assert.equal(coll.length, 3, 'add-all does not duplicate the already-collected message');
  assert.deepEqual(coll.map(e => e.key).sort(), ['conv-1::m-1a', 'conv-1::m-1b', 'conv-1::m-1c']);

  // Selection toolbar path -> idempotent again.
  view.selectedIndices = new Set([0, 1, 2]);
  view._addMessagesToCollection(c, [...view.selectedIndices]);
  assert.equal(state.get('exportCollection').length, 3, 'toolbar add is idempotent');
});

test('MessageView collected-button state uses the shared resolver', () => {
  const c = C1();
  state.set('exportCollection', [entryFor(c, c.messages[1], 1)]);
  const { container } = mountMessageView(c);
  const text = container.textContent;
  // Exactly one message shows the collected label; the others show "+精选".
  assert.ok(text.includes('已精选'));
  assert.equal((text.match(/已精选/g) || []).length, 1);
});

test('a legacy evidence-resolved entry shows as collected (key-independent)', () => {
  const c = C1();
  // Legacy key `conv-1:1` with evidence matching m-1b (index 1).
  state.set('exportCollection', [
    { key: 'conv-1:1', convUuid: 'conv-1', msgIndex: 1, sender: 'assistant', preview: 'alpha reply', timestamp: '2024-01-01T00:01:00Z' },
  ]);
  const { container } = mountMessageView(c);
  const text = container.textContent;
  assert.equal((text.match(/已精选/g) || []).length, 1, 'legacy-resolved message shows as collected');
});

test('MessageView add path works for a uuid-less conversation (no silent failure)', () => {
  const c = conv('', 'Uuidless', [{ sender: 'human', createdAt: '2024-09-01T00:00:00Z', text: 'hello there' }]);
  state.set('exportCollection', []);
  const { view } = mountMessageView(c);
  view._addToCollection(c, 0, c.messages[0]);
  const coll = state.get('exportCollection');
  assert.equal(coll.length, 1, 'uuid-less conversation must be collectable');
  assert.equal(coll[0].convUuid, '');
});

test('MessageView reports a notice instead of silently failing for an unidentifiable conversation', () => {
  // No uuid, name, timestamps or text anywhere -> no conversation discriminator.
  const c = parseConversation({ chat_messages: [{ sender: 'human', content: [{ type: 'token_budget' }] }] });
  assert.equal(conversationKey(c), null, 'precondition: no usable discriminator');
  state.set('exportCollection', []);
  const { view, container } = mountMessageView(c);
  const added = view._addMessagesToCollection(c, [0]);
  assert.equal(added, 0, 'nothing added');
  assert.ok(container.textContent.includes('无法识别'), 'a visible notice is shown');
});

// ------------------------------------------------------- persistence / reconcile

test('reconcileCollection persists normalization with a single call (no manual save)', () => {
  storageMap.clear();
  // A legacy persisted entry with an in-range index but no evidence.
  state.set('exportCollection', [
    { key: 'conv-1:0', convUuid: 'conv-1', msgIndex: 0 },
  ]);
  const result = reconcileCollection(state.get('exportCollection'));
  assert.equal(result.length, 1);

  // The single reconcile call must have persisted the canonical collection.
  const persisted = JSON.parse(storageMap.get('cv-export-collection'));
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].key, 'conv-1:0');
});

test('reconcileCollection keeps entries whose source is not loaded', () => {
  storageMap.clear();
  state.set('exportCollection', [
    { key: 'conv-missing::x', identity: 'conv-missing::x', convUuid: 'conv-missing', msgUuid: 'x', msgIndex: 0, sender: 'human', preview: 'gone', timestamp: null },
  ]);
  const result = reconcileCollection(state.get('exportCollection'));
  assert.equal(result.length, 1, 'absent-source entry retained across reconcile');
  const persisted = JSON.parse(storageMap.get('cv-export-collection'));
  assert.equal(persisted.length, 1);
});

test('explicit remove and clear persist', () => {
  const c = C1();
  state.set('conversations', [c]);
  const a = entryFor(c, c.messages[0], 0);
  const b = entryFor(c, c.messages[1], 1);
  state.set('exportCollection', [a, b]);
  saveExportCollection();

  const panel = new ExportPanel();
  panel._removeCollectionItems([a.key]);
  assert.equal(state.get('exportCollection').length, 1);
  assert.equal(JSON.parse(storageMap.get('cv-export-collection')).length, 1);

  state.set('exportCollection', []);
  saveExportCollection();
  assert.equal(JSON.parse(storageMap.get('cv-export-collection')).length, 0);
});

test('reconcile promotes a uniquely resolved legacy source UUID and persists it immediately', () => {
  const c = C1();
  state.set('conversations', [c]);
  const legacy = { key: 'conv-1:1', convUuid: 'conv-1', msgIndex: 1, sender: 'assistant', preview: 'alpha reply', timestamp: '2024-01-01T00:01:00Z' };
  reconcileCollection([legacy]);
  const saved = JSON.parse(storageMap.get('cv-export-collection'));
  assert.equal(saved[0].msgUuid, 'm-1b');
  assert.equal(saved[0].key, 'conv-1::m-1b');
  const updated = C1();
  updated.messages[1].searchText = 'updated text for the same source message';
  assert.equal(resolveCollection(saved, [updated]).availableCount, 1, 'later imports use the saved UUID');
});

test('inserting a generated-ID message does not block collecting the new message at the old position', () => {
  const original = conv('generated', 'Generated', [{ sender: 'human', text: 'original' }]);
  state.set('exportCollection', [entryFor(original, original.messages[0], 0)]);
  const next = conv('generated', 'Generated', [{ sender: 'human', text: 'inserted' }, { sender: 'human', text: 'original' }]);
  const { view } = mountMessageView(next);
  view._addToCollection(next, 0, next.messages[0]);
  assert.equal(state.get('exportCollection').length, 2);
  const resolved = resolveCollection(state.get('exportCollection'), [next]);
  assert.equal(resolved.availableCount, 2);
  view.destroy();
});

test('UUID-less conversations with identical titles and dates keep distinct resolved targets and exports', () => {
  const a = conv('', 'Same title', [{ uuid: 'anonymous-a', sender: 'human', text: 'first source' }]);
  const b = conv('', 'Same title', [{ uuid: 'anonymous-b', sender: 'human', text: 'second source' }]);
  const entries = [entryFor(a, a.messages[0], 0), entryFor(b, b.messages[0], 0)];
  const resolved = resolveCollection(entries, [a, b]);
  assert.equal(resolved.availableCount, 2);
  const exported = collectionConversations(resolved, [a, b]);
  assert.deepEqual(exported.map(c => c.messages.map(m => m.uuid)), [['anonymous-a'], ['anonymous-b']]);
  state.set('exportCollection', [entries[0]]);
  const { view } = mountMessageView(b);
  state.set('conversations', [a, b]);
  view._addToCollection(b, 0, b.messages[0]);
  assert.equal(state.get('exportCollection').length, 2);
  view.destroy();
});

test('a captured 80-character preview ending in a space still matches exactly', () => {
  const c = conv('preview-space', 'Space', [{ sender: 'human', text: 'a'.repeat(79) + ' remaining text' }]);
  const entry = entryFor(c, c.messages[0], 0);
  assert.equal(entry.preview.length, 80);
  assert.equal(resolveCollection([entry], [c]).availableCount, 1);
});

test('a UUID-less missing source cannot bind to another conversation with the same greeting', () => {
  const a = conv('', 'Source A', [{ sender: 'human', text: 'hello' }]);
  const b = conv('', 'Source B', [{ sender: 'human', text: 'hello' }]);
  const entry = entryFor(a, a.messages[0], 0);
  assert.equal(resolveCollection([entry], [b]).availableCount, 0);
  assert.equal(resolveCollection([entry], [a, b]).byKey.get(entry.key).conv, a);
});
