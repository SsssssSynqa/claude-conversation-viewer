import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/i18n.js', import.meta.url), 'utf8');
const zhSource = source.match(/const zh = \{([\s\S]*?)\n\};\n\nconst en =/u)?.[1] || '';
const enSource = source.match(/const en = \{([\s\S]*?)\n\};\n\nconst dictionaries/u)?.[1] || '';
const keys = block => [...block.matchAll(/^\s*'([^']+)':/gmu)].map(match => match[1]);

test('中英文词典键完全一致且没有重复键', () => {
  const zhKeys = keys(zhSource);
  const enKeys = keys(enSource);
  assert.equal(new Set(zhKeys).size, zhKeys.length, 'Chinese dictionary contains duplicate keys');
  assert.equal(new Set(enKeys).size, enKeys.length, 'English dictionary contains duplicate keys');
  assert.deepEqual([...new Set(enKeys)].sort(), [...new Set(zhKeys)].sort());
});

test('所有插值变量在中英文中保持一致', () => {
  const entries = block => new Map([...block.matchAll(/^\s*'([^']+)':\s*'((?:\\'|[^'])*)'/gmu)].map(match => [match[1], match[2]]));
  const zhEntries = entries(zhSource);
  const enEntries = entries(enSource);
  for (const [key, zhValue] of zhEntries) {
    const variables = value => [...value.matchAll(/\{\{([^}]+)\}\}/g)].map(match => match[1]).sort();
    assert.deepEqual(variables(enEntries.get(key) || ''), variables(zhValue), `placeholder mismatch for ${key}`);
  }
});
