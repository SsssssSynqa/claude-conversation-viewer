import assert from 'node:assert/strict';
import test from 'node:test';

import { extractEmojis } from '../src/utils/textStats.js';

test('Emoji 统计保留 ZWJ、肤色和旗帜为完整字素', () => {
  assert.deepEqual(
    extractEmojis('🦊✨ 👩🏽‍💻 家庭👨‍👩‍👧‍👦 国旗🇨🇳 key1️⃣'),
    ['🦊', '✨', '👩🏽‍💻', '👨‍👩‍👧‍👦', '🇨🇳', '1️⃣'],
  );
});

test('Emoji 统计忽略普通文字和未采用 emoji 呈现的数字', () => {
  assert.deepEqual(extractEmojis('Claude 123，今天很好。'), []);
});
