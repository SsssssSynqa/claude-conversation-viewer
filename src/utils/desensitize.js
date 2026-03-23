/**
 * Data desensitization utility.
 * Replaces sensitive words with *** in text content.
 */

import { state } from '../store/state.js';

/**
 * Apply desensitization to text if mode is enabled.
 * @param {string} text
 * @returns {string}
 */
export function desensitize(text) {
  if (!state.get('desensitize')) return text;
  const words = state.get('desensitizeWords') || [];
  if (words.length === 0) return text;

  let result = text;
  for (const word of words) {
    if (!word) continue;
    // Case-insensitive global replace
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), '***');
  }
  return result;
}
