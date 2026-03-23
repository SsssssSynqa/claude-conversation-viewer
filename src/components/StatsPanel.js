/**
 * StatsPanel — Statistics component that can render inline (homepage) or as overlay.
 */

import { state } from '../store/state.js';
import { drawLineChart, drawBarChart } from '../utils/charts.js';
import { formatMonthKey, formatMonthLabel, getHourOfDay } from '../utils/time.js';

export class StatsPanel {
  constructor() {
    this.overlay = null;
  }

  toggle() {
    if (this.overlay) {
      this.hide();
    } else {
      this.showOverlay();
    }
  }

  /**
   * Render stats inline into a container element (for homepage).
   */
  renderInline(container) {
    const conversations = state.get('conversations') || [];
    if (conversations.length === 0) return;

    const stats = this.computeStats(conversations);
    container.textContent = '';
    container.style.cssText = 'flex:1;overflow-y:auto;padding:32px 24px;';

    const inner = document.createElement('div');
    inner.style.cssText = 'max-width:800px;margin:0 auto;';

    this.buildStatsContent(inner, stats);
    container.appendChild(inner);
  }

  /**
   * Show stats as overlay popup (for toolbar button).
   */
  showOverlay() {
    const conversations = state.get('conversations') || [];
    if (conversations.length === 0) return;

    const stats = this.computeStats(conversations);

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:900;overflow-y:auto;padding:40px 20px;';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    const panel = document.createElement('div');
    panel.style.cssText = 'max-width:800px;margin:0 auto;background:var(--bg-card);border-radius:var(--radius-lg);padding:32px;box-shadow:var(--shadow);';

    this.buildStatsContent(panel, stats);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'display:block;margin:16px auto 0;padding:10px 32px;border:1px solid var(--border);border-radius:var(--radius-sm);background:transparent;color:var(--text-secondary);cursor:pointer;font-size:0.9rem;';
    closeBtn.textContent = '关闭';
    closeBtn.addEventListener('click', () => this.hide());
    panel.appendChild(closeBtn);

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);
  }

  hide() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  /**
   * Build all stats DOM into a parent element.
   */
  buildStatsContent(parent, stats) {
    const names = state.get('displayNames');

    // Title
    const title = document.createElement('h2');
    title.style.cssText = 'font-size:1.4rem;margin-bottom:24px;background:var(--gradient-header);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
    title.textContent = '对话统计';
    parent.appendChild(title);

    // Basic stats cards
    const cardsGrid = document.createElement('div');
    cardsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:32px;';

    const basicStats = [
      { label: '总对话数', value: stats.totalConversations },
      { label: '总消息数', value: stats.totalMessages.toLocaleString() },
      { label: names.human || 'Human', value: stats.totalHumanChars.toLocaleString() + ' 字' },
      { label: names.assistant || 'Assistant', value: stats.totalAssistantChars.toLocaleString() + ' 字' },
      { label: '思考次数', value: stats.totalThinkingCount.toLocaleString() },
      { label: '累计思考时间', value: this.formatMs(stats.totalThinkingMs) },
      { label: '时间跨度', value: stats.daySpan + ' 天' },
      { label: '深夜对话', value: stats.lateNightConvs + ' 段' },
    ];

    for (const s of basicStats) {
      const card = document.createElement('div');
      card.style.cssText = 'background:var(--bg-secondary);padding:16px;border-radius:var(--radius-sm);text-align:center;';

      const val = document.createElement('div');
      val.style.cssText = 'font-size:1.5rem;font-weight:700;color:var(--accent);';
      val.textContent = String(s.value);
      card.appendChild(val);

      const label = document.createElement('div');
      label.style.cssText = 'font-size:0.8rem;color:var(--text-muted);margin-top:4px;';
      label.textContent = s.label;
      card.appendChild(label);

      cardsGrid.appendChild(card);
    }
    parent.appendChild(cardsGrid);

    // Top 5 longest conversations
    const topTitle = document.createElement('h3');
    topTitle.style.cssText = 'font-size:1rem;margin-bottom:12px;color:var(--text-primary);';
    topTitle.textContent = 'TOP 5 最长对话';
    parent.appendChild(topTitle);

    const topList = document.createElement('div');
    topList.style.cssText = 'margin-bottom:32px;';

    for (let i = 0; i < Math.min(5, stats.topConversations.length); i++) {
      const conv = stats.topConversations[i];
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--separator-color);font-size:0.85rem;cursor:pointer;border-radius:var(--radius-sm);';
      item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-card-hover)');
      item.addEventListener('mouseleave', () => item.style.background = '');

      const name = document.createElement('span');
      name.style.cssText = 'color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;margin-right:12px;';
      name.textContent = (i + 1) + '. ' + (conv.name || '未命名');
      item.appendChild(name);

      const count = document.createElement('span');
      count.style.cssText = 'color:var(--text-muted);white-space:nowrap;';
      count.textContent = conv.stats.messageCount + ' 条 / ' + (conv.stats.humanChars + conv.stats.assistantChars).toLocaleString() + ' 字';
      item.appendChild(count);

      item.addEventListener('click', () => {
        const allConvs = state.get('filteredConversations') || [];
        const idx = allConvs.findIndex(c => c.uuid === conv.uuid);
        if (idx >= 0) {
          state.set('currentConversationIndex', idx);
          this.hide(); // close overlay if open
        }
      });

      topList.appendChild(item);
    }
    parent.appendChild(topList);

    // Monthly conversation chart
    if (stats.monthlyData.labels.length > 1) {
      const chartTitle1 = document.createElement('h3');
      chartTitle1.style.cssText = 'font-size:1rem;margin-bottom:12px;color:var(--text-primary);';
      chartTitle1.textContent = '每月对话频率';
      parent.appendChild(chartTitle1);

      const canvas1 = document.createElement('canvas');
      canvas1.style.cssText = 'width:100%;height:200px;margin-bottom:32px;';
      parent.appendChild(canvas1);

      requestAnimationFrame(() => {
        drawLineChart(canvas1, {
          labels: stats.monthlyData.labels,
          values: stats.monthlyData.convCounts,
        }, { title: '' });
      });

      // Monthly chars chart
      const chartTitle2 = document.createElement('h3');
      chartTitle2.style.cssText = 'font-size:1rem;margin-bottom:12px;color:var(--text-primary);';
      chartTitle2.textContent = '每月字数';
      parent.appendChild(chartTitle2);

      const canvas2 = document.createElement('canvas');
      canvas2.style.cssText = 'width:100%;height:200px;margin-bottom:16px;';
      parent.appendChild(canvas2);

      requestAnimationFrame(() => {
        drawBarChart(canvas2, {
          labels: stats.monthlyData.labels,
          series: [
            { name: names.human || 'Human', values: stats.monthlyData.humanChars, color: '#7c6eea' },
            { name: names.assistant || 'Assistant', values: stats.monthlyData.assistantChars, color: '#da7756' },
          ],
        }, { title: '' });
      });
    }

    // Hourly activity heatmap
    if (stats.hourlyActivity && stats.hourlyActivity.some(v => v > 0)) {
      const heatTitle = document.createElement('h3');
      heatTitle.style.cssText = 'font-size:1rem;margin-bottom:12px;color:var(--text-primary);';
      heatTitle.textContent = '每日活跃时段';
      parent.appendChild(heatTitle);

      const heatmap = document.createElement('div');
      heatmap.style.cssText = 'display:grid;grid-template-columns:repeat(24,1fr);gap:3px;margin-bottom:32px;';

      const maxActivity = Math.max(...stats.hourlyActivity);
      for (let h = 0; h < 24; h++) {
        const cell = document.createElement('div');
        const intensity = maxActivity > 0 ? stats.hourlyActivity[h] / maxActivity : 0;
        const alpha = Math.max(0.08, intensity * 0.8);
        cell.style.cssText = `aspect-ratio:1;border-radius:3px;background:var(--accent);opacity:${alpha};position:relative;`;
        cell.title = `${h}:00 — ${stats.hourlyActivity[h]} 条消息`;
        heatmap.appendChild(cell);
      }

      parent.appendChild(heatmap);

      // Hour labels
      const hourLabels = document.createElement('div');
      hourLabels.style.cssText = 'display:grid;grid-template-columns:repeat(24,1fr);gap:3px;margin-top:-28px;margin-bottom:32px;';
      for (let h = 0; h < 24; h++) {
        const label = document.createElement('div');
        label.style.cssText = 'text-align:center;font-size:0.6rem;color:var(--text-muted);';
        label.textContent = h % 3 === 0 ? h + '' : '';
        hourLabels.appendChild(label);
      }
      parent.appendChild(hourLabels);
    }
  }

  computeStats(conversations) {
    let totalMessages = 0;
    let totalHumanChars = 0;
    let totalAssistantChars = 0;
    let totalThinkingMs = 0;
    let totalThinkingCount = 0;
    let lateNightConvs = 0;
    const allDates = [];
    const monthlyMap = new Map();
    const hourlyActivity = new Array(24).fill(0);

    const sorted = [...conversations].sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    for (const conv of sorted) {
      totalMessages += conv.stats.messageCount;
      totalHumanChars += conv.stats.humanChars;
      totalAssistantChars += conv.stats.assistantChars;
      totalThinkingMs += conv.stats.totalThinkingMs;
      totalThinkingCount += conv.stats.thinkingCount;

      if (conv.createdAt) allDates.push(new Date(conv.createdAt));

      let hasLateNight = false;
      for (const msg of conv.messages) {
        if (msg.createdAt) {
          const hour = getHourOfDay(msg.createdAt);
          hourlyActivity[hour]++;
          if (hour >= 0 && hour < 5) { hasLateNight = true; }
        }
      }
      if (hasLateNight) lateNightConvs++;

      const mk = formatMonthKey(conv.createdAt);
      if (!monthlyMap.has(mk)) {
        monthlyMap.set(mk, { convCount: 0, humanChars: 0, assistantChars: 0 });
      }
      const m = monthlyMap.get(mk);
      m.convCount++;
      m.humanChars += conv.stats.humanChars;
      m.assistantChars += conv.stats.assistantChars;
    }

    let daySpan = 0;
    if (allDates.length >= 2) {
      const earliest = Math.min(...allDates.map(d => d.getTime()));
      const latest = Math.max(...allDates.map(d => d.getTime()));
      daySpan = Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24));
    }

    const monthKeys = [...monthlyMap.keys()].sort();
    const monthlyData = {
      labels: monthKeys.map(k => {
        const [y, m] = k.split('-');
        return `${parseInt(m)}月`;
      }),
      convCounts: monthKeys.map(k => monthlyMap.get(k).convCount),
      humanChars: monthKeys.map(k => monthlyMap.get(k).humanChars),
      assistantChars: monthKeys.map(k => monthlyMap.get(k).assistantChars),
    };

    const topConversations = [...conversations]
      .sort((a, b) => b.stats.messageCount - a.stats.messageCount)
      .slice(0, 5);

    return {
      totalConversations: conversations.length,
      totalMessages,
      totalHumanChars,
      totalAssistantChars,
      totalThinkingMs,
      totalThinkingCount,
      daySpan,
      lateNightConvs,
      topConversations,
      monthlyData,
      hourlyActivity,
    };
  }

  formatMs(ms) {
    if (ms < 1000) return ms + 'ms';
    const seconds = ms / 1000;
    if (seconds < 60) return seconds.toFixed(1) + 's';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + '分' + Math.floor(seconds % 60) + '秒';
    const hours = Math.floor(minutes / 60);
    return hours + '小时' + (minutes % 60) + '分';
  }
}
