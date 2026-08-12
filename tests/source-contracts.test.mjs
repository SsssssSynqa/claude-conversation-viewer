import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('统计图例不把显示名称拼入 innerHTML', async () => {
  const source = await readSource('src/components/StatsPanel.js');
  assert.doesNotMatch(source, /legend\.innerHTML\s*=/);
  assert.match(source, /document\.createTextNode\(label\)/);
});

test('中英文导出消息数文案都保留数值占位符', async () => {
  const source = await readSource('src/i18n.js');
  const matches = source.match(/'export\.msgCount':\s*'[^']*\{\{n\}\}[^']*'/g) || [];
  assert.equal(matches.length, 2);
});

test('应用与导出产物不再包含已拒绝的紫色值', async () => {
  const files = [
    'src/utils/export.js',
    'src/themes/variables.css',
    'src/styles/base.css',
    'src/styles/components.css',
    'src/styles/refinement.css',
  ];
  const source = (await Promise.all(files.map(readSource))).join('\n').toLowerCase();
  for (const forbidden of ['#f5f0ff', '#7c5cbf', '#8b5cf6', '#7c3aed', '#6d28d9']) {
    assert.equal(source.includes(forbidden), false, `found forbidden color ${forbidden}`);
  }
});
