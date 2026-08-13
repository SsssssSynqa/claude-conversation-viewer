/**
 * Claude conversation JSON parser.
 * Handles all 6 content types: text, thinking, tool_use, tool_result, token_budget, flag.
 * CRITICAL: thinking content is in item.thinking, NOT item.text.
 */

import { formatDuration } from '../utils/time.js';

/**
 * Parse a single raw conversation object from Claude export JSON.
 */
export function parseConversation(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const messages = parseMessages(raw.chat_messages || []);
  if (messages.length === 0) return null;

  let humanChars = 0;
  let assistantChars = 0;
  let hasThinking = false;
  let hasFlags = false;
  let hasTools = false;
  let totalThinkingMs = 0;
  let thinkingCount = 0;

  for (const msg of messages) {
    for (const block of msg.contentBlocks) {
      if (block.type === 'text') {
        if (msg.sender === 'human') humanChars += block.text.length;
        else assistantChars += block.text.length;
      } else if (block.type === 'thinking') {
        hasThinking = true;
        thinkingCount++;
        if (block.durationMs > 0) totalThinkingMs += block.durationMs;
      } else if (block.type === 'flag') {
        hasFlags = true;
      } else if (block.type === 'tool_use' || block.type === 'tool_result') {
        hasTools = true;
      }
    }
  }

  return {
    uuid: raw.uuid || '',
    name: raw.name || '',
    summary: raw.summary || '',
    createdAt: raw.created_at || '',
    updatedAt: raw.updated_at || '',
    messages,
    stats: {
      messageCount: messages.length,
      humanChars,
      assistantChars,
      hasThinking,
      hasFlags,
      hasTools,
      totalThinkingMs,
      thinkingCount,
    },
  };
}

/**
 * Parse chat_messages array into structured messages.
 * Handles tool_use/tool_result pairing across messages.
 */
function parseMessages(chatMessages) {
  if (!Array.isArray(chatMessages) || chatMessages.length === 0) return [];

  const messages = [];
  let pendingToolUses = [];

  for (const raw of chatMessages) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const sender = typeof raw.sender === 'string' ? raw.sender : 'unknown';
    const contentItems = Array.isArray(raw.content) ? raw.content : [];
    const contentBlocks = [];
    let searchTextParts = [];

    for (const item of contentItems) {
      if (!item || typeof item !== 'object') continue;

      switch (item.type) {
        case 'text': {
          const text = typeof item.text === 'string' ? item.text.trim() : '';
          if (text) {
            contentBlocks.push({ type: 'text', text });
            searchTextParts.push(text);
          }
          break;
        }

        case 'thinking': {
          // CRITICAL: field is item.thinking, NOT item.text
          const thinking = typeof item.thinking === 'string' ? item.thinking.trim() : '';
          if (thinking) {
            const startTs = item.start_timestamp || '';
            const stopTs = item.stop_timestamp || '';
            let durationMs = 0;
            if (startTs && stopTs) {
              durationMs = new Date(stopTs) - new Date(startTs);
              if (isNaN(durationMs) || durationMs < 0) durationMs = 0;
            }
            const summaries = Array.isArray(item.summaries)
              ? item.summaries.map(s => (s && typeof s.summary === 'string') ? s.summary : '').filter(Boolean)
              : [];
            contentBlocks.push({
              type: 'thinking',
              thinking,
              summaries,
              durationMs,
              durationText: formatDuration(startTs, stopTs),
              cutOff: item.cut_off || false,
              truncated: item.truncated || false,
            });
            searchTextParts.push(thinking);
          }
          break;
        }

        case 'tool_use': {
          const toolBlock = {
            type: 'tool_use',
            toolName: item.name || 'unknown',
            toolInput: item.input || {},
            toolMessage: item.message || '',
            result: null, // will be paired later
          };
          contentBlocks.push(toolBlock);
          pendingToolUses.push(toolBlock);
          searchTextParts.push(item.name || '');
          searchTextParts.push(item.message || '');
          if (item.input && typeof item.input === 'object') {
            searchTextParts.push(JSON.stringify(item.input));
          }
          break;
        }

        case 'tool_result': {
          const resultText = extractToolResult(item);
          // Pair with pending tool_use
          const paired = pendingToolUses.shift();
          if (paired) {
            paired.result = resultText;
          } else {
            // Unpaired tool_result — show standalone
            contentBlocks.push({
              type: 'tool_result',
              result: resultText,
            });
          }
          if (resultText) searchTextParts.push(resultText);
          break;
        }

        case 'token_budget': {
          contentBlocks.push({ type: 'token_budget' });
          break;
        }

        case 'flag': {
          contentBlocks.push({
            type: 'flag',
            flagType: item.flag || 'unknown',
            helpline: item.helpline || null,
          });
          searchTextParts.push(item.flag || '');
          searchTextParts.push(item.helpline || '');
          break;
        }

        default:
          // Unknown type — ignore silently
          break;
      }
    }

    // Also check raw.text as fallback (some messages use this)
    if (contentBlocks.length === 0 && typeof raw.text === 'string') {
      const text = raw.text.trim();
      if (text) {
        contentBlocks.push({ type: 'text', text });
        searchTextParts.push(text);
      }
    }

    if (contentBlocks.length === 0) continue;

    // File attachments
    const files = [];
    if (Array.isArray(raw.files)) {
      for (const f of raw.files) {
        if (f && typeof f.file_name === 'string') files.push(f.file_name);
      }
    }
    if (Array.isArray(raw.attachments)) {
      for (const a of raw.attachments) {
        if (a && typeof a.file_name === 'string') files.push(a.file_name);
      }
    }

    messages.push({
      uuid: raw.uuid || `msg_${messages.length}`,
      sender,
      createdAt: raw.created_at || raw.updated_at || '',
      contentBlocks,
      files,
      searchText: searchTextParts.join(' ').toLowerCase(),
    });
  }

  return messages;
}

function extractToolResult(item) {
  // tool_result can have various formats
  if (item.content && typeof item.content === 'string') return item.content;
  if (item.content && Array.isArray(item.content)) {
    return item.content.map(c => {
      if (typeof c === 'string') return c;
      if (c && c.text) return c.text;
      return JSON.stringify(c);
    }).join('\n');
  }
  if (typeof item.text === 'string') return item.text;
  if (typeof item.output === 'string') return item.output;
  if (item.output != null) return JSON.stringify(item.output);
  return '';
}
