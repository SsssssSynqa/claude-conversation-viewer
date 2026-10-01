/**
 * Configurable stand-in for the Vite `?worker&inline` import used by tests.
 *
 * Production uses the real bundled worker; the test loader rewrites the worker
 * import to this module. Tests install a factory to observe postMessage and to
 * drive onmessage/onerror, then reset it.
 */
let factory = () => {
  const w = { onmessage: null, onerror: null, postMessage() {}, terminate() {} };
  return w;
};
let last = null;

export function __setMockWorker(fn) { factory = fn; }
export function __lastMockWorker() { return last; }
export function __resetMockWorker() {
  factory = () => ({ onmessage: null, onerror: null, postMessage() {}, terminate() {} });
  last = null;
}

export default class MockWorker {
  constructor() {
    const w = factory();
    last = w;
    // Ensure the instance is usable as a worker even if the factory omitted bits.
    w.onmessage = w.onmessage || null;
    w.onerror = w.onerror || null;
    w.postMessage = w.postMessage || (() => {});
    w.terminate = w.terminate || (() => {});
    return w;
  }
}
