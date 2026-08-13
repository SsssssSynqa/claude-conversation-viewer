import assert from 'node:assert/strict';
import test from 'node:test';

import { state } from '../src/store/state.js';
import { exportAsHTML, exportAsMarkdown, exportAsText } from '../src/utils/export.js';

const conversation = {
  name: '<img src=x onerror="alert(1)">',
  createdAt: '2026-08-12T12:00:00Z',
  stats: { messageCount: 1 },
  messages: [{
    sender: 'assistant',
    createdAt: '2026-08-12T12:00:00Z',
    files: [],
    contentBlocks: [{ type: 'text', text: '<script>alert(2)</script>\n```nested```' }],
  }],
};

test('HTML 导出转义会话名、显示名与消息正文', () => {
  state.set('lang', 'en');
  const html = exportAsHTML([conversation], {
    displayNames: { assistant: '<svg onload="alert(3)">' },
  });
  assert.match(html, /<html lang="en">/);
  assert.doesNotMatch(html, /<script>alert\(2\)<\/script>/);
  assert.doesNotMatch(html, /<img src=x onerror=/);
  assert.doesNotMatch(html, /<svg onload=/);
  assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  assert.match(html, /1 messages/);
});

test('Markdown 和文本导出保留消息数与危险文本的字面内容', () => {
  state.set('lang', 'zh');
  const markdown = exportAsMarkdown([conversation]);
  const text = exportAsText([conversation]);
  assert.match(markdown, /1 条消息/);
  assert.doesNotMatch(markdown, /<img src=x onerror=/);
  assert.match(markdown, /&lt;img src=x onerror=/);
  assert.match(markdown, /````text/);
  assert.match(text, /1 条消息/);
  assert.match(text, /<script>alert\(2\)<\/script>/);
});
