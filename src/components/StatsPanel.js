/**
 * StatsPanel — Rich statistics dashboard with charts, rankings, and fun data.
 */

import { state, resetSidebarFilter } from '../store/state.js';
import { drawAreaComparisonChart, drawLineChart } from '../utils/charts.js';
import { formatMonthKey, formatMonthLabel, formatTimestamp, formatLocalDateStamp, getHourOfDay } from '../utils/time.js';
import html2canvas from 'html2canvas';
import { desensitize } from '../utils/desensitize.js';
import { createIcon } from '../utils/icons.js';
import { t } from '../i18n.js';

export class StatsPanel {
  constructor() {
    this.overlay = null;
  }

  toggle() {
    if (this.overlay) this.hide();
    else this.showOverlay();
  }

  renderInline(container) {
    const conversations = state.get('conversations') || [];
    if (conversations.length === 0) return;
    const stats = this.computeStats(conversations);
    container.textContent = '';
    container.classList.remove('content-shell');
    container.classList.add('content-area', 'stats-panel-shell');
    container.style.cssText = 'flex:1;overflow-y:auto;padding:32px 24px;';
    const inner = document.createElement('div');
    inner.className = 'stats-panel-inner';
    inner.style.cssText = 'max-width:920px;margin:0 auto;';
    this.buildStatsContent(inner, stats, conversations);
    container.appendChild(inner);
  }

  showOverlay() {
    const conversations = state.get('conversations') || [];
    if (conversations.length === 0) return;
    const stats = this.computeStats(conversations);
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:900;overflow-y:auto;padding:40px 20px;';
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.hide(); });
    const panel = document.createElement('div');
    panel.className = 'stats-panel-overlay';
    panel.style.cssText = 'max-width:860px;margin:0 auto;background:var(--bg-card);border-radius:var(--radius-lg);padding:32px;box-shadow:var(--shadow);';
    this.buildStatsContent(panel, stats, conversations);
    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);
  }

  hide() {
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
  }

  buildStatsContent(parent, stats, conversations) {
    const names = state.get('displayNames');

    // Title row with screenshot button
    const titleRow = document.createElement('div');
    titleRow.className = 'stats-title-row';

    const title = document.createElement('h2');
    title.className = 'stats-title';
    const mainDot = document.createElement('span');
    mainDot.className = 'stats-title-mark';
    title.appendChild(mainDot);
    title.appendChild(document.createTextNode(t('stats.title')));
    titleRow.appendChild(title);

    const screenshotBtn = document.createElement('button');
    screenshotBtn.type = 'button';
    screenshotBtn.className = 'stats-screenshot-btn';
    screenshotBtn.appendChild(createIcon('save', 14));
    screenshotBtn.appendChild(document.createTextNode(t('stats.saveImage')));
    screenshotBtn.addEventListener('click', async () => {
      screenshotBtn.textContent = t('stats.saving');
      screenshotBtn.disabled = true;
      try {
        const canvas = await html2canvas(parent, {
          backgroundColor: getComputedStyle(document.body).backgroundColor,
          scale: 2,
          useCORS: true,
        });
        const link = document.createElement('a');
        link.download = t('stats.title') + '_' + formatLocalDateStamp() + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        screenshotBtn.textContent = t('stats.imageSaved');
        setTimeout(() => { screenshotBtn.textContent = ''; screenshotBtn.appendChild(createIcon('save', 14)); screenshotBtn.appendChild(document.createTextNode(t('stats.saveImage'))); screenshotBtn.disabled = false; }, 1500);
      } catch (e) {
        screenshotBtn.textContent = '截图失败';
        setTimeout(() => { screenshotBtn.textContent = ''; screenshotBtn.appendChild(createIcon('save', 14)); screenshotBtn.appendChild(document.createTextNode(t('stats.saveImage'))); screenshotBtn.disabled = false; }, 1500);
      }
    });
    titleRow.appendChild(screenshotBtn);

    parent.appendChild(titleRow);

    // ---- Basic Stats Cards (floating directly on background, no outer wrapper) ----
    const cardsGrid = document.createElement('div');
    cardsGrid.className = 'stats-card-grid';

    // Row 1: 4 basic counts (matching Figma layout)
    const row1Stats = [
      { label: t('stats.totalConvs'), value: stats.totalConversations },
      { label: t('stats.totalMsgs'), value: stats.totalMessages.toLocaleString() },
      { label: t('stats.thinkingCount'), value: stats.totalThinkingCount.toLocaleString() },
      { label: t('stats.thinkingTime'), value: this.formatMs(stats.totalThinkingMs) },
    ];

    row1Stats.forEach((s, index) => {
      const card = this._neuCard();
      card.classList.add('stats-metric-card', 'stats-primary-metric', `stats-primary-metric-${index + 1}`);
      const label = document.createElement('div');
      label.className = 'stats-card-label';
      label.textContent = s.label;
      card.appendChild(label);
      const val = document.createElement('div');
      val.className = 'stats-card-value';
      val.textContent = String(s.value);
      card.appendChild(val);
      cardsGrid.appendChild(card);
    });

    // Row 2: 2 wider word count cards with percentage rings (span 2 cols each)
    const totalChars = stats.totalAssistantChars + stats.totalHumanChars;
    const assistantPct = totalChars > 0 ? Math.round((stats.totalAssistantChars / totalChars) * 100) : 0;
    const humanPct = totalChars > 0 ? Math.round((stats.totalHumanChars / totalChars) * 100) : 0;

    const wordCountCards = [
      { label: (names.human || 'Human') + t('stats.wordCount'), value: stats.totalHumanChars.toLocaleString(), pct: humanPct, color: 'orange' },
      { label: (names.assistant || 'Assistant') + t('stats.wordCount'), value: stats.totalAssistantChars.toLocaleString(), pct: assistantPct, color: 'gray' },
    ];

    for (const s of wordCountCards) {
      const card = this._neuCard();
      card.classList.add('stats-word-card');

      const textDiv = document.createElement('div');
      textDiv.className = 'stats-word-copy';
      const label = document.createElement('div');
      label.className = 'stats-card-label';
      label.textContent = s.label;
      textDiv.appendChild(label);
      const val = document.createElement('div');
      val.className = 'stats-card-value';
      val.textContent = s.value;
      textDiv.appendChild(val);
      card.appendChild(textDiv);

      // Neumorphic ring chart — dark/light variants follow the reference proportions
      const isDark = document.documentElement.dataset.theme === 'dark';
      const ringSize = isDark ? 150 : 140;
      const ringWrap = document.createElement('div');
      ringWrap.className = 'stats-ring';
      const grooveInset = isDark
        ? 'inset 6px 6px 12px rgba(0,0,0,0.42), inset -4px -4px 8px rgba(255,255,255,0.02)'
        : 'inset 5px 5px 10px rgba(163,177,198,0.28), inset -5px -5px 10px rgba(255,255,255,0.8)';
      ringWrap.style.cssText = `position:relative;width:${ringSize}px;height:${ringSize}px;border-radius:50%;flex-shrink:0;`
        + `background:var(--bg-primary);box-shadow:${grooveInset};`
        + 'display:flex;justify-content:center;align-items:center;overflow:visible;';

      const uid = 'ring-' + s.pct + '-' + Math.random().toString(36).slice(2, 6);
      const ringSvg = document.createElement('div');
      const r = isDark ? 60 : 56;
      const strokeW = isDark ? 20 : 20;
      const circ = 2 * Math.PI * r;
      const dashOffset = circ * (1 - (s.pct / 100));
      const isOrange = s.color === 'orange';
      const cStart = isOrange ? '#ea9d85' : '#b8c6d4';
      const cEnd = isOrange ? '#d97657' : '#7a899c';
      const hiColor = isOrange
        ? (isDark ? 'rgba(255, 180, 140, 0.45)' : 'rgba(255, 180, 140, 0.55)')
        : (isDark ? 'rgba(190, 210, 230, 0.5)' : 'rgba(190, 210, 230, 0.7)');
      const cx = ringSize / 2;

      ringSvg.innerHTML = `<svg viewBox="0 0 ${ringSize} ${ringSize}" style="position:absolute;width:${ringSize}px;height:${ringSize}px;transform:rotate(-90deg);overflow:visible;">
        <defs>
          <filter id="glow-${uid}" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="${isDark ? '2.8' : '2.5'}" />
          </filter>
          <filter id="shadow-${uid}" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="${isDark ? '4.5' : '3.5'}" />
          </filter>
          <linearGradient id="g-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${cStart}"/>
            <stop offset="100%" stop-color="${cEnd}"/>
          </linearGradient>
        </defs>
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none"
          stroke="rgba(0,0,0,${isDark ? '0.8' : '0.12'})" stroke-width="${strokeW}" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${dashOffset}" filter="url(#shadow-${uid})"
          transform="translate(${isDark ? '2' : '1.5'},${isDark ? '3' : '2.5'})"/>
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none"
          stroke="url(#g-${uid})" stroke-width="${strokeW}" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${dashOffset}"/>
        <circle cx="${cx}" cy="${cx}" r="${r - 0.5}" fill="none"
          stroke="${hiColor}" stroke-width="${isDark ? '7' : '9'}" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${dashOffset}" filter="url(#glow-${uid})"
          transform="translate(${isDark ? '-1.5' : '-1.2'},${isDark ? '-1.5' : '-1.2'})" opacity="${isDark ? '0.5' : '0.65'}"/>
      </svg>`;
      ringWrap.appendChild(ringSvg.firstElementChild);

      // Center hole
      const holeSize = isDark ? 90 : 92;
      const holeShadow = isDark
        ? '12px 12px 24px rgba(0,0,0,0.5), -12px -12px 24px rgba(255,255,255,0.03)'
        : '9px 9px 16px rgba(163,177,198,0.5), -9px -9px 16px rgba(255,255,255,0.7)';
      const hole = document.createElement('div');
      hole.className = 'stats-ring-hole';
      hole.style.cssText = `width:${holeSize}px;height:${holeSize}px;border-radius:50%;background:var(--bg-primary);`
        + `box-shadow:${holeShadow};display:flex;justify-content:center;align-items:center;z-index:10;`;
      hole.innerHTML = `<span style="font-size:${isDark ? '20' : '18'}px;font-weight:700;color:${cEnd};${isDark ? 'text-shadow:2px 2px 4px rgba(0,0,0,0.5);' : 'text-shadow:1px 1px 1px rgba(255,255,255,0.8);'}">${s.pct}%</span>`;
      ringWrap.appendChild(hole);
      card.appendChild(ringWrap);

      cardsGrid.appendChild(card);
    }

    // Row 3: 4 more stats
    const row3Stats = [
      { label: t('stats.timeSpan'), value: stats.daySpan },
      { label: t('stats.longestStreak'), value: stats.longestStreak },
      { label: t('stats.flagCount'), value: stats.totalFlags },
      { label: t('stats.lateNight'), value: stats.lateNightConvs },
    ];

    for (const s of row3Stats) {
      const card = this._neuCard();
      card.classList.add('stats-metric-card', 'stats-secondary-metric');
      const label = document.createElement('div');
      label.className = 'stats-card-label';
      label.textContent = s.label;
      card.appendChild(label);
      const val = document.createElement('div');
      val.className = 'stats-card-value';
      val.textContent = String(s.value);
      card.appendChild(val);
      cardsGrid.appendChild(card);
    }

    parent.appendChild(cardsGrid);

    // ---- First & Last Conversation (cards float directly) ----
    if (stats.firstConv && stats.lastConv) {
      const milestoneRow = document.createElement('div');
      milestoneRow.className = 'stats-milestone-grid';

      milestoneRow.appendChild(this._milestoneCard(t('stats.firstConv'), stats.firstConv.name || '未命名', formatTimestamp(stats.firstConv.createdAt)));
      milestoneRow.appendChild(this._milestoneCard(t('stats.latestConv'), stats.lastConv.name || '未命名', formatTimestamp(stats.lastConv.createdAt)));

      parent.appendChild(milestoneRow);
    }

    // ---- Year Overview (cards float directly) ----
    if (stats.yearlyData && stats.yearlyData.length > 0) {
      parent.appendChild(this._sectionTitle(t('stats.yearOverview')));
      const yearGrid = document.createElement('div');
      yearGrid.className = 'stats-year-grid';
      for (const yr of stats.yearlyData) {
        const card = this._neuCard();
        card.classList.add('stats-year-card');
        const yearLabel = document.createElement('div');
        yearLabel.className = 'stats-year-label';
        yearLabel.textContent = yr.year + t('stats.year');
        card.appendChild(yearLabel);
        const yearData = document.createElement('div');
        yearData.className = 'stats-year-data';
        const rows = [
          [t('stats.yearConvs'), yr.convCount],
          [t('stats.yearMsgs'), yr.msgCount.toLocaleString()],
          [t('stats.yearWords'), (yr.humanChars + yr.assistantChars).toLocaleString()],
          [t('stats.yearDays'), yr.activeDays + ' 天'],
          [t('stats.yearThinking'), yr.thinkingCount.toLocaleString()],
        ];
        for (const [label, value] of rows) {
          const row = document.createElement('div');
          row.className = 'stats-year-row';
          const l = document.createElement('span');
          l.className = 'stats-year-key';
          l.textContent = label;
          row.appendChild(l);
          const v = document.createElement('span');
          v.className = 'stats-year-value';
          v.textContent = value;
          row.appendChild(v);
          yearData.appendChild(row);
        }
        card.appendChild(yearData);
        yearGrid.appendChild(card);
      }
      parent.appendChild(yearGrid);
    }

    // ---- GitHub-style Heatmap (in a single raised card) ----
    if (stats.dateHeatmap && Object.keys(stats.dateHeatmap).length > 0) {
      parent.appendChild(this._sectionTitle(t('stats.heatmap')));
      const heatCard = this._neuCard();
      heatCard.classList.add('stats-heatmap-card');
      heatCard.style.padding = '16px 22px';
      heatCard.appendChild(this._buildHeatmapCalendar(stats.dateHeatmap));
      heatCard.style.marginBottom = '14px';
      parent.appendChild(heatCard);
    }

    // ---- TOP 5 Longest Conversations (in a single raised card) ----
    parent.appendChild(this._sectionTitle(t('stats.top5')));
    const topCard = this._neuCard();
    topCard.classList.add('stats-rank-card');
    topCard.style.marginBottom = '14px';
    topCard.style.padding = '8px 0';
    for (let i = 0; i < Math.min(5, stats.topConversations.length); i++) {
      const conv = stats.topConversations[i];
      const item = document.createElement('div');
      item.className = 'stats-rank-row';
      item.style.cssText = 'display:flex;justify-content:space-between;padding:10px 20px;font-size:0.85rem;cursor:pointer;border-radius:var(--radius-sm);transition:background 0.15s;';
      if (i < Math.min(5, stats.topConversations.length) - 1) item.style.borderBottom = '1px solid var(--separator-color)';
      item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-card-hover)');
      item.addEventListener('mouseleave', () => item.style.background = '');
      const name = document.createElement('span');
      name.className = 'stats-rank-name';
      name.style.cssText = 'color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;margin-right:12px;';
      name.textContent = (i + 1) + '. ' + (conv.name || '未命名');
      item.appendChild(name);
      const count = document.createElement('span');
      count.className = 'stats-rank-count';
      count.style.cssText = 'color:var(--text-muted);white-space:nowrap;';
      count.textContent = conv.stats.messageCount + t('stats.top5msgs') + (conv.stats.humanChars + conv.stats.assistantChars).toLocaleString() + t('stats.top5chars');
      item.appendChild(count);
      item.addEventListener('click', () => {
        let visibleConvs = state.get('filteredConversations') || [];
        let idx = visibleConvs.findIndex(c => c.uuid === conv.uuid);
        if (idx < 0) {
          resetSidebarFilter();
          visibleConvs = state.get('filteredConversations') || [];
          idx = visibleConvs.findIndex(c => c.uuid === conv.uuid);
        }
        if (idx >= 0) {
          state.set('viewMode', 'conversation');
          state.set('currentConversationIndex', idx);
        }
        this.hide();
      });
      topCard.appendChild(item);
    }
    parent.appendChild(topCard);

    // ---- Deep Night Ranking (in a single raised card) ----
    if (stats.deepNightConvs.length > 0) {
      parent.appendChild(this._sectionTitle(t('stats.lateNightRank')));
      const nightCard = this._neuCard();
      nightCard.classList.add('stats-rank-card');
      nightCard.style.marginBottom = '14px';
      nightCard.style.padding = '8px 0';
      for (let i = 0; i < Math.min(5, stats.deepNightConvs.length); i++) {
        const item = stats.deepNightConvs[i];
        const row = document.createElement('div');
        row.className = 'stats-rank-row';
        row.style.cssText = 'display:flex;justify-content:space-between;padding:8px 20px;font-size:0.85rem;';
        if (i < Math.min(5, stats.deepNightConvs.length) - 1) row.style.borderBottom = '1px solid var(--separator-color)';
        const name = document.createElement('span');
        name.className = 'stats-rank-name';
        name.style.cssText = 'color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;margin-right:12px;';
        name.textContent = '\uD83C\uDF19 ' + (item.name || '未命名');
        row.appendChild(name);
        const count = document.createElement('span');
        count.className = 'stats-rank-count';
        count.style.cssText = 'color:var(--text-muted);white-space:nowrap;';
        count.textContent = item.lateCount + ' 条深夜消息';
        row.appendChild(count);
        nightCard.appendChild(row);
      }
      parent.appendChild(nightCard);
    }

    parent.appendChild(this._sectionTitle(t('stats.rhythm')));
    const rhythmSection = document.createElement('div');
    rhythmSection.className = 'stats-rhythm-section';

    // ---- Weekday + Monthly Line Chart side by side ----
    const activityRow = document.createElement('div');
    activityRow.className = 'stats-activity-grid';

    // Weekday: horizontal meters make the seven-day comparison readable at a glance.
    const weekdayCard = this._neuCard();
    weekdayCard.classList.add('stats-chart-card');
    const weekdayTitle = document.createElement('div');
    weekdayTitle.className = 'stats-chart-title';
    weekdayTitle.textContent = '星期几最爱聊天';
    weekdayCard.appendChild(weekdayTitle);
    const weekdayBar = document.createElement('div');
    weekdayBar.className = 'stats-weekday-bars';
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const maxWeekday = Math.max(...stats.weekdayActivity, 1);
    for (let d = 0; d < 7; d++) {
      const col = document.createElement('div');
      col.className = 'stats-weekday-column';
      const label = document.createElement('div');
      label.className = 'stats-axis-label stats-weekday-label';
      label.textContent = weekdays[d];
      col.appendChild(label);
      const track = document.createElement('div');
      track.className = 'stats-weekday-track';
      const pct = Math.max(5, (stats.weekdayActivity[d] / maxWeekday) * 100);
      const fill = document.createElement('div');
      fill.className = 'stats-weekday-fill';
      fill.style.setProperty('--bar-scale', String(pct / 100));
      fill.title = stats.weekdayActivity[d] + ' 条消息';
      track.appendChild(fill);
      col.appendChild(track);
      const count = document.createElement('div');
      count.className = 'stats-weekday-count';
      count.textContent = stats.weekdayActivity[d].toLocaleString();
      col.appendChild(count);
      weekdayBar.appendChild(col);
    }
    weekdayCard.appendChild(weekdayBar);
    activityRow.appendChild(weekdayCard);

    // Monthly line chart goes next to weekday
    if (stats.monthlyData.labels.length > 1) {
      const chartCard1 = this._neuCard();
      chartCard1.classList.add('stats-chart-card');
      const chartTitle1 = document.createElement('div');
      chartTitle1.className = 'stats-chart-title';
      chartTitle1.textContent = '每月对话频率';
      chartCard1.appendChild(chartTitle1);
      const canvas1 = document.createElement('canvas');
      canvas1.className = 'stats-line-chart';
      canvas1.style.cssText = 'width:100%;height:180px;';
      chartCard1.appendChild(canvas1);
      activityRow.appendChild(chartCard1);
      rhythmSection.appendChild(activityRow);
      requestAnimationFrame(() => {
        drawLineChart(canvas1, { labels: stats.monthlyData.labels, values: stats.monthlyData.convCounts }, { color: this._cssVar('--stats-trend') });
      });
    } else {
      rhythmSection.appendChild(activityRow);
    }

    // ---- Hourly Activity (own row) ----
    if (stats.hourlyActivity.some(v => v > 0)) {
      const hourCard = this._neuCard();
      hourCard.classList.add('stats-chart-card');
      hourCard.classList.add('stats-hour-card');
      const hourTitle = document.createElement('div');
      hourTitle.className = 'stats-chart-title';
      hourTitle.textContent = '每日活跃时段';
      hourCard.appendChild(hourTitle);
      const heatmap = document.createElement('div');
      heatmap.className = 'stats-hour-wave';
      const maxHour = Math.max(...stats.hourlyActivity);
      for (let h = 0; h < 24; h++) {
        const cell = document.createElement('div');
        const intensity = maxHour > 0 ? stats.hourlyActivity[h] / maxHour : 0;
        cell.className = 'stats-hour-tick';
        cell.style.setProperty('--hour-scale', String(Math.max(0.08, intensity)));
        cell.title = `${h}:00 — ${stats.hourlyActivity[h]} 条消息`;
        heatmap.appendChild(cell);
      }
      hourCard.appendChild(heatmap);
      const hourLabels = document.createElement('div');
      hourLabels.className = 'stats-hour-labels';
      for (let h = 0; h < 24; h++) {
        const label = document.createElement('div');
        label.className = 'stats-hour-label';
        label.textContent = h % 6 === 0 ? h + ':00' : '';
        hourLabels.appendChild(label);
      }
      hourCard.appendChild(hourLabels);
      rhythmSection.appendChild(hourCard);
    }

    // ---- Monthly Word Count (own row) ----
    if (stats.monthlyData.labels.length > 1) {

      const chartCard2 = this._neuCard();
      chartCard2.classList.add('stats-chart-card');
      const chartTitle2 = document.createElement('div');
      chartTitle2.className = 'stats-chart-title';
      chartTitle2.textContent = '每月字数';
      chartCard2.appendChild(chartTitle2);

      const canvas2 = document.createElement('canvas');
      canvas2.className = 'stats-comparison-chart';
      chartCard2.appendChild(canvas2);
      // Legend
      const legend = document.createElement('div');
      legend.className = 'stats-chart-legend';
      legend.innerHTML = `<span><i class="stats-legend-swatch stats-legend-human"></i>${names.human || 'Human'}</span>`
        + `<span><i class="stats-legend-swatch stats-legend-assistant"></i>${names.assistant || 'Assistant'}</span>`;
      chartCard2.appendChild(legend);
      rhythmSection.appendChild(chartCard2);
      requestAnimationFrame(() => {
        drawAreaComparisonChart(canvas2, {
          labels: stats.monthlyData.labels,
          series: [
            { name: names.human || 'Human', values: stats.monthlyData.humanChars, color: this._cssVar('--stats-human') },
            { name: names.assistant || 'Assistant', values: stats.monthlyData.assistantChars, color: this._cssVar('--stats-assistant') },
          ],
        });
      });
    }
    parent.appendChild(rhythmSection);

    // ---- Word Cloud (Top Words) — in a raised card ----
    if (stats.topHumanWords.length > 0 || stats.topAssistantWords.length > 0) {
      const wordTitleRow = document.createElement('div');
      wordTitleRow.className = 'stats-word-title-row';
      wordTitleRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;';
      const wordTitle = this._sectionTitle('高频词');
      wordTitle.style.marginBottom = '14px';
      wordTitleRow.appendChild(wordTitle);

      const resetBtn = document.createElement('button');
      resetBtn.style.cssText = 'padding:3px 10px;border:1px solid var(--border);border-radius:4px;background:transparent;color:var(--text-muted);cursor:pointer;font-size:0.7rem;';
      resetBtn.textContent = '重置隐藏';
      resetBtn.addEventListener('click', () => {
        localStorage.removeItem('cv-hidden-words');
        const empty = new Set();
        this._renderWordCloud(humanCloudContainer, stats.allHumanWords.filter(w => !empty.has(w.text)).slice(0, 40), stats.allHumanWords, 'word');
        this._renderWordCloud(assistantCloudContainer, stats.allAssistantWords.filter(w => !empty.has(w.text)).slice(0, 40), stats.allAssistantWords, 'word');
      });
      wordTitleRow.appendChild(resetBtn);
      parent.appendChild(wordTitleRow);

      const wordCard = this._neuCard();
      wordCard.classList.add('stats-word-cloud-card');
      wordCard.style.marginBottom = '14px';

      // Two columns
      const columns = document.createElement('div');
      columns.className = 'stats-word-columns';
      columns.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';

      const humanCol = document.createElement('div');
      const humanLabel = document.createElement('div');
      humanLabel.style.cssText = 'font-size:0.8rem;font-weight:600;color:var(--accent);margin-bottom:8px;text-align:center;';
      humanLabel.textContent = (names.human || 'Human') + ' 的高频词';
      humanCol.appendChild(humanLabel);
      const humanCloudContainer = document.createElement('div');
      this._renderWordCloud(humanCloudContainer, stats.topHumanWords, stats.allHumanWords, 'word');
      humanCol.appendChild(humanCloudContainer);
      columns.appendChild(humanCol);

      const assistantCol = document.createElement('div');
      const assistantLabel = document.createElement('div');
      assistantLabel.style.cssText = 'font-size:0.8rem;font-weight:600;color:var(--text-primary);margin-bottom:8px;text-align:center;';
      assistantLabel.textContent = (names.assistant || 'Assistant') + ' 的高频词';
      assistantCol.appendChild(assistantLabel);
      const assistantCloudContainer = document.createElement('div');
      this._renderWordCloud(assistantCloudContainer, stats.topAssistantWords, stats.allAssistantWords, 'word');
      assistantCol.appendChild(assistantCloudContainer);
      columns.appendChild(assistantCol);

      wordCard.appendChild(columns);
      parent.appendChild(wordCard);
    }

    // ---- Emoji Ranking (in a raised card) ----
    if (stats.topEmojis.length > 0) {
      parent.appendChild(this._sectionTitle('常用 Emoji'));
      const emojiCard = this._neuCard();
      emojiCard.classList.add('stats-emoji-card');
      emojiCard.style.marginBottom = '14px';
      const emojiRow = document.createElement('div');
      emojiRow.className = 'stats-emoji-row';
      emojiRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;';
      for (const e of stats.topEmojis.slice(0, 15)) {
        const item = document.createElement('div');
        item.style.cssText = 'text-align:center;';
        const emoji = document.createElement('div');
        emoji.style.cssText = 'font-size:1.8rem;';
        emoji.textContent = e.emoji;
        item.appendChild(emoji);
        const count = document.createElement('div');
        count.style.cssText = 'font-size:0.7rem;color:var(--text-muted);';
        count.textContent = e.count;
        item.appendChild(count);
        emojiRow.appendChild(item);
      }
      emojiCard.appendChild(emojiRow);
      parent.appendChild(emojiCard);
    }

    // ---- Thinking Stats (cards float directly in grid) ----
    if (stats.totalThinkingCount > 0) {
      parent.appendChild(this._sectionTitle('思考统计'));
      const thinkGrid = document.createElement('div');
      thinkGrid.className = 'stats-think-grid';
      const thinkStats = [
        { label: '总思考次数', value: stats.totalThinkingCount.toLocaleString() + ' 次' },
        { label: '累计思考时间', value: this.formatMs(stats.totalThinkingMs) },
        { label: '最长单次思考', value: this.formatMs(stats.longestThinkingMs) },
        { label: '平均思考时间', value: this.formatMs(stats.totalThinkingCount > 0 ? Math.round(stats.totalThinkingMs / stats.totalThinkingCount) : 0) },
      ];
      for (const s of thinkStats) {
        const card = this._neuCard();
        card.classList.add('stats-thinking-card');
        const label = document.createElement('div');
        label.className = 'stats-card-label';
        label.textContent = s.label;
        card.appendChild(label);
        const val = document.createElement('div');
        val.className = 'stats-thinking-value';
        val.textContent = s.value;
        card.appendChild(val);
        thinkGrid.appendChild(card);
      }
      parent.appendChild(thinkGrid);
    }

    // ---- Title Word Cloud (in a raised card) ----
    if (stats.topTitleWords.length > 0) {
      parent.appendChild(this._sectionTitle('对话标题高频词'));
      const titleCard = this._neuCard();
      titleCard.classList.add('stats-title-cloud-card');
      titleCard.style.marginBottom = '14px';
      const titleCloudContainer = document.createElement('div');
      this._renderWordCloud(titleCloudContainer, stats.topTitleWords, stats.allTitleWords, 'title');
      titleCard.appendChild(titleCloudContainer);
      parent.appendChild(titleCard);
    }
  }

  // ---- Compute Stats ----

  computeStats(conversations) {
    let totalMessages = 0, totalHumanChars = 0, totalAssistantChars = 0;
    let totalThinkingMs = 0, totalThinkingCount = 0, longestThinkingMs = 0;
    let lateNightConvs = 0, totalFlags = 0;
    const allDates = [];
    const dateHeatmap = {}; // 'YYYY-MM-DD' -> count
    const monthlyMap = new Map();
    const hourlyActivity = new Array(24).fill(0);
    const weekdayActivity = new Array(7).fill(0);
    const humanWordFreq = new Map();
    const assistantWordFreq = new Map();
    const emojiFreq = new Map();
    const titleWords = new Map();
    const deepNightConvs = [];
    const activeDays = new Set();

    const sorted = [...conversations].sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    for (const conv of sorted) {
      totalMessages += conv.stats.messageCount;
      totalHumanChars += conv.stats.humanChars;
      totalAssistantChars += conv.stats.assistantChars;
      totalThinkingMs += conv.stats.totalThinkingMs || 0;
      totalThinkingCount += conv.stats.thinkingCount || 0;
      if (conv.stats.hasFlags) totalFlags += conv.messages.filter(m => m.contentBlocks.some(b => b.type === 'flag')).length;

      if (conv.createdAt) allDates.push(new Date(conv.createdAt));

      // Title words
      if (conv.name) {
        const words = this._extractWords(conv.name);
        for (const w of words) {
          titleWords.set(w, (titleWords.get(w) || 0) + 1);
        }
      }

      let lateCount = 0;
      for (const msg of conv.messages) {
        if (msg.createdAt) {
          const date = new Date(msg.createdAt);
          const hour = date.getHours();
          const dayKey = this._getLocalDayKey(date);
          const weekday = date.getDay();

          hourlyActivity[hour]++;
          weekdayActivity[weekday]++;
          dateHeatmap[dayKey] = (dateHeatmap[dayKey] || 0) + 1;
          activeDays.add(dayKey);

          if (hour >= 2 && hour < 5) lateCount++;
        }

        // Word frequency — split by sender
        const freqMap = msg.sender === 'human' ? humanWordFreq : assistantWordFreq;
        for (const block of msg.contentBlocks) {
          if (block.type === 'text' && block.text) {
            const words = this._extractWords(block.text);
            for (const w of words) freqMap.set(w, (freqMap.get(w) || 0) + 1);
            const emojis = this._extractEmojis(block.text);
            for (const e of emojis) emojiFreq.set(e, (emojiFreq.get(e) || 0) + 1);
          }
        }

        // Longest thinking
        for (const block of msg.contentBlocks) {
          if (block.type === 'thinking' && block.durationMs > 0) {
            if (block.durationMs > longestThinkingMs) longestThinkingMs = block.durationMs;
          }
        }
      }

      if (lateCount > 0) {
        lateNightConvs++;
        deepNightConvs.push({ name: conv.name, lateCount, uuid: conv.uuid });
      }

      const mk = formatMonthKey(conv.createdAt);
      if (!monthlyMap.has(mk)) monthlyMap.set(mk, { convCount: 0, humanChars: 0, assistantChars: 0 });
      const m = monthlyMap.get(mk);
      m.convCount++;
      m.humanChars += conv.stats.humanChars;
      m.assistantChars += conv.stats.assistantChars;
    }

    // Day span
    let daySpan = 0;
    if (allDates.length >= 2) {
      daySpan = Math.ceil((Math.max(...allDates.map(d => d.getTime())) - Math.min(...allDates.map(d => d.getTime()))) / 86400000);
    }

    // Longest streak
    const longestStreak = this._calcLongestStreak(activeDays);

    // Monthly data
    const monthKeys = [...monthlyMap.keys()].sort();
    const monthlyData = {
      labels: monthKeys.map(k => { const [, m] = k.split('-'); return parseInt(m) + '月'; }),
      convCounts: monthKeys.map(k => monthlyMap.get(k).convCount),
      humanChars: monthKeys.map(k => monthlyMap.get(k).humanChars),
      assistantChars: monthKeys.map(k => monthlyMap.get(k).assistantChars),
    };

    // Top conversations by message count
    const topConversations = [...conversations].sort((a, b) => b.stats.messageCount - a.stats.messageCount).slice(0, 5);

    // Deep night sorted by late count
    deepNightConvs.sort((a, b) => b.lateCount - a.lateCount);

    // Top words (filter stop words)
    const stopWords = new Set(['的', '了', '是', '我', '你', '在', '有', '不', '这', '就', '都', '也', '和', '人', '吗', '啊', '好', '那', '很', '说', '会', '对', '到', '要', '一', '个', '上', '么', '他', '她', '它', '们', '去', '来', '着', '过', '还', '呢', '被', '把', '但', '又', '而', '所以', '如果', '因为', '可以', '什么', '没有', '自己', '知道', '觉得', '其实', '这个', '那个', '时候', '已经', '然后', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'and', 'or', 'for', 'on', 'at', 'with', 'that', 'this', 'it', 'be', 'as', 'by', 'from', 'not', 'but', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'i', 'you', 'we', 'they', 'he', 'she']);
    // Keep a large pool per sender, display will filter by hidden words
    const allHumanWords = [...humanWordFreq.entries()]
      .filter(([w]) => !stopWords.has(w) && w.length >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 200)
      .map(([text, count]) => ({ text, count }));

    const allAssistantWords = [...assistantWordFreq.entries()]
      .filter(([w]) => !stopWords.has(w) && w.length >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 200)
      .map(([text, count]) => ({ text, count }));

    const allTitleWords = [...titleWords.entries()]
      .filter(([w]) => !stopWords.has(w) && w.length >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .map(([text, count]) => ({ text, count }));

    const hiddenWords = this._loadHiddenWords();
    const topHumanWords = allHumanWords.filter(w => !hiddenWords.has(w.text)).slice(0, 40);
    const topAssistantWords = allAssistantWords.filter(w => !hiddenWords.has(w.text)).slice(0, 40);
    const topTitleWords = allTitleWords.filter(w => !hiddenWords.has(w.text)).slice(0, 20);

    // Top emojis
    const topEmojis = [...emojiFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([emoji, count]) => ({ emoji, count }));

    // Yearly data
    const yearMap = new Map();
    for (const conv of sorted) {
      if (!conv.createdAt) continue;
      const year = new Date(conv.createdAt).getFullYear();
      if (!yearMap.has(year)) yearMap.set(year, { year, convCount: 0, msgCount: 0, humanChars: 0, assistantChars: 0, thinkingCount: 0, activeDaysSet: new Set() });
      const yr = yearMap.get(year);
      yr.convCount++;
      yr.msgCount += conv.stats.messageCount;
      yr.humanChars += conv.stats.humanChars;
      yr.assistantChars += conv.stats.assistantChars;
      yr.thinkingCount += conv.stats.thinkingCount || 0;
      for (const msg of conv.messages) {
        if (msg.createdAt) yr.activeDaysSet.add(this._getLocalDayKey(new Date(msg.createdAt)));
      }
    }
    const yearlyData = [...yearMap.values()]
      .sort((a, b) => b.year - a.year)
      .map(yr => ({ ...yr, activeDays: yr.activeDaysSet.size, activeDaysSet: undefined }));

    // First and last conversation
    const firstConv = sorted[0] || null;
    const lastConv = sorted[sorted.length - 1] || null;

    return {
      totalConversations: conversations.length,
      totalMessages, totalHumanChars, totalAssistantChars,
      totalThinkingMs, totalThinkingCount, longestThinkingMs,
      daySpan, longestStreak, lateNightConvs, totalFlags,
      topConversations, deepNightConvs,
      monthlyData, hourlyActivity, weekdayActivity, dateHeatmap,
      topHumanWords, topAssistantWords, allHumanWords, allAssistantWords,
      topTitleWords, allTitleWords, topEmojis,
      yearlyData, firstConv, lastConv,
    };
  }

  // ---- Helpers ----

  _renderWordCloud(container, visibleWords, allWords, type) {
    container.textContent = '';
    container.className = 'stats-word-cloud';
    container.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-sm);justify-content:center;align-items:center;';

    if (visibleWords.length === 0) {
      const empty = document.createElement('span');
      empty.style.cssText = 'color:var(--text-muted);font-size:0.85rem;';
      empty.textContent = '全部隐藏了，点击"重置隐藏"恢复';
      container.appendChild(empty);
      return;
    }

    const maxFreq = visibleWords[0].count;
    for (const word of visibleWords) {
      const tag = document.createElement('span');
      tag.style.cssText = 'display:inline-flex;align-items:center;gap:2px;position:relative;';

      const size = type === 'title'
        ? 0.8 + (word.count / maxFreq) * 2
        : 0.7 + (word.count / maxFreq) * 1.6;
      const opacity = 0.5 + (word.count / maxFreq) * 0.5;

      const text = document.createElement('span');
      text.style.cssText = `font-size:${size}rem;color:var(--accent);opacity:${opacity};padding:2px 4px;cursor:default;transition:opacity 0.15s;`;
      text.textContent = word.text;
      text.title = word.count + ' 次';
      tag.appendChild(text);

      // Delete button (visible on hover)
      const delBtn = document.createElement('span');
      delBtn.style.cssText = 'font-size:0.6rem;color:var(--text-muted);cursor:pointer;opacity:0;transition:opacity 0.15s;padding:0 2px;vertical-align:super;';
      delBtn.textContent = '\u2715';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const hidden = this._loadHiddenWords();
        hidden.add(word.text);
        this._saveHiddenWords(hidden);
        const displayCount = type === 'title' ? 20 : 40;
        const refreshed = allWords.filter(w => !hidden.has(w.text)).slice(0, displayCount);
        this._renderWordCloud(container, refreshed, allWords, type);
      });
      tag.appendChild(delBtn);

      tag.addEventListener('mouseenter', () => { text.style.opacity = '1'; delBtn.style.opacity = '1'; });
      tag.addEventListener('mouseleave', () => { text.style.opacity = String(opacity); delBtn.style.opacity = '0'; });

      container.appendChild(tag);
    }
  }

  _loadHiddenWords() {
    try {
      const saved = localStorage.getItem('cv-hidden-words');
      if (saved) return new Set(JSON.parse(saved));
    } catch (e) { /* ignore */ }
    return new Set();
  }

  _saveHiddenWords(hiddenSet) {
    localStorage.setItem('cv-hidden-words', JSON.stringify([...hiddenSet]));
  }

  /** Neumorphic outer section — convex container */
  _neuSection() {
    const el = document.createElement('div');
    el.style.cssText = 'background:var(--bg-card);border-radius:var(--radius-lg);padding:20px;box-shadow:var(--shadow);';
    return el;
  }

  /** Neumorphic card — convex / raised (matching Figma design) */
  _neuCard() {
    const el = document.createElement('div');
    el.className = 'stats-card';
    return el;
  }

  _sectionTitle(text) {
    const el = document.createElement('h3');
    el.className = 'stats-section-title';
    const dot = document.createElement('span');
    dot.className = 'stats-section-mark';
    el.appendChild(dot);
    const span = document.createElement('span');
    span.textContent = text;
    el.appendChild(span);
    return el;
  }

  _milestoneCard(label, name, time) {
    const card = this._neuCard();
    card.classList.add('stats-milestone-card');
    const labelEl = document.createElement('div');
    labelEl.className = 'stats-card-label';
    labelEl.textContent = label;
    card.appendChild(labelEl);
    const nameEl = document.createElement('div');
    nameEl.className = 'stats-milestone-name';
    nameEl.textContent = name;
    card.appendChild(nameEl);
    const timeEl = document.createElement('div');
    timeEl.className = 'stats-milestone-time';
    timeEl.textContent = time;
    card.appendChild(timeEl);
    return card;
  }

  _cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  _buildHeatmapCalendar(dateHeatmap) {
    const container = document.createElement('div');
    container.className = 'stats-heatmap-scroll';
    container.style.cssText = 'overflow-x:auto;padding-bottom:4px;';

    const dates = Object.keys(dateHeatmap).sort();
    if (dates.length === 0) return container;

    const latest = new Date(dates[dates.length - 1]);
    const start = new Date(latest);
    start.setDate(start.getDate() - 364);
    start.setDate(start.getDate() - start.getDay()); // Align to Sunday

    const maxCount = Math.max(...Object.values(dateHeatmap), 1);
    const CELL = 14, GAP = 4;
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Outer wrapper with weekday labels on the left
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;gap:4px;';

    // Weekday labels column
    const weekdayLabels = document.createElement('div');
    weekdayLabels.style.cssText = `display:flex;flex-direction:column;gap:${GAP}px;justify-content:flex-start;padding-top:${CELL + GAP + 2}px;flex-shrink:0;`;
    for (let d = 0; d < 7; d++) {
      const label = document.createElement('div');
      label.style.cssText = `height:${CELL}px;font-size:0.5rem;color:var(--text-muted);display:flex;align-items:center;line-height:1;width:22px;`;
      label.textContent = weekdays[d];
      weekdayLabels.appendChild(label);
    }
    wrapper.appendChild(weekdayLabels);

    // Grid area (month labels + cells)
    const gridArea = document.createElement('div');
    gridArea.style.cssText = 'display:flex;flex-direction:column;';

    // Month labels row
    const monthRow = document.createElement('div');
    monthRow.style.cssText = `display:flex;gap:${GAP}px;margin-bottom:4px;`;
    const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

    // Pre-calculate weeks and their months
    const weeks = [];
    let current = new Date(start);
    while (current <= latest) {
      const weekStart = new Date(current);
      const cells = [];
      for (let d = 0; d < 7; d++) {
        const dayKey = this._getLocalDayKey(current);
        cells.push({ dayKey, count: dateHeatmap[dayKey] || 0, date: new Date(current) });
        current.setDate(current.getDate() + 1);
      }
      weeks.push({ weekStart, cells });
    }

    // Build month labels — show label at the first week of each month
    let lastMonth = -1;
    for (const week of weeks) {
      const m = week.weekStart.getMonth();
      const label = document.createElement('div');
      label.style.cssText = `width:${CELL}px;font-size:0.6rem;color:var(--text-muted);text-align:left;flex-shrink:0;overflow:visible;white-space:nowrap;`;
      if (m !== lastMonth) {
        label.textContent = monthNames[m];
        lastMonth = m;
      }
      monthRow.appendChild(label);
    }
    gridArea.appendChild(monthRow);

    // Cell grid
    const grid = document.createElement('div');
    grid.style.cssText = `display:flex;gap:${GAP}px;`;

    for (const week of weeks) {
      const weekCol = document.createElement('div');
      weekCol.style.cssText = `display:flex;flex-direction:column;gap:${GAP}px;`;

      for (const cell of week.cells) {
        const el = document.createElement('div');
        const intensity = cell.count / maxCount;
        // Neumorphic physics levels: 0=deep inset, 1-4=increasing raised
        const level = cell.count === 0 ? 0 : intensity < 0.25 ? 1 : intensity < 0.5 ? 2 : intensity < 0.75 ? 3 : 4;
        el.className = `stats-calendar-cell stats-calendar-level-${level}`;
        el.style.width = `${CELL}px`;
        el.style.height = `${CELL}px`;
        el.title = cell.dayKey + ': ' + cell.count + ' 条消息';
        weekCol.appendChild(el);
      }
      grid.appendChild(weekCol);
    }

    gridArea.appendChild(grid);

    // Legend
    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;align-items:center;gap:4px;margin-top:12px;justify-content:flex-start;font-size:0.55rem;color:var(--text-muted);font-weight:600;padding-left:26px;';
    legend.appendChild(document.createTextNode('Less'));
    for (let i = 0; i < 5; i++) {
      const box = document.createElement('div');
      box.className = `stats-calendar-legend-cell stats-calendar-level-${i}`;
      legend.appendChild(box);
    }
    legend.appendChild(document.createTextNode('More'));
    gridArea.appendChild(legend);

    wrapper.appendChild(gridArea);
    container.appendChild(wrapper);
    return container;
  }

  _calcLongestStreak(activeDays) {
    if (activeDays.size === 0) return 0;
    const sorted = [...activeDays].sort();
    let longest = 1, current = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]);
      const curr = new Date(sorted[i]);
      const diff = (curr - prev) / 86400000;
      if (diff === 1) { current++; longest = Math.max(longest, current); }
      else current = 1;
    }
    return longest;
  }

  _extractWords(text) {
    // Simple Chinese + English word extraction
    const chinese = text.match(/[\u4e00-\u9fff]{2,4}/g) || [];
    const english = text.toLowerCase().match(/[a-z]{3,}/g) || [];
    return [...chinese, ...english];
  }

  _extractEmojis(text) {
    const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
    const matches = text.match(emojiRegex) || [];
    return matches;
  }

  formatMs(ms) {
    if (!ms || ms <= 0) return '0';
    if (ms < 1000) return ms + 'ms';
    const seconds = ms / 1000;
    if (seconds < 60) return seconds.toFixed(1) + 's';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + '分' + Math.floor(seconds % 60) + '秒';
    const hours = Math.floor(minutes / 60);
    return hours + '小时' + (minutes % 60) + '分';
  }

  _getLocalDayKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
