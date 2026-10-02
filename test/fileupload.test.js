/**
 * Component-level boundary tests for the FileUpload import lifecycle.
 *
 * Uses a minimal DOM (with a real container tree so the error banner is
 * observable after a screen rebuild) and the configurable mock worker provided
 * by the test loader. The real parser/import logic is covered by
 * import-core.test.js and worker.test.js.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// --- minimal DOM shims ---
class El {
  constructor(tag) {
    this.tagName = (tag || '').toUpperCase();
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.id = '';
    this.textContent = '';
    this.attributes = {};
    this.listeners = {};
    this._class = new Set();
    this._className = '';
  }
  set className(v) { this._className = v; }
  get className() { return this._className; }
  appendChild(c) { if (c && typeof c === 'object') c.parentNode = this; this.children.push(c); return c; }
  insertBefore(c) { return this.appendChild(c); }
  removeChild(c) { this.children = this.children.filter(x => x !== c); return c; }
  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  removeEventListener() {}
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  get classList() {
    const self = this;
    return {
      add: c => self._class.add(c),
      remove: c => self._class.delete(c),
      contains: c => self._class.has(c),
      toggle: () => {},
    };
  }
  querySelector(sel) {
    // Plain tag selectors (input, label, ...) resolve by tag name.
    if (/^[a-z]+$/.test(sel)) return this.children.find(c => c.tagName === sel.toUpperCase()) || new El(sel);
    return this.findByClass(sel);
  }
  findByClass(cls) {
    for (const c of this.children) {
      if (c instanceof El && String(c.className).split(/\s+/).includes(cls)) return c;
      if (c instanceof El) { const r = c.findByClass(cls); if (r) return r; }
    }
    return null;
  }
  findById(id) {
    for (const c of this.children) {
      if (c instanceof El && c.id === id) return c;
      if (c instanceof El) { const r = c.findById(id); if (r) return r; }
    }
    return null;
  }
}

let root = null;
globalThis.document = {
  createElement: (t) => new El(t),
  createTextNode: (t) => ({ textContent: t, nodeType: 3 }),
  getElementById: (id) => (root ? root.findById(id) : null),
  querySelector: () => null,
};
globalThis.window = { matchMedia: () => ({ matches: false }) };

const { state } = await import('../src/store/state.js');
const { FileUpload } = await import('../src/components/FileUpload.js');
const { __setMockWorker, __lastMockWorker, __resetMockWorker } = await import('./setup/mock-worker.mjs');

function makeWorker() {
  return {
    posted: null,
    terminated: false,
    onmessage: null,
    onerror: null,
    postMessage(m) { this.posted = m; },
    terminate() { this.terminated = true; },
    _emit(msg) { if (this.onmessage) this.onmessage(msg); },
  };
}

/** Build a FileUpload wired to a fresh DOM root; keep only showLoading stubbed. */
function makeUpload() {
  root = new El('div');
  const upload = new FileUpload(root);
  upload.showLoading = () => {};
  upload.updateProgress = () => {};
  return upload;
}

function bannerText(upload) {
  const banner = upload.container.findById('upload-error');
  return banner ? banner.textContent : null;
}

test('busy lock is held while a worker is active and rejects overlap', async () => {
  const upload = makeUpload();
  const worker = makeWorker();
  __setMockWorker(() => worker);

  await upload.handleFiles([{ name: 'a.json' }]);
  assert.equal(upload._importBusy, true, 'busy stays set while worker active');
  assert.equal(state.get('loading'), true);
  assert.deepEqual(worker.posted, { files: [{ name: 'a.json' }] }, 'posts { files } only');

  await upload.handleFiles([{ name: 'b.json' }]);
  assert.equal(worker.posted.files.length, 1, 'overlap ignored, no second worker');

  worker._emit({ data: { type: 'done', conversations: [{ uuid: 'u1' }], duplicates: 0, fileMeta: [] } });
  assert.equal(upload._importBusy, false, 'busy released on done');
  assert.equal(state.get('loading'), false);
  assert.equal(worker.terminated, true);
  __resetMockWorker();
});

test('loading is cleared BEFORE conversations are committed (main-view gate)', async () => {
  const upload = makeUpload();
  const worker = makeWorker();
  __setMockWorker(() => worker);

  // Mirror src/main.js:658 — the main view renders only when conversations
  // change while loading === false. Record that ordering.
  const seen = [];
  const offLoading = state.on('loading', () => {
    seen.push({ event: 'loading', value: state.get('loading') });
  });
  const offConvs = state.on('conversations', (convs) => {
    if (convs.length > 0) seen.push({ event: 'conversations', loading: state.get('loading') });
  });

  await upload.handleFiles([{ name: 'a.json' }]);
  worker._emit({ data: { type: 'done', conversations: [{ uuid: 'u1' }], duplicates: 0, fileMeta: [] } });

  offLoading();
  offConvs();
  const commit = seen.find(e => e.event === 'conversations' && e.loading !== undefined);
  assert.ok(commit, 'conversations commit observed');
  assert.equal(commit.loading, false, 'loading must be false when conversations are committed');
  __resetMockWorker();
});

test('an error restores the screen and the banner survives the DOM rebuild', async () => {
  const upload = makeUpload();
  const worker = makeWorker();
  __setMockWorker(() => worker);

  await upload.handleFiles([{ name: 'a.json' }]);
  worker._emit({ data: { type: 'error', code: 'unsupported_shape' } });

  assert.equal(upload._importBusy, false);
  assert.equal(state.get('loading'), false);
  // The banner must be present in the rebuilt screen (not erased).
  const text = bannerText(upload);
  assert.equal(typeof text, 'string');
  assert.ok(text.length > 0, 'error banner text must survive the screen rebuild');
  __resetMockWorker();
});

test('an empty result restores the screen and shows an error banner', async () => {
  const upload = makeUpload();
  const worker = makeWorker();
  __setMockWorker(() => worker);

  await upload.handleFiles([{ name: 'a.json' }]);
  worker._emit({ data: { type: 'done', conversations: [], duplicates: 0, fileMeta: [] } });
  assert.equal(upload._importBusy, false);
  assert.equal(state.get('loading'), false);
  assert.ok((bannerText(upload) || '').length > 0, 'empty result shows a banner');
  __resetMockWorker();
});

test('a manifest message releases the busy lock without touching conversations', async () => {
  const upload = makeUpload();
  const worker = makeWorker();
  __setMockWorker(() => worker);
  const before = state.get('conversations');

  await upload.handleFiles([{ name: 'manifest.json' }]);
  worker._emit({ data: { type: 'manifest', manifest: { totalPartCount: 2, conversationFiles: [] } } });
  assert.equal(upload._importBusy, false);
  assert.equal(state.get('loading'), false);
  assert.equal(upload.manifestData.totalPartCount, 2);
  assert.equal(state.get('conversations'), before, 'manifest must not touch conversation state');
  __resetMockWorker();
});

test('a worker-construction failure restores state and shows a banner', async () => {
  const upload = makeUpload();
  __setMockWorker(() => { throw new Error('construction failed'); });

  await upload.handleFiles([{ name: 'a.json' }]);
  assert.equal(upload._importBusy, false, 'busy released after construction failure');
  assert.equal(state.get('loading'), false);
  assert.ok((bannerText(upload) || '').length > 0, 'construction failure shows a banner');
  __resetMockWorker();
});

test('a postMessage failure restores state and shows a banner', async () => {
  const upload = makeUpload();
  const worker = makeWorker();
  worker.postMessage = () => { throw new Error('postMessage failed'); };
  __setMockWorker(() => worker);

  await upload.handleFiles([{ name: 'a.json' }]);
  assert.equal(upload._importBusy, false, 'busy released after postMessage failure');
  assert.equal(state.get('loading'), false);
  assert.ok((bannerText(upload) || '').length > 0, 'postMessage failure shows a banner');
  __resetMockWorker();
});

test('worker.onerror restores state', async () => {
  const upload = makeUpload();
  const worker = makeWorker();
  __setMockWorker(() => worker);

  await upload.handleFiles([{ name: 'a.json' }]);
  worker.onerror(new Error('boom'));
  assert.equal(upload._importBusy, false);
  assert.equal(state.get('loading'), false);
  assert.ok((bannerText(upload) || '').length > 0);
  __resetMockWorker();
});

test('the done branch commits conversations and surfaces the dedup count', async () => {
  const upload = makeUpload();
  const worker = makeWorker();
  __setMockWorker(() => worker);

  await upload.handleFiles([{ name: 'a.json' }]);
  worker._emit({
    data: {
      type: 'done',
      conversations: [{ uuid: 'u1' }],
      duplicates: 2,
      fileMeta: [{ fileName: 'a.json', fileSize: 10 }],
    },
  });
  assert.equal(state.get('conversations').length, 1);
  assert.equal(upload._importBusy, false);
  assert.ok((bannerText(upload) || '').length > 0, 'dedup count is shown');
  __resetMockWorker();
});

test('the manifest guide survives a full re-render (language switch)', () => {
  const upload = makeUpload();
  upload.setManifestData({
    totalPartCount: 1,
    totalFiles: 3,
    conversationFiles: [{ filename: 'conversations-000.zip', part: 0, exportUrl: 'https://claude.ai/x/conversations-000.zip' }],
  });
  const firstSlot = upload.manifestSlot;
  assert.ok(firstSlot.children.length > 0, 'guide rendered on first pass');

  // Simulate the language switcher: wipe the container and re-render.
  upload.container.textContent = '';
  upload.render();
  assert.ok(upload.manifestSlot.children.length > 0, 'guide re-rendered after language change');
  assert.notEqual(upload.manifestSlot, firstSlot, 'render rebuilt the slot');
});

test('isSafeClaudeUrl accepts only the exact HTTPS claude.ai origin', () => {
  const upload = makeUpload();
  assert.equal(upload.isSafeClaudeUrl('https://claude.ai/x/y.zip'), true);
  assert.equal(upload.isSafeClaudeUrl('https://files.claude.ai/x/y.zip'), false, 'subdomain rejected');
  assert.equal(upload.isSafeClaudeUrl('https://claude.ai:8443/x'), false, 'nonstandard port rejected');
  assert.equal(upload.isSafeClaudeUrl('http://claude.ai/x'), false);
  assert.equal(upload.isSafeClaudeUrl('https://evil.com/claude.ai'), false);
  assert.equal(upload.isSafeClaudeUrl('https://user:pass@claude.ai/x'), false);
  assert.equal(upload.isSafeClaudeUrl('https://claude.ai.evil.com/x'), false);
  assert.equal(upload.isSafeClaudeUrl(''), false);
  assert.equal(upload.isSafeClaudeUrl(null), false);
});
