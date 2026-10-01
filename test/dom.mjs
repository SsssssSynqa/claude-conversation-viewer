/**
 * Minimal DOM stand-in for node:test component tests.
 *
 * Supports the subset of the DOM the message/export components touch:
 * element creation/tree building, classList, inline styles, dataset,
 * attributes, and event dispatch (including a bubbling 'click' so delegated
 * document listeners work). Test-only; production code carries no shims.
 */

export class DomElement {
  constructor(tag) {
    this.tagName = String(tag || '').toUpperCase();
    this.nodeType = 1;
    this.children = [];
    this.parentNode = null;
    this.style = new Proxy({ cssText: '' }, { set: (o, k, v) => { o[k] = v; return true; } });
    this.dataset = {};
    this.id = '';
    this._className = '';
    this._text = '';
    this.attributes = {};
    this.listeners = {};
    this._classes = new Set();
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.title = '';
    this.href = '';
    this.download = '';
    this.multiple = false;
    this.accept = '';
    this.type = '';
  }

  set className(v) {
    this._className = String(v || '');
    this._classes = new Set(this._className.split(/\s+/).filter(Boolean));
  }
  get className() { return this._className; }

  set textContent(v) {
    this._text = String(v == null ? '' : v);
    this.children = [];
  }
  get textContent() {
    if (this.children.length === 0) return this._text;
    return this._text + this.children.map(c => c.textContent).join('');
  }

  // innerHTML is not parsed; setting it yields one placeholder child for the
  // first tag so callers that read firstElementChild (e.g. inline SVG) work.
  set innerHTML(v) {
    this.children = [];
    this._text = '';
    const m = /<\s*([a-zA-Z][\w-]*)/.exec(String(v || ''));
    if (m) this.appendChild(new DomElement(m[1]));
  }
  get innerHTML() { return ''; }
  get firstElementChild() { return this.children.find(c => c && c.nodeType === 1) || null; }

  get classList() {
    const self = this;
    return {
      add: (...c) => { c.forEach(x => self._classes.add(x)); self._sync(); },
      remove: (...c) => { c.forEach(x => self._classes.delete(x)); self._sync(); },
      toggle: (c, force) => {
        const want = force === undefined ? !self._classes.has(c) : !!force;
        if (want) self._classes.add(c); else self._classes.delete(c);
        self._sync();
        return want;
      },
      contains: (c) => self._classes.has(c),
    };
  }
  _sync() { this._className = [...this._classes].join(' '); }

  appendChild(child) {
    if (!child) return child;
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  insertBefore(child, ref) {
    if (!ref) return this.appendChild(child);
    const i = this.children.indexOf(ref);
    child.parentNode = this;
    this.children.splice(i < 0 ? this.children.length : i, 0, child);
    return child;
  }
  removeChild(child) {
    this.children = this.children.filter(c => c !== child);
    if (child) child.parentNode = null;
    return child;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  replaceChildren(...nodes) { this.children = []; nodes.forEach(n => this.appendChild(n)); }

  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) {
    if (this.listeners[type]) this.listeners[type] = this.listeners[type].filter(f => f !== fn);
  }

  setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'id') this.id = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  removeAttribute(k) { delete this.attributes[k]; }

  querySelector(sel) { return this._find(sel, false); }
  querySelectorAll(sel) { const out = []; this._collect(sel, out); return out; }
  _matches(sel) {
    if (!sel || typeof sel !== 'string') return false;
    if (sel.startsWith('.')) return this._classes.has(sel.slice(1));
    if (sel.startsWith('#')) return this.id === sel.slice(1);
    return this.tagName === sel.toUpperCase();
  }
  _find(sel, first) {
    for (const c of this.children) {
      if (c._matches && c._matches(sel)) return c;
      const deeper = c._find && c._find(sel, first);
      if (deeper) return deeper;
    }
    return null;
  }
  _collect(sel, out) {
    for (const c of this.children) {
      if (c._matches && c._matches(sel)) out.push(c);
      if (c._collect) c._collect(sel, out);
    }
  }
  contains(node) {
    if (node === this) return true;
    return this.children.some(c => c.contains && c.contains(node));
  }

  click() {
    const ev = { type: 'click', target: this, currentTarget: this, stopPropagation() {}, preventDefault() {} };
    let node = this;
    while (node) {
      for (const fn of (node.listeners && node.listeners.click) || []) fn(ev);
      node = node.parentNode;
    }
    // document-level delegated listeners
    if (globalThis.document) {
      for (const fn of globalThis.document.listeners.click || []) fn(ev);
    }
  }
  scrollIntoView() {}
  focus() {}
  getBoundingClientRect() { return { width: 0, height: 0, top: 0, left: 0 }; }
}

/** Install a fresh document/window/navigator into globalThis. Returns roots. */
export function installDom() {
  const root = new DomElement('div');
  root.id = 'app';
  const document = {
    listeners: {},
    body: new DomElement('body'),
    documentElement: new DomElement('html'),
    createElement: (t) => new DomElement(t),
    createElementNS: (_ns, t) => new DomElement(t),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t), parentNode: null, remove() {} }),
    getElementById: (id) => {
      if (root.id === id) return root;
      const found = root.querySelector('#' + id);
      if (found) return found;
      return document.body.querySelector('#' + id);
    },
    querySelector: (sel) => root.querySelector(sel),
    addEventListener: (type, fn) => { (document.listeners[type] ||= []).push(fn); },
    removeEventListener: (type, fn) => {
      if (document.listeners[type]) document.listeners[type] = document.listeners[type].filter(f => f !== fn);
    },
  };
  globalThis.document = document;
  const location = { href: 'http://localhost/', origin: 'http://localhost', protocol: 'http:', host: 'localhost', hostname: 'localhost', pathname: '/', search: '', hash: '' };
  globalThis.window = {
    document,
    location,
    navigator: { userAgent: 'node-test', clipboard: { writeText: async () => {} } },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    devicePixelRatio: 1,
    pageXOffset: 0,
    pageYOffset: 0,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    innerWidth: 1200,
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame: (fn) => { fn(); return 1; },
  };
  globalThis.requestAnimationFrame = (fn) => { fn(); return 1; };
  globalThis.cancelAnimationFrame = () => {};
  try { globalThis.navigator = { clipboard: { writeText: async () => {} } }; }
  catch { /* Node defines navigator as a getter; clipboard writes are optional in tests */ }
  if (typeof globalThis.navigator?.clipboard === 'undefined') {
    try { Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true }); }
    catch { /* ignore */ }
  }
  if (!globalThis.URL.createObjectURL) globalThis.URL.createObjectURL = () => 'blob:mock';
  if (!globalThis.URL.revokeObjectURL) globalThis.URL.revokeObjectURL = () => {};
  return { root, document };
}
