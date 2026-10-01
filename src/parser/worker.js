/**
 * Web Worker for local conversation import.
 *
 * The main thread posts the selected File objects once:
 *     { files: File[] }
 *
 * All local reading (File.text / arrayBuffer), ZIP decompression (JSZip) and
 * JSON parsing happen here, off the UI thread, via the shared import core. The
 * worker posts a manifest guide, progress updates, a done message, or an error
 * carrying a stable code. It never performs network access.
 */

import { parseConversation } from './claude.js';
import { importSelectedFiles } from './import-core.js';

self.onmessage = async function (e) {
  const { files } = e.data || {};

  try {
    self.postMessage({ type: 'status' });

    const result = await importSelectedFiles({
      files,
      parseConversation,
      onProgress: (current, total) => {
        self.postMessage({ type: 'progress', current, total });
      },
    });

    if (result.type === 'manifest') {
      self.postMessage({ type: 'manifest', manifest: result.manifest });
      return;
    }

    if (result.type === 'no_conversations') {
      self.postMessage({ type: 'no_conversations', ignoredUnrelated: result.ignoredUnrelated });
      return;
    }

    self.postMessage({
      type: 'done',
      conversations: result.conversations,
      total: result.total,
      duplicates: result.duplicates,
      fileMeta: result.fileMeta,
      ignoredUnrelated: result.ignoredUnrelated,
    });
  } catch (err) {
    self.postMessage({
      type: 'error',
      code: (err && err.code) || 'parse_failed',
      file: err && err.file,
      detail: err && !err.code ? (err instanceof Error ? err.message : String(err)) : undefined,
    });
  }
};
