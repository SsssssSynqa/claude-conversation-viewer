/**
 * Export utilities — TXT, Markdown, HTML formats.
 * All formats properly handle thinking blocks via item.thinking field.
 */

/**
 * Export conversations as plain text.
 */
export function exportAsText(conversations, options = {}) {
  const { includeThinking = true, includeToolUse = false, includeFlags = false, displayNames = {} } = options;
  const humanName = displayNames.human || 'Human';
  const assistantName = displayNames.assistant || 'Assistant';
  let output = '';

  for (const conv of conversations) {
    output += '='.repeat(60) + '\n';
    output += (conv.name || '未命名对话') + '\n';
    output += formatDateLine(conv.createdAt) + '\n';
    output += conv.stats.messageCount + ' 条消息\n';
    output += '='.repeat(60) + '\n\n';

    for (const msg of conv.messages) {
      const sender = msg.sender === 'human' ? humanName : assistantName;
      const time = formatExportTime(msg.createdAt);
      output += `[${sender}] ${time}\n`;

      for (const block of msg.contentBlocks) {
        switch (block.type) {
          case 'text':
            output += block.text + '\n';
            break;
          case 'thinking':
            if (includeThinking && block.thinking) {
              output += '\n--- 思考过程' + (block.durationText ? ` (${block.durationText})` : '') + ' ---\n';
              output += block.thinking + '\n';
              output += '--- 思考结束 ---\n';
            }
            break;
          case 'tool_use':
            if (includeToolUse) {
              output += `\n[工具调用: ${block.toolName}]\n`;
              if (block.toolInput && Object.keys(block.toolInput).length > 0) {
                output += 'Input: ' + JSON.stringify(block.toolInput) + '\n';
              }
              if (block.result) {
                output += 'Result: ' + (typeof block.result === 'string' ? block.result : JSON.stringify(block.result)) + '\n';
              }
            }
            break;
          case 'flag':
            if (includeFlags) {
              output += `\n[系统标记: ${block.flagType}]\n`;
            }
            break;
        }
      }

      if (msg.files.length > 0) {
        output += '附件: ' + msg.files.join(', ') + '\n';
      }

      output += '\n---\n\n';
    }
  }

  return output;
}

/**
 * Export conversations as Markdown.
 */
export function exportAsMarkdown(conversations, options = {}) {
  const { includeThinking = true, includeToolUse = false, includeFlags = false, displayNames = {} } = options;
  const humanName = displayNames.human || 'Human';
  const assistantName = displayNames.assistant || 'Assistant';
  let output = '';

  for (const conv of conversations) {
    output += `# ${conv.name || '未命名对话'}\n\n`;
    output += `*${formatDateLine(conv.createdAt)} \u2014 ${conv.stats.messageCount} 条消息*\n\n`;

    for (const msg of conv.messages) {
      const sender = msg.sender === 'human' ? humanName : assistantName;
      const time = formatExportTime(msg.createdAt);
      output += `## ${sender} (${time})\n\n`;

      for (const block of msg.contentBlocks) {
        switch (block.type) {
          case 'text':
            output += block.text + '\n\n';
            break;
          case 'thinking':
            if (includeThinking && block.thinking) {
              const dur = block.durationText ? ` (${block.durationText})` : '';
              output += `> \uD83D\uDCAD **思考过程**${dur}\n>\n`;
              const lines = block.thinking.split('\n');
              for (const line of lines) {
                output += `> ${line}\n`;
              }
              output += '\n';
            }
            break;
          case 'tool_use':
            if (includeToolUse) {
              output += `> \uD83D\uDD27 **工具: ${block.toolName}**\n>\n`;
              if (block.toolInput && Object.keys(block.toolInput).length > 0) {
                output += `> Input: \`${JSON.stringify(block.toolInput)}\`\n`;
              }
              if (block.result) {
                const resultStr = typeof block.result === 'string' ? block.result : JSON.stringify(block.result);
                output += `>\n> Result: ${resultStr.substring(0, 500)}${resultStr.length > 500 ? '...' : ''}\n`;
              }
              output += '\n';
            }
            break;
          case 'flag':
            if (includeFlags) {
              output += `> \u26A0\uFE0F **系统标记: ${block.flagType}**\n\n`;
            }
            break;
        }
      }

      if (msg.files.length > 0) {
        output += '\uD83D\uDCCE 附件: ' + msg.files.join(', ') + '\n\n';
      }

      output += '---\n\n';
    }
  }

  return output;
}

/**
 * Export as standalone HTML with theme styling.
 */
export function exportAsHTML(conversations, options = {}) {
  const { includeThinking = true, includeToolUse = false, includeFlags = false, displayNames = {} } = options;
  const humanName = escapeForAttr(displayNames.human || 'Human');
  const assistantName = escapeForAttr(displayNames.assistant || 'Assistant');

  let body = '';
  for (const conv of conversations) {
    body += '<div class="conv">';
    body += '<h1>' + escapeForHtml(conv.name || '未命名对话') + '</h1>';
    body += '<p class="meta">' + escapeForHtml(formatDateLine(conv.createdAt)) + ' \u2014 ' + conv.stats.messageCount + ' 条消息</p>';

    for (const msg of conv.messages) {
      const sender = msg.sender === 'human' ? humanName : assistantName;
      const isHuman = msg.sender === 'human';
      body += '<div class="msg ' + (isHuman ? 'human' : 'assistant') + '">';
      body += '<div class="msg-header"><strong>' + sender + '</strong><span>' + escapeForHtml(formatExportTime(msg.createdAt)) + '</span></div>';

      for (const block of msg.contentBlocks) {
        if (block.type === 'text') {
          body += '<div class="msg-text">' + escapeForHtml(block.text).replace(/\n/g, '<br>') + '</div>';
        } else if (block.type === 'thinking' && includeThinking && block.thinking) {
          body += '<details class="thinking"><summary>\uD83D\uDCAD 思考过程' + (block.durationText ? ' (' + escapeForHtml(block.durationText) + ')' : '') + '</summary>';
          body += '<pre>' + escapeForHtml(block.thinking) + '</pre></details>';
        } else if (block.type === 'tool_use' && includeToolUse) {
          body += '<details class="tool"><summary>\uD83D\uDD27 ' + escapeForHtml(block.toolName) + '</summary>';
          body += '<pre>' + escapeForHtml(JSON.stringify(block.toolInput, null, 2)) + '</pre>';
          if (block.result) body += '<pre>' + escapeForHtml(typeof block.result === 'string' ? block.result : JSON.stringify(block.result, null, 2)) + '</pre>';
          body += '</details>';
        } else if (block.type === 'flag' && includeFlags) {
          body += '<div class="flag">\u26A0\uFE0F ' + escapeForHtml(block.flagType) + '</div>';
        }
      }
      body += '</div>';
    }
    body += '</div>';
  }

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Claude 对话导出</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafaf8;color:#2d2d2d;padding:24px;max-width:900px;margin:0 auto;line-height:1.6}
.conv{margin-bottom:48px}
h1{font-size:1.4rem;margin-bottom:4px}
.meta{color:#999;font-size:0.85rem;margin-bottom:16px}
.msg{padding:16px;border-bottom:1px solid #eee;margin-bottom:8px}
.msg.human{background:#f5f0ff}
.msg-header{display:flex;justify-content:space-between;margin-bottom:8px;font-size:0.85rem}
.msg-header strong{color:#7c5cbf}
.msg.assistant .msg-header strong{color:#2d2d2d}
.msg-header span{color:#999}
.msg-text{white-space:pre-wrap;word-break:break-word}
.thinking{margin:8px 0;background:#fff8e1;border:1px solid #ffe082;border-radius:8px;overflow:hidden}
.thinking summary{padding:8px 12px;cursor:pointer;color:#e65100;font-size:0.85rem}
.thinking pre{padding:12px;font-size:0.8rem;white-space:pre-wrap;color:#666;max-height:300px;overflow-y:auto}
.tool{margin:8px 0;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:8px;overflow:hidden}
.tool summary{padding:8px 12px;cursor:pointer;font-size:0.85rem}
.tool pre{padding:12px;font-size:0.8rem;white-space:pre-wrap;color:#666;max-height:200px;overflow-y:auto}
.flag{margin:8px 0;background:#ffebee;border:1px solid #ef9a9a;border-radius:8px;padding:8px 12px;font-size:0.85rem;color:#c62828}
</style></head><body>${body}</body></html>`;
}

function formatDateLine(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return ''; }
}

function formatExportTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('zh-CN');
  } catch { return ''; }
}

function escapeForHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeForAttr(str) {
  return escapeForHtml(str);
}

/**
 * Download content as a file.
 */
export function downloadFile(content, filename, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
