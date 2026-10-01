/**
 * Test-only harness that runs the REAL parser worker script in a vm sandbox,
 * stubbing worker globals. Static imports are resolved against the actual host
 * modules so the test exercises real code, not a reimplementation.
 */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const srcBase = new URL('../src/', import.meta.url);
const workerPath = fileURLToPath(new URL('parser/worker.js', srcBase));
const claudePath = fileURLToPath(new URL('parser/claude.js', srcBase));
const corePath = fileURLToPath(new URL('parser/import-core.js', srcBase));

const [claude, core] = await Promise.all([
  import('file://' + claudePath),
  import('file://' + corePath),
]);

const modules = {
  [claudePath]: claude,
  [corePath]: core,
};

/**
 * Post `{ files }` to the real worker handler and return posted messages.
 * @param {{ files: any[] }} data
 */
export async function runWorker(data) {
  const messages = [];
  const sandbox = {
    console, Date, Math, JSON, Set, Map, Array, Number, String, Object, RegExp,
    Error, Promise, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer, URL,
    __modules: modules,
  };
  sandbox.self = {
    postMessage: (m) => messages.push(m),
    onmessage: null,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const transformed = readFileSync(workerPath, 'utf8')
    .replace(/^import\s+\{([^}]*)\}\s+from\s+'([^']+)';\s*$/gm, (_m, names, spec) => {
      const key = spec === './claude.js' ? claudePath
        : spec === './import-core.js' ? corePath
        : (() => { throw new Error('unexpected worker import: ' + spec); })();
      return `const {${names}} = __modules[${JSON.stringify(key)}];`;
    });

  vm.runInContext(transformed, sandbox, { filename: 'worker.js' });
  const handler = sandbox.self.onmessage;
  if (typeof handler !== 'function') throw new Error('worker did not register self.onmessage');
  await handler({ data });
  return messages;
}

export { workerPath, claudePath, corePath };
