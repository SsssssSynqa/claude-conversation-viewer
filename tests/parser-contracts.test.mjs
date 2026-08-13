import assert from 'node:assert/strict';
import test from 'node:test';

import { parseConversation } from '../src/parser/claude.js';

test('解析器跳过空值与畸形会话而不抛出异常', () => {
  for (const value of [null, undefined, 7, 'bad', [], {}]) {
    assert.doesNotThrow(() => parseConversation(value));
    assert.equal(parseConversation(value), null);
  }
});

test('解析器忽略畸形消息字段并保留其余有效内容', () => {
  const parsed = parseConversation({
    uuid: 'edge-case',
    name: 'Edge case',
    chat_messages: [
      null,
      42,
      { sender: 'human', content: [{ type: 'text', text: 123 }] },
      { sender: 'assistant', content: [{ type: 'thinking', thinking: 'ok', summaries: 'bad' }] },
      { sender: 'assistant', text: 'fallback', files: [null, { file_name: 12 }, { file_name: 'a.txt' }] },
      { sender: 'assistant', content: [{ type: 'tool_result', output: { ok: true } }] },
    ],
  });

  assert.equal(parsed.messages.length, 3);
  assert.equal(parsed.stats.thinkingCount, 1);
  assert.deepEqual(parsed.messages[1].files, ['a.txt']);
  assert.equal(parsed.messages[2].contentBlocks[0].result, '{"ok":true}');
});

test('解析器将负数或无效思考时长归零', () => {
  const parsed = parseConversation({
    chat_messages: [{
      sender: 'assistant',
      content: [{
        type: 'thinking',
        thinking: 'test',
        start_timestamp: '2026-08-12T12:00:02Z',
        stop_timestamp: 'invalid',
      }],
    }],
  });
  assert.equal(parsed.messages[0].contentBlocks[0].durationMs, 0);
  assert.equal(parsed.stats.totalThinkingMs, 0);
});
