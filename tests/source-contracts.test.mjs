import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('统计图例不把显示名称拼入 innerHTML', async () => {
  const source = await readSource('src/components/StatsPanel.js');
  assert.doesNotMatch(source, /legend\.innerHTML\s*=/);
  assert.match(source, /document\.createTextNode\(label\)/);
});

test('Markdown 渲染继续经过 DOMPurify 且导出 HTML 转义标题', async () => {
  const markdownSource = await readSource('src/utils/markdown.js');
  const exportSource = await readSource('src/utils/export.js');
  assert.match(markdownSource, /DOMPurify\.sanitize\(/);
  assert.match(exportSource, /escapeForHtml\(conv\.name/);
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
    'src/styles/tactile.css',
  ];
  const source = (await Promise.all(files.map(readSource))).join('\n').toLowerCase();
  for (const forbidden of ['#f5f0ff', '#7c5cbf', '#8b5cf6', '#7c3aed', '#6d28d9']) {
    assert.equal(source.includes(forbidden), false, `found forbidden color ${forbidden}`);
  }
});

test('亮暗主题覆盖层不触碰 Claude 主题和锁定百分比环', async () => {
  const source = await readSource('src/styles/tactile.css');
  assert.doesNotMatch(source, /data-theme=["']claude["']/);
  assert.doesNotMatch(source, /\.stats-ring(?:\b|[-_])/);
});

test('旧 auto 主题会迁移到正式主题且不再维护漂移 token', async () => {
  const main = await readSource('src/main.js');
  const variables = await readSource('src/themes/variables.css');
  assert.match(main, /!THEMES\.includes\(state\.get\('theme'\)\)/);
  assert.doesNotMatch(variables, /data-theme=["']auto["']/);
});

test('会话标题和消息使用同一中央内容轴', async () => {
  const source = await readSource('src/components/MessageView.js');
  assert.match(source, /message-header-card content-constrained/);
  assert.match(source, /messages-inner content-constrained/);
  const main = await readSource('src/main.js');
  assert.match(main, /document\.createElement\('main'\)/);
});

test('上传区、名称输入和主题语言控件具有键盘与标签契约', async () => {
  const upload = await readSource('src/components/FileUpload.js');
  assert.match(upload, /zone\.setAttribute\('role', 'button'\)/);
  assert.match(upload, /errorBanner\.setAttribute\('role', 'alert'\)/);
  assert.match(upload, /prefers-reduced-motion: reduce/);
  assert.match(upload, /event\.key !== 'Enter' && event\.key !== ' '/);
  assert.match(upload, /querySelector\('label'\)\.htmlFor = 'name-human'/);
  assert.match(upload, /querySelector\('label'\)\.htmlFor = 'name-assistant'/);
  const main = await readSource('src/main.js');
  assert.match(main, /enableRadioGroupKeyboard/);
  assert.match(main, /humanLabel\.htmlFor = humanInput\.id/);
  assert.match(main, /assistantLabel\.htmlFor = assistantInput\.id/);
  const tactile = await readSource('src/styles/tactile.css');
  assert.match(tactile, /\.upload-zone,[\s\S]*\.name-config[\s\S]*max-width: 504px !important/);
});

test('亮暗主题覆盖层维持受控规模', async () => {
  const source = await readSource('src/styles/tactile.css');
  const substantiveLines = source.split('\n').filter(line => line.trim()).length;
  assert.ok(substantiveLines <= 920, 'tactile.css exceeded the reviewed substantive-line budget');
  assert.ok((source.match(/!important/g) || []).length <= 90, 'tactile.css exceeded the reviewed override budget');
  assert.doesNotMatch(source, /transition:\s*all/);
  assert.doesNotMatch(source, /cubic-bezier\([^)]*1\.56/);
  assert.match(source, /@media \(max-width: 768px\)[\s\S]*\.name-input-group > input[\s\S]*font-size: 16px/);
});
