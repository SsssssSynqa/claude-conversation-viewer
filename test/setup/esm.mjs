/**
 * Node ESM loader hook used only by the test runner.
 *
 * The package root is CommonJS ("type": "commonjs") for Vite/browser
 * compatibility, while application sources are authored as ES modules. This
 * hook loads the repo's `.js` sources (under src/ and test/) as ESM so
 * node:test can import them directly — no build step or duplicate logic.
 *
 * Requires Node >= 22.15 (`module.registerHooks`).
 * Loaded via: node --import ./test/setup/esm.mjs --test "test/**\/*.test.js"
 */
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const mockWorkerUrl = new URL('./mock-worker.mjs', import.meta.url).href;

function resolveHook(specifier, context, nextResolve) {
  // `?worker&inline` is resolved by Vite at build time; under node:test we
  // point it at a configurable mock worker module.
  if (/\.js\?worker(&inline)?$/.test(specifier)) {
    return { url: mockWorkerUrl, shortCircuit: true };
  }
  // Static asset imports are inlined by Vite; stub them for node:test.
  if (/\.(png|gif|woff2|svg)$/i.test(specifier)) {
    return { url: 'data:text/javascript,export default "";', shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

function loadHook(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.js')) {
    const filename = fileURLToPath(url);
    const isApp = filename.startsWith(repoRoot + 'src/') || filename.startsWith(repoRoot + 'test/');
    if (isApp && !filename.includes('/node_modules/')) {
      return { format: 'module', source: readFileSync(filename, 'utf8'), shortCircuit: true };
    }
  }
  return nextLoad(url, context);
}

registerHooks({ resolve: resolveHook, load: loadHook });

// Test-only browser global stand-ins, installed BEFORE any application module
// is imported. Production sources must not carry Node shims.
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}
