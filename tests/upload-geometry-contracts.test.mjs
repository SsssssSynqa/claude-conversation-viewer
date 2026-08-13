import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function declarationsForSelector(source, selectorFragment) {
  return [...source.matchAll(/(?:^|\n)([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.includes(selectorFragment))
    .map(([, selectors, declarations]) => ({
      selectors: selectors.replace(/\/\*[\s\S]*?\*\//g, '').trim(),
      declarations,
    }));
}

test('上传页的首屏锚点由三主题共享的基础规则唯一控制', async () => {
  const base = await readSource('src/styles/base.css');
  const tactile = await readSource('src/styles/tactile.css');
  const baseRules = declarationsForSelector(base, '.upload-screen');
  const baseRule = baseRules.find(rule => rule.selectors === '.upload-screen');

  assert.ok(baseRule, 'missing shared .upload-screen rule');
  assert.match(baseRule.declarations, /padding:\s*18px 18px 20px;/);
  assert.match(baseRule.declarations, /padding-top:\s*15vh;/);
  assert.match(baseRule.declarations, /gap:\s*16px;/);

  for (const rule of declarationsForSelector(tactile, '.upload-screen')) {
    assert.doesNotMatch(
      rule.declarations,
      /(?:^|;)\s*(?:padding|padding-top|gap)\s*:/,
      `theme layer must not move the shared upload anchor: ${rule.selectors}`,
    );
  }
});

test('上传页三主题共享相同的 504px 桌面内容轴', async () => {
  const base = await readSource('src/styles/base.css');
  const tactile = await readSource('src/styles/tactile.css');
  const upload = await readSource('src/components/FileUpload.js');

  assert.match(base, /\.upload-zone\s*\{[\s\S]*?max-width:\s*504px;/);
  assert.match(base, /\.name-config\s*\{[\s\S]*?max-width:\s*504px;/);
  assert.match(tactile, /\.upload-zone,[\s\S]*?\.name-config\s*\{[\s\S]*?max-width:\s*504px !important;/);
  assert.match(upload, /zone\.style\.cssText = '[^']*max-width:504px;/);
  assert.match(upload, /banner\.style\.cssText = '[^']*max-width:504px;/);
});

test('手机只改变内容流宽度和输入编排，不覆盖首屏上边距', async () => {
  const tactile = await readSource('src/styles/tactile.css');
  const mobile = tactile.match(/@media \(max-width: 768px\) \{([\s\S]*)\n\}/)?.[1] || '';

  assert.match(mobile, /\.name-input-group > input[\s\S]*?font-size:\s*16px/);
  assert.doesNotMatch(mobile, /\.upload-screen\s*\{[^}]*padding(?:-top)?\s*:/);
  assert.doesNotMatch(mobile, /\.upload-screen\s*\{[^}]*gap\s*:/);
});
