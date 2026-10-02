import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dist = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');

test('生产单文件包含应用且不泄露开发视觉夹具入口', () => {
  assert.match(dist, /<script type="module"(?:\s[^>]*)?>/);
  assert.doesNotMatch(dist, /conversations\.synthetic|Load visual regression fixture|__fixture/);
});

test('生产单文件不包含已拒绝的紫色值', () => {
  const lower = dist.toLowerCase();
  for (const forbidden of ['#f5f0ff', '#7c5cbf', '#8b5cf6', '#7c3aed', '#6d28d9']) {
    assert.equal(lower.includes(forbidden), false, `found forbidden color ${forbidden}`);
  }
});

test('生产 CSP 禁止对象、表单与开发 WebSocket 连接', () => {
  assert.match(dist, /default-src 'self'/);
  assert.match(dist, /object-src 'none'/);
  assert.match(dist, /base-uri 'none'/);
  assert.match(dist, /form-action 'none'/);
  assert.match(dist, /connect-src 'self';/);
  assert.doesNotMatch(dist, /ws:\/\/(?:127\.0\.0\.1|localhost)/);
});
