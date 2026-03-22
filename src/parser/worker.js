/**
 * Web Worker for background JSON parsing.
 * Parses conversation JSON without blocking the UI thread.
 * Posts progress updates so the main thread can show Clawd animation progress.
 */

import { parseConversation } from './claude.js';

self.onmessage = function (e) {
  const { jsonString } = e.data;

  try {
    self.postMessage({ type: 'status', message: '正在解析 JSON...' });

    const raw = JSON.parse(jsonString);

    if (!Array.isArray(raw)) {
      self.postMessage({
        type: 'error',
        message: '数据格式不正确：期望一个对话数组',
      });
      return;
    }

    const total = raw.length;
    const conversations = [];

    for (let i = 0; i < total; i++) {
      const parsed = parseConversation(raw[i]);
      if (parsed) {
        conversations.push(parsed);
      }

      // Post progress every 5 conversations (avoid message flooding)
      if (i % 5 === 0 || i === total - 1) {
        self.postMessage({ type: 'progress', current: i + 1, total });
      }
    }

    // Sort by creation date, newest first
    conversations.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    self.postMessage({ type: 'done', conversations });
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: `解析失败: ${err.message}`,
    });
  }
};
