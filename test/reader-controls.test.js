/**
 * Regression tests for the reader-controls polish.
 *
 * These protect the real behaviour contracts changed in this work order:
 *   - Claude timeline exposes the FULL thinking + tool payloads on demand
 *     (thinking text, toolInput, PAIRED result, standalone result), with a
 *     distinct, desensitized title/preview instead of raw reasoning in the row.
 *   - Screen desensitization actually masks thinking text in the summary,
 *     the item preview AND the detail body.
 *   - The quick-export menu is a native, keyboard-operable menu (open, arrow /
 *     Home / End navigation, Escape return-to-trigger, outside close).
 *   - The view/select toggle is a real switch that keeps focus after re-render.
 *   - Export options are native checkboxes with format-button aria-pressed and
 *     real accessible names on the naming inputs.
 *
 * Synthetic data only. Not a security proof — the DOM shim is a test stand-in.
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
const { state } = await import('../src/store/state.js');
const { MessageView } = await import('../src/components/MessageView.js');
const { SearchPanel } = await import('../src/components/SearchPanel.js');
const { ExportPanel } = await import('../src/components/ExportPanel.js');

// ---------------------------------------------------------------- fixtures

const LONG_STANDALONE = 'STANDALONE_BODY_' + 'z'.repeat(400) + '_END_STANDALONE';
const PAIRED_RESULT = 'PAIRED_RESULT_BODY_' + 'p'.repeat(120) + '_END_PAIRED';

function rawConv(messages, uuid = 'conv-reader') {
  return {
    uuid,
    name: 'Reader controls',
    summary: '',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:10Z',
    chat_messages: messages,
  };
}

function buildConv(uuid = 'conv-reader') {
  return parseConversation(rawConv([
    {
      uuid: 'u-1', sender: 'human', created_at: '2026-10-01T00:00:00Z',
      content: [{ type: 'text', text: 'please act' }],
    },
    {
      uuid: 'a-1', sender: 'assistant', created_at: '2026-10-01T00:00:10Z',
      content: [
        {
          type: 'thinking',
          thinking: 'SECRETWORD reasoning body that must stay reachable and masked when redaction is on.',
          start_timestamp: '2026-10-01T00:00:00Z',
          stop_timestamp: '2026-10-01T00:00:08Z',
          summaries: [],
        },
        {
          type: 'tool_use',
          name: 'synthetic_tool_with_a_very_long_name_to_check_narrow_layout',
          input: { query: 'collection persistence', limit: 3 },
          message: 'Read local synthetic notes',
        },
        { type: 'tool_result', content: PAIRED_RESULT },
        { type: 'tool_result', content: LONG_STANDALONE },
        { type: 'text', text: 'Done summarizing.' },
      ],
    },
  ]), uuid);
}

/** A timeline with ONLY standalone tool_results (no thinking / no tool_use). */
function buildResultOnlyConv() {
  return parseConversation(rawConv([
    {
      uuid: 'a-2', sender: 'assistant', created_at: '2026-10-01T00:00:10Z',
      content: [{ type: 'tool_result', content: 'Standalone only output body.' }],
    },
  ], 'conv-results-only'));
}

function mountClaude(c) {
  state.set('theme', 'claude');
  state.set('showThinking', true);
  state.set('showToolUse', true);
  state.set('showFlags', true);
  state.set('desensitize', false);
  state.set('desensitizeWords', []);
  state.set('conversations', [c]);
  state.set('filteredConversations', [c]);
  state.set('currentConversationIndex', 0);
  state.set('viewMode', 'conversation');
  const container = globalThis.document.createElement('div');
  const view = new MessageView(container);
  view.renderConversation();
  return { view, container };
}

function findByClass(root, cls) {
  const out = [];
  (function walk(node) {
    if (node._classes && node._classes.has(cls)) out.push(node);
    for (const ch of node.children || []) walk(ch);
  })(root);
  return out;
}

function textOf(node) {
  return node.children.length === 0 ? node._text : node._text + node.children.map(textOf).join('');
}

function keydownOn(node, key) {
  const ev = { type: 'keydown', key, target: node, currentTarget: node, preventDefault() {}, stopPropagation() {} };
  let n = node;
  while (n) {
    for (const fn of (n.listeners && n.listeners.keydown) || []) fn(ev);
    n = n.parentNode;
  }
  for (const fn of globalThis.document.listeners.keydown || []) fn(ev);
}

// --------------------------------------------------------------- timeline

test('Claude timeline uses a native summary button with truthful aria-expanded', () => {
  const { container } = mountClaude(buildConv());
  const [summary] = findByClass(container, 'timeline-summary');
  assert.ok(summary, 'timeline summary rendered');
  assert.equal(summary.tagName, 'BUTTON');
  assert.equal(summary.attributes['aria-expanded'], 'false');
  const [body] = findByClass(container, 'timeline-body');
  assert.equal(body.hidden, true, 'timeline body starts collapsed');

  summary.click();
  assert.equal(summary.attributes['aria-expanded'], 'true', 'clicking expands');
  assert.equal(body.hidden, false, 'timeline body becomes visible');
  summary.click();
  assert.equal(summary.attributes['aria-expanded'], 'false', 'clicking again collapses');
  assert.equal(body.hidden, true);
});

test('timeline items carry a visible disclosure marker and full payloads', () => {
  const { container } = mountClaude(buildConv());
  findByClass(container, 'timeline-summary')[0].click();

  const items = findByClass(container, 'timeline-item');
  assert.ok(items.length >= 3, 'thinking + tool + standalone result items');
  assert.ok(
    items.every(it => findByClass(it, 'timeline-item-marker').length === 1),
    'every expandable item has a disclosure marker',
  );

  // Thinking item: fixed type title, masked-preview in the row, full text in body.
  const titles = findByClass(container, 'timeline-item-title').map(n => n.textContent);
  assert.ok(titles.includes('思考过程'), 'thinking item uses an explicit type title, not raw reasoning');
  const detailTexts = findByClass(container, 'timeline-detail-text').map(n => n.textContent);
  assert.ok(
    detailTexts.some(t => t.includes('SECRETWORD reasoning body')),
    'full thinking text is reachable in the detail body',
  );

  // Tool item: full name reachable, plus input and the PAIRED result body.
  const pres = findByClass(container, 'timeline-detail-pre').map(n => n.textContent);
  assert.ok(pres.some(p => p.includes('collection persistence')), 'toolInput shown');
  assert.ok(
    pres.some(p => p.includes('_END_PAIRED')),
    'the paired tool result is available IN FULL, not just a preview',
  );
  const names = findByClass(container, 'timeline-detail-name').map(n => n.textContent);
  assert.ok(
    names.some(n => n.includes('very_long_name_to_check_narrow_layout')),
    'full (long) tool name reachable in the detail body',
  );

  // Standalone result: labeled as a tool result and reachable in full.
  assert.ok(pres.some(p => p.includes('_END_STANDALONE')), 'standalone result available in full');
});

test('results-only timeline is labeled as tool results, not thinking', () => {
  const { container } = mountClaude(buildResultOnlyConv());
  const [summary] = findByClass(container, 'timeline-summary');
  const summaryText = findByClass(summary, 'timeline-summary-text')[0].textContent;
  assert.equal(summaryText, '工具结果', 'fallback reflects tool_result content type');
  const titles = findByClass(container, 'timeline-item-title').map(n => n.textContent);
  assert.ok(titles.every(t => t === '工具结果'), 'no thinking mislabel for result-only timelines');
});

test('timeline summary reports tool/thinking counts and parser duration', () => {
  const { container } = mountClaude(buildConv());
  const [summary] = findByClass(container, 'timeline-summary');
  const count = findByClass(summary, 'timeline-count')[0].textContent;
  assert.match(count, /1\s*次思考/);
  assert.match(count, /1\s*次工具/);
  const duration = findByClass(summary, 'timeline-duration')[0].textContent;
  assert.match(duration, /8\.0s/, 'uses the parser durationText (8s)');
});

// --------------------------------------------------------- desensitization

test('screen desensitization masks thinking in summary, preview and body', () => {
  const { container, view } = mountClaude(buildConv());
  state.set('desensitizeWords', ['SECRETWORD']);
  state.set('desensitize', true);
  view.renderConversation();
  findByClass(container, 'timeline-summary')[0].click();

  const masked = findByClass(container, 'timeline-summary-text')[0].textContent;
  assert.ok(!masked.includes('SECRETWORD'), 'summary does not leak the raw sensitive word');
  assert.ok(masked.includes('***'), 'summary shows the masked form');

  const sub = findByClass(container, 'timeline-item-sub')[0].textContent;
  assert.ok(!sub.includes('SECRETWORD'), 'item preview does not leak the raw sensitive word');

  const bodyTexts = findByClass(container, 'timeline-detail-text').map(n => n.textContent);
  assert.ok(bodyTexts.some(t => t.includes('***')), 'detail body shows masked text');
  assert.ok(bodyTexts.every(t => !t.includes('SECRETWORD')), 'detail body never leaks the raw word');

  // Reset global state for later tests.
  state.set('desensitize', false);
  state.set('desensitizeWords', []);
});

// ---------------------------------------------------------- export dropdown

test('quick-export menu is a native keyboard menu', () => {
  state.set('theme', 'light');
  const c = buildConv();
  state.set('conversations', [c]);
  state.set('filteredConversations', [c]);
  state.set('currentConversationIndex', 0);
  state.set('viewMode', 'conversation');
  const container = globalThis.document.createElement('div');
  const view = new MessageView(container);
  view.renderConversation();

  const [trigger] = findByClass(container, 'export-dropdown-trigger');
  assert.ok(trigger, 'export trigger rendered');
  assert.equal(trigger.attributes['aria-haspopup'], 'menu');
  assert.equal(trigger.attributes['aria-expanded'], 'false');

  const items = findByClass(container, 'export-dropdown-item');
  assert.ok(items.length >= 4, 'menu items are real elements');
  assert.ok(items.every(i => i.tagName === 'BUTTON'), 'menu items are native buttons');
  assert.ok(items.every(i => i.attributes['role'] === 'menuitem'), 'menu items expose menuitem role');

  // Enter on the trigger opens and focuses the first item.
  globalThis.document.activeElement = trigger;
  keydownOn(trigger, 'Enter');
  assert.equal(trigger.attributes['aria-expanded'], 'true', 'Enter opens the menu');
  assert.equal(globalThis.document.activeElement, items[0], 'focus enters the first item');

  // Arrow navigation + Home/End.
  keydownOn(items[0], 'ArrowDown');
  assert.equal(globalThis.document.activeElement, items[1], 'ArrowDown moves to next item');
  keydownOn(items[1], 'End');
  assert.equal(globalThis.document.activeElement, items[items.length - 1], 'End jumps to last item');
  keydownOn(items[items.length - 1], 'Home');
  assert.equal(globalThis.document.activeElement, items[0], 'Home jumps to first item');
  keydownOn(items[0], 'ArrowUp');
  assert.equal(globalThis.document.activeElement, items[items.length - 1], 'ArrowUp wraps to last item');

  // Escape closes and returns focus to the still-present trigger.
  keydownOn(items[0], 'Escape');
  assert.equal(trigger.attributes['aria-expanded'], 'false', 'Escape closes the menu');
  assert.equal(view.activeExportDropdown, null, 'active dropdown cleared');
  assert.equal(globalThis.document.activeElement, trigger, 'Escape returns focus to trigger');
});

test('quick-export outside click closes without stealing the new target focus', () => {
  state.set('theme', 'light');
  const c = buildConv();
  state.set('conversations', [c]);
  state.set('filteredConversations', [c]);
  state.set('currentConversationIndex', 0);
  state.set('viewMode', 'conversation');
  const container = globalThis.document.createElement('div');
  const view = new MessageView(container);
  view.renderConversation();

  const [trigger] = findByClass(container, 'export-dropdown-trigger');
  trigger.click();
  assert.equal(trigger.attributes['aria-expanded'], 'true');

  const other = globalThis.document.createElement('button');
  globalThis.document.body.appendChild(other);
  globalThis.document.activeElement = other;
  // Simulate a document click whose target is outside the wrapper.
  for (const fn of globalThis.document.listeners.click || []) {
    fn({ type: 'click', target: other, stopPropagation() {}, preventDefault() {} });
  }
  assert.equal(trigger.attributes['aria-expanded'], 'false', 'outside click closes the menu');
  assert.equal(globalThis.document.activeElement, other, 'outside close does not steal focus');
});

// --------------------------------------------------------------- mode toggle

test('mode toggle is a switch and keeps focus on the live replacement after re-render', () => {
  state.set('theme', 'light');
  const c = buildConv();
  state.set('conversations', [c]);
  state.set('filteredConversations', [c]);
  state.set('currentConversationIndex', 0);
  state.set('viewMode', 'conversation');
  const container = globalThis.document.createElement('div');
  const view = new MessageView(container);
  view.renderConversation();

  const [toggle] = findByClass(container, 'message-mode-toggle');
  assert.ok(toggle, 'mode toggle rendered');
  assert.equal(toggle.tagName, 'BUTTON');
  assert.equal(toggle.attributes['role'], 'switch');
  assert.equal(toggle.attributes['aria-checked'], 'false');

  globalThis.document.activeElement = toggle;
  toggle.click();
  assert.equal(view.selectMode, true, 'toggle switched mode on');

  const [toggleAfter] = findByClass(container, 'message-mode-toggle');
  assert.notEqual(toggleAfter, toggle, 'toggle element was recreated by the re-render');
  assert.equal(toggleAfter.attributes['aria-checked'], 'true', 'replacement reflects new state');
  assert.equal(globalThis.document.activeElement, toggleAfter, 'focus moved to the live replacement');
});

// ---------------------------------------------------------------- search filters

test('search filter select stays a native select wrapped for a themed arrow', () => {
  const panel = new SearchPanel();
  const shell = panel._createSelect('search-role', [
    { value: 'all', label: 'All' },
    { value: 'human', label: 'Human' },
  ], 'All roles');
  assert.equal(shell.shell._classes.has('select-shell'), true);
  assert.equal(shell.select.tagName, 'SELECT', 'still a real <select> for native behaviour');
  assert.equal(shell.select.id, 'search-role');
  assert.equal(shell.select.attributes['aria-label'], 'All roles', 'select has an accessible name');
  assert.equal(shell.select.children.length, 2, 'options preserved');
  assert.equal(shell.shell.children.some(c => c._classes.has('select-chevron')), true);
});

// ---------------------------------------------------------------- export panel

test('export options are native checkboxes with real labels and default state', () => {
  const panel = new ExportPanel();
  const container = globalThis.document.createElement('div');
  panel.render(container);

  const inputs = findByClass(container, 'export-option-input');
  assert.equal(inputs.length, 4, 'four option checkboxes');
  assert.ok(inputs.every(i => i.tagName === 'INPUT' && i.type === 'checkbox'), 'options are native checkboxes');
  assert.ok(inputs.every(i => i.parentNode && i.parentNode._classes.has('export-option')), 'each is wrapped by a label');

  // Native checked defaults are preserved: thinking on, tools/flags off, BOM on.
  const box0 = findByClass(container, 'export-option-box');
  assert.equal(inputs[0].checked, true, 'includeThinking default on');
  assert.equal(inputs[1].checked, false, 'includeToolUse default off');
  assert.equal(box0.length, 4, 'a visible selected-state box per option');

  // Toggling through the native change event updates the option.
  inputs[1].checked = true;
  inputs[1].dispatchEvent({ type: 'change' });
  assert.equal(panel.options.includeToolUse, true, 'change event updates the option value');
});

test('export format buttons expose aria-pressed and naming inputs have accessible names', () => {
  const panel = new ExportPanel();
  const container = globalThis.document.createElement('div');
  panel.render(container);

  const fmtBtns = findByClass(container, 'export-format-btn');
  assert.equal(fmtBtns.length, 4);
  assert.equal(fmtBtns[0].attributes['aria-pressed'], 'true', 'default format is pressed');
  fmtBtns[1].click();
  assert.equal(panel.format, 'txt', 'clicking updates the format');
  assert.equal(fmtBtns[1].attributes['aria-pressed'], 'true', 'new format pressed');
  assert.equal(fmtBtns[0].attributes['aria-pressed'], 'false', 'old format unpressed');

  const prefix = findByClass(container, 'export-mini-input')[0];
  const suffix = findByClass(container, 'export-mini-input')[1];
  assert.ok(prefix && suffix, 'naming inputs rendered');
  assert.ok(prefix.attributes['aria-label'], 'prefix input has an accessible name');
  assert.ok(suffix.attributes['aria-label'], 'suffix input has an accessible name');
});

export {};
