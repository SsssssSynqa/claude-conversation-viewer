/**
 * MessageView — Right panel showing messages for selected conversation.
 * Handles all 6 content types with proper rendering.
 * All HTML content is sanitized through DOMPurify before DOM insertion.
 */

import { state } from '../store/state.js';
import { renderMarkdown, escapeHtml } from '../utils/markdown.js';
import { formatTimestamp, formatShortTime, getTimeDiffMinutes } from '../utils/time.js';

export class MessageView {
  constructor(container) {
    this.container = container;
    this.render();
    state.on('currentConversationIndex', () => this.renderConversation());
    state.on('showThinking', () => this.renderConversation());
    state.on('showToolUse', () => this.renderConversation());
    state.on('showFlags', () => this.renderConversation());
  }

  render() {
    this.container.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;';
    this.renderEmpty();
  }

  renderEmpty() {
    this.container.textContent = '';
    const empty = document.createElement('div');
    empty.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:1.1rem;';
    empty.textContent = '\u2190 选择一段对话开始阅读';
    this.container.appendChild(empty);
  }

  renderConversation() {
    const index = state.get('currentConversationIndex');
    const conversations = state.get('filteredConversations') || [];
    if (index < 0 || index >= conversations.length) {
      this.renderEmpty();
      return;
    }

    const conv = conversations[index];
    const names = state.get('displayNames');
    const showThinking = state.get('showThinking');
    const showToolUse = state.get('showToolUse');
    const showFlags = state.get('showFlags');

    this.container.textContent = '';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding:16px 24px;border-bottom:1px solid var(--border);flex-shrink:0;';

    const titleEl = document.createElement('h2');
    titleEl.style.cssText = 'font-size:1.2rem;font-weight:600;margin-bottom:4px;';
    titleEl.textContent = conv.name || '未命名对话';
    header.appendChild(titleEl);

    const metaEl = document.createElement('div');
    metaEl.style.cssText = 'font-size:0.8rem;color:var(--text-muted);display:flex;gap:16px;flex-wrap:wrap;';

    const stats = [
      conv.stats.messageCount + ' 条消息',
      (names.human || 'Human') + ': ' + conv.stats.humanChars.toLocaleString() + ' 字',
      (names.assistant || 'Assistant') + ': ' + conv.stats.assistantChars.toLocaleString() + ' 字',
    ];
    if (conv.stats.hasThinking) {
      stats.push('\uD83D\uDCAD ' + conv.stats.thinkingCount + ' 次思考');
    }
    for (const s of stats) {
      const span = document.createElement('span');
      span.textContent = s;
      metaEl.appendChild(span);
    }
    header.appendChild(metaEl);
    this.container.appendChild(header);

    // Messages scroll container
    const scrollContainer = document.createElement('div');
    scrollContainer.style.cssText = 'flex:1;overflow-y:auto;padding:16px 0;';

    let prevTimestamp = null;

    for (const msg of conv.messages) {
      // Time separator
      if (prevTimestamp && msg.createdAt) {
        const diffMinutes = getTimeDiffMinutes(prevTimestamp, msg.createdAt);
        if (diffMinutes > 60) {
          const sep = document.createElement('div');
          sep.style.cssText = 'text-align:center;padding:16px 0;color:var(--text-muted);font-size:0.8rem;';
          const hours = Math.floor(diffMinutes / 60);
          let timeText = '';
          if (hours > 24) timeText = Math.floor(hours / 24) + ' 天后';
          else timeText = hours + ' 小时后';
          sep.textContent = '\u2014 ' + timeText + ' \u2014';
          scrollContainer.appendChild(sep);
        }
      }
      prevTimestamp = msg.createdAt;

      // Message block
      const msgEl = document.createElement('div');
      const isHuman = msg.sender === 'human';
      msgEl.style.cssText = 'padding:16px 24px;background:' + (isHuman ? 'var(--message-human-bg)' : 'var(--message-assistant-bg)') + ';border-bottom:1px solid var(--separator-color);';

      // Message header
      const msgHeader = document.createElement('div');
      msgHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';

      const senderEl = document.createElement('span');
      senderEl.style.cssText = 'font-weight:600;font-size:0.9rem;color:' + (isHuman ? 'var(--accent)' : 'var(--text-primary)') + ';';
      senderEl.textContent = isHuman ? (names.human || 'Human') : (names.assistant || 'Assistant');
      msgHeader.appendChild(senderEl);

      const timeEl = document.createElement('span');
      timeEl.style.cssText = 'font-size:0.75rem;color:var(--text-muted);';
      timeEl.textContent = formatTimestamp(msg.createdAt);
      msgHeader.appendChild(timeEl);

      msgEl.appendChild(msgHeader);

      // File attachments
      if (msg.files.length > 0) {
        const filesEl = document.createElement('div');
        filesEl.style.cssText = 'margin-bottom:8px;display:flex;gap:8px;flex-wrap:wrap;';
        for (const fileName of msg.files) {
          const fileTag = document.createElement('span');
          fileTag.className = 'badge badge-tool';
          fileTag.textContent = '\uD83D\uDCCE ' + fileName;
          filesEl.appendChild(fileTag);
        }
        msgEl.appendChild(filesEl);
      }

      // Content blocks
      for (const block of msg.contentBlocks) {
        switch (block.type) {
          case 'text':
            this.renderTextBlock(msgEl, block);
            break;
          case 'thinking':
            if (showThinking) this.renderThinkingBlock(msgEl, block);
            break;
          case 'tool_use':
            if (showToolUse) this.renderToolBlock(msgEl, block);
            break;
          case 'tool_result':
            if (showToolUse) this.renderToolResultBlock(msgEl, block);
            break;
          case 'flag':
            if (showFlags) this.renderFlagBlock(msgEl, block);
            break;
          case 'token_budget':
            break;
        }
      }

      scrollContainer.appendChild(msgEl);
    }

    this.container.appendChild(scrollContainer);
  }

  renderTextBlock(parent, block) {
    const div = document.createElement('div');
    div.className = 'message-text';
    div.style.cssText = 'line-height:1.7;word-break:break-word;';
    // renderMarkdown() already sanitizes through DOMPurify
    const safeHtml = renderMarkdown(block.text);
    const template = document.createElement('template');
    template.innerHTML = safeHtml;
    div.appendChild(template.content);
    parent.appendChild(div);
  }

  renderThinkingBlock(parent, block) {
    const details = document.createElement('details');
    details.style.cssText = 'margin:8px 0;background:var(--thinking-bg);border:1px solid var(--thinking-border);border-radius:var(--radius-sm);overflow:hidden;';

    const summary = document.createElement('summary');
    summary.style.cssText = 'padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--thinking-text);user-select:none;';
    summary.appendChild(document.createTextNode('\uD83D\uDCAD '));

    const label = document.createElement('span');
    label.style.fontWeight = '600';
    label.textContent = '思考过程';
    summary.appendChild(label);

    if (block.durationText) {
      const dur = document.createElement('span');
      dur.className = 'badge badge-thinking';
      dur.textContent = block.durationText;
      summary.appendChild(dur);
    }

    if (block.summaries && block.summaries.length > 0) {
      const summaryText = document.createElement('span');
      summaryText.style.cssText = 'color:var(--text-muted);font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;';
      summaryText.textContent = '\u2014 ' + block.summaries[0];
      summary.appendChild(summaryText);
    }

    details.appendChild(summary);

    const content = document.createElement('div');
    content.style.cssText = 'padding:12px 16px;font-size:0.85rem;line-height:1.6;color:var(--text-secondary);white-space:pre-wrap;word-break:break-word;max-height:400px;overflow-y:auto;';
    content.textContent = block.thinking; // textContent: safe, no XSS
    details.appendChild(content);

    parent.appendChild(details);
  }

  renderToolBlock(parent, block) {
    const details = document.createElement('details');
    details.style.cssText = 'margin:8px 0;background:var(--tool-bg);border:1px solid var(--tool-border);border-radius:var(--radius-sm);overflow:hidden;';

    const summary = document.createElement('summary');
    summary.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:0.85rem;color:var(--text-secondary);user-select:none;';
    summary.textContent = '\uD83D\uDD27 ' + (block.toolName || 'Tool');
    details.appendChild(summary);

    const content = document.createElement('div');
    content.style.cssText = 'padding:12px 16px;font-size:0.8rem;';

    if (block.toolInput && Object.keys(block.toolInput).length > 0) {
      const inputLabel = document.createElement('div');
      inputLabel.style.cssText = 'font-weight:600;margin-bottom:4px;color:var(--text-muted);';
      inputLabel.textContent = 'Input:';
      content.appendChild(inputLabel);

      const inputPre = document.createElement('pre');
      inputPre.style.cssText = 'background:var(--code-bg);padding:8px;border-radius:4px;overflow-x:auto;font-family:var(--font-mono);font-size:0.8rem;color:var(--text-secondary);';
      inputPre.textContent = JSON.stringify(block.toolInput, null, 2);
      content.appendChild(inputPre);
    }

    if (block.result) {
      const resultLabel = document.createElement('div');
      resultLabel.style.cssText = 'font-weight:600;margin:8px 0 4px;color:var(--text-muted);';
      resultLabel.textContent = 'Result:';
      content.appendChild(resultLabel);

      const resultPre = document.createElement('pre');
      resultPre.style.cssText = 'background:var(--code-bg);padding:8px;border-radius:4px;overflow-x:auto;font-family:var(--font-mono);font-size:0.8rem;color:var(--text-secondary);max-height:200px;overflow-y:auto;';
      resultPre.textContent = typeof block.result === 'string' ? block.result : JSON.stringify(block.result, null, 2);
      content.appendChild(resultPre);
    }

    details.appendChild(content);
    parent.appendChild(details);
  }

  renderToolResultBlock(parent, block) {
    const div = document.createElement('div');
    div.style.cssText = 'margin:8px 0;background:var(--tool-bg);border:1px solid var(--tool-border);border-radius:var(--radius-sm);padding:12px 16px;';

    const label = document.createElement('div');
    label.style.cssText = 'font-size:0.8rem;font-weight:600;color:var(--text-muted);margin-bottom:4px;';
    label.textContent = '\uD83D\uDD27 Tool Result';
    div.appendChild(label);

    const pre = document.createElement('pre');
    pre.style.cssText = 'background:var(--code-bg);padding:8px;border-radius:4px;font-family:var(--font-mono);font-size:0.8rem;color:var(--text-secondary);max-height:200px;overflow:auto;';
    pre.textContent = typeof block.result === 'string' ? block.result : JSON.stringify(block.result, null, 2);
    div.appendChild(pre);

    parent.appendChild(div);
  }

  renderFlagBlock(parent, block) {
    const div = document.createElement('div');
    div.style.cssText = 'margin:8px 0;background:var(--flag-bg);border:1px solid var(--flag-border);border-radius:var(--radius-sm);padding:8px 12px;display:flex;align-items:center;gap:8px;';

    const badge = document.createElement('span');
    badge.className = 'badge badge-flag';
    badge.textContent = '\u26A0\uFE0F ' + (block.flagType || 'flag');
    div.appendChild(badge);

    if (block.helpline) {
      const helpText = document.createElement('span');
      helpText.style.cssText = 'font-size:0.8rem;color:var(--text-muted);';
      helpText.textContent = block.helpline.name || '';
      div.appendChild(helpText);
    }

    parent.appendChild(div);
  }
}
