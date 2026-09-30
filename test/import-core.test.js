/**
 * Regression tests for the shared import core (src/parser/import-core.js).
 * Uses REAL JSZip archives and File-like objects. No personal data.
 * Run with: npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectManifest,
  extractConversationsFromJson,
  isConversationJsonPath,
  selectConversationJsonEntries,
  mergeRawConversations,
  sortConversationsByDate,
  importConversationSources,
  importSelectedFiles,
  MANIFEST_VERSION,
} from '../src/parser/import-core.js';
import { parseConversation } from '../src/parser/claude.js';
import { conv, emptyChatConv, jsonFile, zipFile, corruptZipFile, fileLike, manifest } from './fixtures.mjs';

// ---- manifest recognition ----

test('detectManifest recognizes a valid manifest and filters conversations', () => {
  const info = detectManifest(manifest());
  assert.ok(info);
  assert.equal(info.version, MANIFEST_VERSION);
  assert.equal(info.totalFiles, 6);
  assert.equal(info.totalPartCount, 2);
  assert.deepEqual(info.conversationFiles.map(f => f.filename), ['conversations-000.zip', 'conversations-001.zip']);
  assert.equal(info.categoryCounts.conversations, 2);
  assert.equal(info.categoryCounts.light_metadata, 1);
});

test('detectManifest rejects old-array behavior and malformed manifests', () => {
  assert.equal(detectManifest([conv('a', '2024-01-01T00:00:00Z', 'hi')]), null);
  assert.equal(detectManifest(null), null);
  assert.equal(detectManifest({ version: '2.0', data_files: [] }), null);
  assert.equal(detectManifest({ version: '1.0' }), null);
  assert.equal(detectManifest({ version: '1.0', data_files: [{ category: 'conversations' }] }), null);
});

test('manifest instructions are never surfaced', () => {
  const info = detectManifest(manifest({ instructions: '{"chat_messages":[]}' }));
  assert.equal(Object.prototype.hasOwnProperty.call(info, 'instructions'), false);
});

// ---- shape extraction ----

test('extractConversationsFromJson accepts arrays, single objects, and empty', () => {
  assert.equal(extractConversationsFromJson([{ uuid: 'x' }]).length, 1);
  assert.equal(extractConversationsFromJson([]).length, 0);
  assert.equal(extractConversationsFromJson({ uuid: 'y', chat_messages: [] }).length, 1);
  assert.equal(extractConversationsFromJson(emptyChatConv('z')).length, 1);
});

test('extractConversationsFromJson rejects unsupported shapes', () => {
  assert.throws(() => extractConversationsFromJson({ hello: 'world' }), /unsupported_json_shape/);
  assert.throws(() => extractConversationsFromJson('str'), /unsupported_json_shape/);
  assert.throws(() => extractConversationsFromJson(42), /unsupported_json_shape/);
});

// ---- archive path discovery ----

test('isConversationJsonPath honors the bounded naming contract', () => {
  for (const ok of ['conversations.json', 'conversations-000.json', 'conversations_12.json', 'Conversations-3.JSON', 'a/b/conversations-001.json']) {
    assert.equal(isConversationJsonPath(ok), true, ok);
  }
  for (const bad of ['light_metadata-000.json', 'projects.json', 'conversations.zip', 'conversations.json.bak', '__MACOSX/conversations-000.json', '._conversations.json', '.DS_Store']) {
    assert.equal(isConversationJsonPath(bad), false, bad);
  }
});

test('selectConversationJsonEntries filters noise and sorts by part', () => {
  const entries = [
    { name: 'exports/conversations-002.json', dir: false },
    { name: 'exports/', dir: true },
    { name: 'exports/light_metadata-000.json', dir: false },
    { name: '__MACOSX/._conversations-000.json', dir: false },
    { name: 'exports/conversations-000.json', dir: false },
    { name: 'exports/conversations-001.json', dir: false },
  ];
  assert.deepEqual(selectConversationJsonEntries(entries).map(e => e.path), [
    'exports/conversations-000.json',
    'exports/conversations-001.json',
    'exports/conversations-002.json',
  ]);
});

// ---- merge/dedup/sort ----

test('mergeRawConversations dedupes by UUID, first occurrence wins, counts dupes', () => {
  const a = [conv('u1', '2024-01-01T00:00:00Z', 'first'), conv('u2', '2024-02-01T00:00:00Z', 'two')];
  const b = [conv('u1', '2024-03-01T00:00:00Z', 'duplicate'), conv('u3', '2024-04-01T00:00:00Z', 'three')];
  const merged = mergeRawConversations([a, b]);
  assert.deepEqual(merged.conversations.map(c => c.uuid), ['u1', 'u2', 'u3']);
  assert.equal(merged.duplicates, 1);
  assert.equal(merged.conversations[0].chat_messages[0].content[0].text, 'first');
});

test('mergeRawConversations keeps rows without uuid and rejects non-object rows', () => {
  assert.equal(mergeRawConversations([[{ chat_messages: [] }, { chat_messages: [] }]]).conversations.length, 2);
  assert.throws(() => mergeRawConversations([['not-an-object']]), /conversation_row_not_object/);
});

test('sortConversationsByDate sorts newest first', () => {
  const sorted = sortConversationsByDate([
    { createdAt: '2024-01-01T00:00:00Z' },
    { createdAt: '2024-03-01T00:00:00Z' },
    { createdAt: '2024-02-01T00:00:00Z' },
  ]);
  assert.deepEqual(sorted.map(c => c.createdAt), [
    '2024-03-01T00:00:00Z', '2024-02-01T00:00:00Z', '2024-01-01T00:00:00Z',
  ]);
});

// ---- transactional import ----

test('importConversationSources merges all parts and counts duplicates once', () => {
  const result = importConversationSources([
    { label: 'conversations-000.json', value: [conv('u1', '2024-01-01T00:00:00Z', 'a')] },
    { label: 'conversations-001.json', value: [conv('u2', '2024-02-01T00:00:00Z', 'b'), conv('u1', '2024-05-01T00:00:00Z', 'dup')] },
  ], { parseConversation });
  assert.equal(result.conversations.length, 2);
  assert.equal(result.duplicates, 1);
  assert.equal(result.conversations[0].uuid, 'u2'); // newest first
});

test('importConversationSources is all-or-nothing on a corrupt source', () => {
  assert.throws(() => importConversationSources([
    { label: 'ok.json', value: [conv('u1', '2024-01-01T00:00:00Z', 'ok')] },
    { label: 'bad.json', value: { nope: true } },
  ], {
    parseConversation,
    onProgress: () => { throw new Error('progress must not run when a source is invalid'); },
  }), /unsupported_json_shape/);
});

test('importConversationSources tolerates an empty valid conversation set', () => {
  const result = importConversationSources([{ label: 'x.json', value: [] }], { parseConversation });
  assert.equal(result.conversations.length, 0);
});

test('importConversationSources rejects a malformed row even beside a valid source', () => {
  assert.throws(() => importConversationSources([
    { label: 'good.json', value: [conv('u1', '2024-01-01T00:00:00Z', 'ok')] },
    { label: 'bad.json', value: [{ uuid: 'bad' }] }, // no chat_messages array
  ], {
    parseConversation,
    onProgress: () => { throw new Error('progress must not run when a row is malformed'); },
  }), /conversation_row_not_conversation/);
});

test('importConversationSources rejects a malformed row that duplicates a valid UUID', () => {
  assert.throws(() => importConversationSources([
    { label: 'good.json', value: [conv('dup', '2024-01-01T00:00:00Z', 'ok')] },
    { label: 'bad.json', value: [{ uuid: 'dup' }] },
  ], { parseConversation }), /conversation_row_not_conversation/);
});

test('importConversationSources accepts empty chat_messages arrays', () => {
  const result = importConversationSources([
    { label: 'x.json', value: [emptyChatConv('e1')] },
  ], { parseConversation });
  // Empty chat_messages parses to null and is dropped, but it is NOT an error.
  assert.equal(result.conversations.length, 0);
});

// ---- importSelectedFiles with real JSZip archives ----

test('importSelectedFiles parses a legacy JSON array', async () => {
  const res = await importSelectedFiles({
    files: [jsonFile('conversations.json', [conv('u1', '2024-01-01T00:00:00Z', 'hi')])],
    parseConversation,
  });
  assert.equal(res.type, 'done');
  assert.equal(res.conversations.length, 1);
  assert.equal(res.fileMeta[0].fileName, 'conversations.json');
});

test('importSelectedFiles recognizes a manifest as a guide only', async () => {
  const res = await importSelectedFiles({
    files: [jsonFile('manifest.json', manifest())],
    parseConversation,
  });
  assert.equal(res.type, 'manifest');
  assert.equal(res.manifest.totalPartCount, 2);
});

test('importSelectedFiles parses ZIP with nested conversation JSON + metadata', async () => {
  const zip = await zipFile('conversations-000.zip', {
    'data/nested/conversations-000.json': JSON.stringify([conv('u1', '2024-01-01T00:00:00Z', 'a')]),
    'light_metadata-000.json': JSON.stringify({ irrelevant: true }),
    '__MACOSX/._conversations-000.json': 'noise',
    '.DS_Store': 'noise',
  });
  const res = await importSelectedFiles({ files: [zip], parseConversation });
  assert.equal(res.type, 'done');
  assert.equal(res.conversations.length, 1);
  assert.equal(res.conversations[0].uuid, 'u1');
});

test('importSelectedFiles merges multiple conversation ZIP parts with UUID dedup', async () => {
  const part0 = await zipFile('conversations-000.zip', {
    'conversations-000.json': JSON.stringify([conv('u1', '2024-01-01T00:00:00Z', 'a')]),
  });
  const part1 = await zipFile('conversations-001.zip', {
    'conversations-001.json': JSON.stringify([
      conv('u2', '2024-02-01T00:00:00Z', 'b'),
      conv('u1', '2024-06-01T00:00:00Z', 'dup'),
    ]),
  });
  const res = await importSelectedFiles({ files: [part0, part1], parseConversation });
  assert.equal(res.conversations.length, 2);
  assert.equal(res.duplicates, 1);
  assert.equal(res.conversations[0].uuid, 'u2'); // newest first
});

test('importSelectedFiles fails a corrupt ZIP', async () => {
  await assert.rejects(
    importSelectedFiles({ files: [corruptZipFile('conversations-000.zip')], parseConversation }),
    (e) => e.code === 'zip_read_failed' || e.code === 'unsupported_selected_zip',
  );
});

test('importSelectedFiles fails a valid ZIP containing corrupt selected JSON member', async () => {
  const zip = await zipFile('conversations-000.zip', {
    'conversations-000.json': '{ this is not valid json',
  });
  await assert.rejects(
    importSelectedFiles({ files: [zip], parseConversation }),
    (e) => e.code === 'invalid_json',
  );
});

test('importSelectedFiles fails an unrecognized conversation package beside a good one', async () => {
  const good = await zipFile('conversations-000.zip', {
    'conversations-000.json': JSON.stringify([conv('u1', '2024-01-01T00:00:00Z', 'a')]),
  });
  const bad = await zipFile('conversations-001.zip', {
    'mystery_data.json': JSON.stringify({ unknown: true }),
  });
  await assert.rejects(
    importSelectedFiles({ files: [good, bad], parseConversation }),
    (e) => e.code === 'unsupported_selected_zip',
  );
});

test('importSelectedFiles fails a corrupt conversation-relevant ZIP beside a good one', async () => {
  const good = await zipFile('conversations-000.zip', {
    'conversations-000.json': JSON.stringify([conv('u1', '2024-01-01T00:00:00Z', 'a')]),
  });
  await assert.rejects(
    importSelectedFiles({ files: [good, corruptZipFile('conversations-001.zip')], parseConversation }),
    (e) => e.code === 'zip_read_failed' || e.code === 'unsupported_selected_zip',
  );
});

test('importSelectedFiles ignores a known unrelated category ZIP', async () => {
  const convs = await zipFile('conversations-000.zip', {
    'conversations-000.json': JSON.stringify([conv('u1', '2024-01-01T00:00:00Z', 'a')]),
  });
  const projects = await zipFile('projects-000.zip', {
    'projects-000.json': JSON.stringify({ projects: [] }),
  });
  const res = await importSelectedFiles({ files: [convs, projects], parseConversation });
  assert.equal(res.type, 'done');
  assert.equal(res.conversations.length, 1);
  assert.equal(res.ignoredUnrelated, true);
});

test('importSelectedFiles ignores a memories ZIP whose members use opaque basenames', async () => {
  const convs = await zipFile('conversations-000.zip', {
    'conversations-000.json': JSON.stringify([conv('u1', '2024-01-01T00:00:00Z', 'a')]),
  });
  // Real memories packages name their single JSON member by an opaque id, not
  // "<category>.json". The package filename category is what we trust.
  const memories = await zipFile('memories-000.zip', {
    'unrelated-memory-member.json': JSON.stringify({ unrelated: true }),
  });
  const res = await importSelectedFiles({ files: [convs, memories], parseConversation });
  assert.equal(res.type, 'done');
  assert.equal(res.conversations.length, 1);
  assert.equal(res.ignoredUnrelated, true);
});

test('importSelectedFiles reports no_conversations for a memory-only selection', async () => {
  const memories = await zipFile('memories-000.zip', {
    'opaque-member.json': JSON.stringify({ unrelated: true }),
  });
  const res = await importSelectedFiles({ files: [memories], parseConversation });
  assert.equal(res.type, 'no_conversations');
  assert.equal(res.ignoredUnrelated, true);
});

test('importSelectedFiles fails a conversations-category package that hides other-category members', async () => {
  const good = await zipFile('conversations-000.zip', {
    'conversations-000.json': JSON.stringify([conv('u1', '2024-01-01T00:00:00Z', 'a')]),
  });
  // Named as a conversations package, but only contains projects data.
  const sneaky = await zipFile('conversations-001.zip', {
    'projects-000.json': JSON.stringify({ projects: [] }),
  });
  await assert.rejects(
    importSelectedFiles({ files: [good, sneaky], parseConversation }),
    (e) => e.code === 'unsupported_selected_zip',
  );
});

test('importSelectedFiles accepts a full legacy export ZIP with nested conversations.json', async () => {
  const legacy = await zipFile('export-2026.zip', {
    'data/projects/one.json': JSON.stringify({ projects: [] }),
    'data/conversations.json': JSON.stringify([conv('u1', '2024-01-01T00:00:00Z', 'a')]),
  });
  const res = await importSelectedFiles({ files: [legacy], parseConversation });
  assert.equal(res.type, 'done');
  assert.equal(res.conversations.length, 1);
});

test('importSelectedFiles rejects unsupported extensions in a mixed batch', async () => {
  const good = await zipFile('conversations-000.zip', {
    'conversations-000.json': JSON.stringify([conv('u1', '2024-01-01T00:00:00Z', 'a')]),
  });
  await assert.rejects(
    importSelectedFiles({ files: [good, fileLike('notes.txt', 'hello')], parseConversation }),
    (e) => e.code === 'unsupported_selected_file',
  );
});

test('importSelectedFiles handles duplicate file names independently', async () => {
  const a = await zipFile('conversations-000.zip', {
    'conversations-000.json': JSON.stringify([conv('u1', '2024-01-01T00:00:00Z', 'a')]),
  });
  const b = await zipFile('conversations-000.zip', {
    'conversations-000.json': JSON.stringify([conv('u2', '2024-02-01T00:00:00Z', 'b')]),
  });
  const res = await importSelectedFiles({ files: [a, b], parseConversation });
  assert.equal(res.conversations.length, 2);
});

test('importSelectedFiles recognizes a manifest mixed with conversation ZIPs', async () => {
  const manifestFile = jsonFile('manifest.json', manifest());
  const zip = await zipFile('conversations-000.zip', {
    'conversations-000.json': JSON.stringify([conv('u1', '2024-01-01T00:00:00Z', 'a')]),
  });
  const res = await importSelectedFiles({ files: [manifestFile, zip], parseConversation });
  // Manifest is a guide, ignored; the conversation ZIP is imported.
  assert.equal(res.type, 'done');
  assert.equal(res.conversations.length, 1);
});

test('importSelectedFiles reports progress once per raw conversation', async () => {
  const seen = [];
  await importSelectedFiles({
    files: [jsonFile('conversations.json', [
      conv('u1', '2024-01-01T00:00:00Z', 'a'),
      conv('u2', '2024-01-02T00:00:00Z', 'b'),
    ])],
    parseConversation,
    onProgress: (c, t) => seen.push([c, t]),
  });
  assert.deepEqual(seen, [[1, 2], [2, 2]]);
});
