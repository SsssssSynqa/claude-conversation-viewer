/**
 * Regression tests for the i18n batch and search snippet cleaning.
 *
 * Protects:
 *   - export.msgCount interpolates the message count in both languages
 *     (previously the templates had no {{n}} and rendered "条消息" bare).
 *   - The reader selection toolbar follows the active language instead of
 *     hardcoded Chinese strings.
 *   - SearchPanel._cleanSnippet strips markdown syntax so result snippets
 *     read as prose.
 *
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

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
const { t } = await import('../src/i18n.js');
const { MessageView } = await import('../src/components/MessageView.js');
const { SearchPanel } = await import('../src/components/SearchPanel.js');

function buildConv() {
  return parseConversation({
    uuid: 'conv-i18n',
    name: 'i18n fixture',
    summary: '',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:10Z',
    chat_messages: [
      {
        uuid: 'h-1', sender: 'human', created_at: '2026-10-01T00:00:00Z',
        content: [{ type: 'text', text: 'hello' }],
      },
      {
        uuid: 'a-1', sender: 'assistant', created_at: '2026-10-01T00:00:10Z',
        content: [{ type: 'text', text: 'world' }],
      },
    ],
  });
}

function mountView(c) {
  state.set('theme', 'light');
  state.set('conversations', [c]);
  state.set('filteredConversations', [c]);
  state.set('currentConversationIndex', 0);
  state.set('viewMode', 'conversation');
  const container = globalThis.document.createElement('div');
  const view = new MessageView(container);
  view.renderConversation();
  return { view, container };
}

function findById(root, id) {
  let found = null;
  (function walk(node) {
    if (node.id === id) found = node;
    for (const ch of node.children || []) walk(ch);
  })(root);
  return found;
}

function textOf(node) {
  return node.children.length === 0 ? node._text : node._text + node.children.map(textOf).join('');
}

test('export.msgCount interpolates the count in zh and en', () => {
  state.set('lang', 'zh');
  assert.equal(t('export.msgCount', { n: 3 }), '3 条消息');
  state.set('lang', 'en');
  assert.equal(t('export.msgCount', { n: 3 }), '3 messages');
  state.set('lang', 'zh');
});

test('selection toolbar follows the active language', () => {
  const conv = buildConv();

  state.set('lang', 'zh');
  const zhMount = mountView(conv);
  zhMount.view.selectMode = true;
  zhMount.view.selectedIndices.add(0);
  zhMount.view._updateSelectionToolbar(conv);
  const zhToolbar = textOf(findById(zhMount.container, 'selection-toolbar'));
  assert.ok(zhToolbar.includes('已选 1 条'), 'zh count: ' + zhToolbar);
  assert.ok(zhToolbar.includes('导出选中'), 'zh export button: ' + zhToolbar);
  zhMount.view.destroy();

  state.set('lang', 'en');
  const enMount = mountView(conv);
  enMount.view.selectMode = true;
  enMount.view.selectedIndices.add(0);
  enMount.view._updateSelectionToolbar(conv);
  const enToolbar = textOf(findById(enMount.container, 'selection-toolbar'));
  assert.ok(enToolbar.includes('1 selected'), 'en count: ' + enToolbar);
  assert.ok(enToolbar.includes('Export Selected'), 'en export button: ' + enToolbar);
  assert.ok(enToolbar.includes('Cancel'), 'en cancel button: ' + enToolbar);
  assert.ok(!enToolbar.includes('已选'), 'no hardcoded zh leaks: ' + enToolbar);
  enMount.view.destroy();
  state.set('lang', 'zh');
});

test('_cleanSnippet strips markdown syntax and keeps prose', () => {
  const panel = new SearchPanel();
  const cleaned = panel._cleanSnippet(
    '## 标题\n一些 **加粗** 和 `inline code` 文本\n```js\nconst x = 1;\n```\n> 引用\n- 列表项'
  );
  assert.ok(!cleaned.includes('#'), cleaned);
  assert.ok(!cleaned.includes('**'), cleaned);
  assert.ok(!cleaned.includes('```'), cleaned);
  assert.ok(cleaned.includes('加粗'), cleaned);
  assert.ok(cleaned.includes('inline code'), cleaned);
  assert.ok(cleaned.includes('const x = 1;'), cleaned);
  assert.ok(!/\s{2,}/.test(cleaned), 'whitespace collapsed: ' + cleaned);
});

test('_cleanSnippet leaves plain prose untouched', () => {
  const panel = new SearchPanel();
  const plain = '月亮在 prompt 的尽头等她。The quick brown fox.';
  assert.equal(panel._cleanSnippet(plain), plain);
});
