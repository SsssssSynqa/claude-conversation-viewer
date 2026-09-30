/**
 * Boundary tests for the UI <-> parser-worker contract.
 * Runs the REAL worker script (via test/worker-harness.mjs) with real JSZip
 * File-like inputs. No personal data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { runWorker } from './worker-harness.mjs';
import { conv, jsonFile, zipFile, fileLike, manifest } from './fixtures.mjs';

test('worker posts a manifest guide (not an array error) for manifest JSON', async () => {
  const messages = await runWorker({ files: [jsonFile('manifest.json', manifest())] });
  const manifestMsg = messages.find(m => m.type === 'manifest');
  assert.ok(manifestMsg, 'a manifest message must be posted');
  assert.equal(manifestMsg.manifest.totalPartCount, 2);
  assert.equal(manifestMsg.manifest.conversationFiles[0].filename, 'conversations-000.zip');
  assert.equal(messages.some(m => m.type === 'error'), false);
  assert.equal(messages.some(m => m.type === 'done'), false);
});

test('worker imports a legacy conversations array', async () => {
  const messages = await runWorker({ files: [jsonFile('conversations.json', [conv('u1', '2024-01-01T00:00:00Z', 'hi')])] });
  const done = messages.find(m => m.type === 'done');
  assert.ok(done);
  assert.equal(done.conversations.length, 1);
  assert.equal(done.conversations[0].uuid, 'u1');
});

test('worker imports real ZIP parts and reports dedup count', async () => {
  const part0 = await zipFile('conversations-000.zip', {
    'conversations-000.json': JSON.stringify([conv('u1', '2024-01-01T00:00:00Z', 'a')]),
  });
  const part1 = await zipFile('conversations-001.zip', {
    'conversations-001.json': JSON.stringify([conv('u1', '2024-06-01T00:00:00Z', 'dup'), conv('u2', '2024-02-01T00:00:00Z', 'b')]),
  });
  const messages = await runWorker({ files: [part0, part1] });
  const done = messages.find(m => m.type === 'done');
  assert.ok(done);
  assert.equal(done.conversations.length, 2);
  assert.equal(done.duplicates, 1);
  assert.equal(done.fileMeta.length, 2);
});

test('worker emits an error code for an unsupported shape', async () => {
  const messages = await runWorker({ files: [jsonFile('weird.json', { not: 'a manifest' })] });
  const err = messages.find(m => m.type === 'error');
  assert.ok(err);
  assert.equal(err.code, 'unsupported_shape');
});

test('worker emits a stable error code for an unsupported extension', async () => {
  const messages = await runWorker({ files: [fileLike('notes.txt', 'hello')] });
  const err = messages.find(m => m.type === 'error');
  assert.ok(err);
  assert.equal(err.code, 'unsupported_selected_file');
});

test('worker emits an error code for a corrupt ZIP', async () => {
  const messages = await runWorker({ files: [fileLike('conversations-000.zip', new TextEncoder().encode('nope'))] });
  const err = messages.find(m => m.type === 'error');
  assert.ok(err);
  assert.ok(['zip_read_failed', 'unsupported_selected_zip'].includes(err.code));
});

test('worker message contract: only { files } is used, no network fields', async () => {
  // A url/fetch field is irrelevant to the worker contract; it must be ignored,
  // not acted upon. The only accepted input is a local File list.
  const messages = await runWorker({ files: [], url: 'https://claude.ai/should-be-ignored' });
  // Empty file list -> done with zero conversations (no network, no error).
  const done = messages.find(m => m.type === 'done');
  assert.ok(done);
  assert.equal(done.conversations.length, 0);
});

test('worker reports no_conversations for a memory-only selection', async () => {
  const memories = await zipFile('memories-000.zip', {
    'opaque-member.json': JSON.stringify({ unrelated: true }),
  });
  const messages = await runWorker({ files: [memories] });
  const msg = messages.find(m => m.type === 'no_conversations');
  assert.ok(msg, 'no_conversations message expected');
  assert.equal(messages.some(m => m.type === 'done'), false);
  assert.equal(messages.some(m => m.type === 'error'), false);
});

test('worker imports conversations ZIP beside an ignored memories ZIP', async () => {
  const convs = await zipFile('conversations-000.zip', {
    'conversations-000.json': JSON.stringify([conv('u1', '2024-01-01T00:00:00Z', 'a')]),
  });
  const memories = await zipFile('memories-000.zip', {
    'opaque-member.json': JSON.stringify({ unrelated: true }),
  });
  const messages = await runWorker({ files: [convs, memories] });
  const done = messages.find(m => m.type === 'done');
  assert.ok(done);
  assert.equal(done.conversations.length, 1);
  assert.equal(done.ignoredUnrelated, true);
});
