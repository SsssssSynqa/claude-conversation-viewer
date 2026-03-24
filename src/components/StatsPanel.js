/**
 * StatsPanel — Rich statistics dashboard with charts, rankings, and fun data.
 */

import { state } from '../store/state.js';
import { drawLineChart, drawBarChart } from '../utils/charts.js';
import { formatMonthKey, formatMonthLabel, formatTimestamp, getHourOfDay } from '../utils/time.js';
import html2canvas from 'html2canvas';
import { desensitize } from '../utils/desensitize.js';
import { createIcon } from '../utils/icons.js';

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
    container.style.cssText = 'flex:1;overflow-y:auto;padding:32px 24px;';
    const inner = document.createElement('div');
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
    titleRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;';

    const title = document.createElement('h2');
    title.style.cssText = 'font-size:1.5rem;font-weight:700;color:var(--text-primary);';
    title.textContent = '对话统计';
    titleRow.appendChild(title);

    const screenshotBtn = document.createElement('button');
    screenshotBtn.style.cssText = 'padding:6px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);background:transparent;color:var(--text-secondary);cursor:pointer;font-size:12px;transition:all 0.15s;white-space:nowrap;display:flex;align-items:center;gap:4px;';
    screenshotBtn.appendChild(createIcon('save', 14));
    screenshotBtn.appendChild(document.createTextNode(' 保存为图片'));
    screenshotBtn.addEventListener('mouseenter', () => { screenshotBtn.style.borderColor = 'var(--accent)'; screenshotBtn.style.color = 'var(--accent)'; });
    screenshotBtn.addEventListener('mouseleave', () => { screenshotBtn.style.borderColor = 'var(--border)'; screenshotBtn.style.color = 'var(--text-secondary)'; });
    screenshotBtn.addEventListener('click', async () => {
      screenshotBtn.textContent = '截图中...';
      screenshotBtn.disabled = true;
      try {
        const canvas = await html2canvas(parent, {
          backgroundColor: getComputedStyle(document.body).backgroundColor,
          scale: 2,
          useCORS: true,
        });
        const link = document.createElement('a');
        link.download = '对话统计_' + new Date().toISOString().slice(0, 10) + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        screenshotBtn.textContent = '\u2713 已保存';
        setTimeout(() => { screenshotBtn.textContent = ''; screenshotBtn.appendChild(createIcon('save', 14)); screenshotBtn.appendChild(document.createTextNode(' 保存为图片')); screenshotBtn.disabled = false; }, 1500);
      } catch (e) {
        screenshotBtn.textContent = '截图失败';
        setTimeout(() => { screenshotBtn.textContent = ''; screenshotBtn.appendChild(createIcon('save', 14)); screenshotBtn.appendChild(document.createTextNode(' 保存为图片')); screenshotBtn.disabled = false; }, 1500);
      }
    });
    titleRow.appendChild(screenshotBtn);

    parent.appendChild(titleRow);

    // ---- Basic Stats Cards (floating directly on background, no outer wrapper) ----
    const cardsGrid = document.createElement('div');
    cardsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;';

    // Row 1: 4 basic counts (matching Figma layout)
    const row1Stats = [
      { label: '总窗口数', value: stats.totalConversations },
      { label: '总消息数', value: stats.totalMessages.toLocaleString() },
      { label: '思考次数', value: stats.totalThinkingCount.toLocaleString() },
      { label: '思考总时间', value: this.formatMs(stats.totalThinkingMs) },
    ];

    for (const s of row1Stats) {
      const card = this._neuCard();
      const label = document.createElement('div');
      label.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;';
      label.textContent = s.label;
      card.appendChild(label);
      const val = document.createElement('div');
      val.style.cssText = 'font-size:1.8rem;font-weight:800;color:var(--text-primary);letter-spacing:-0.5px;';
      val.textContent = String(s.value);
      card.appendChild(val);
      cardsGrid.appendChild(card);
    }

    // Row 2: 2 wider word count cards with percentage rings (span 2 cols each)
    const totalChars = stats.totalAssistantChars + stats.totalHumanChars;
    const assistantPct = totalChars > 0 ? Math.round((stats.totalAssistantChars / totalChars) * 100) : 0;
    const humanPct = totalChars > 0 ? Math.round((stats.totalHumanChars / totalChars) * 100) : 0;

    const wordCountCards = [
      { label: (names.assistant || 'Assistant') + '的总字数', value: stats.totalAssistantChars.toLocaleString(), pct: assistantPct, color: '#4A7AE8' },
      { label: (names.human || 'Human') + '的总字数', value: stats.totalHumanChars.toLocaleString(), pct: humanPct, color: '#45C4B0' },
    ];

    for (const s of wordCountCards) {
      const card = this._neuCard();
      card.style.gridColumn = 'span 2';
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';

      const textDiv = document.createElement('div');
      const label = document.createElement('div');
      label.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;';
      label.textContent = s.label;
      textDiv.appendChild(label);
      const val = document.createElement('div');
      val.style.cssText = 'font-size:1.8rem;font-weight:800;color:var(--text-primary);letter-spacing:-0.5px;';
      val.textContent = s.value;
      textDiv.appendChild(val);
      card.appendChild(textDiv);

      // Neumorphic ring chart — deep groove track + 3D tube arc + convex center
      const ringSize = 96;
      const ringSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ringSvg.setAttribute('width', ringSize);
      ringSvg.setAttribute('height', ringSize);
      ringSvg.setAttribute('viewBox', '0 0 96 96');
      ringSvg.style.flexShrink = '0';

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const uid = 'ring-' + s.pct + '-' + Math.random().toString(36).slice(2, 6);

      // Filter: deep inset shadow for groove
      const svgNS = 'http://www.w3.org/2000/svg';
      const grooveFilter = document.createElementNS(svgNS, 'filter');
      grooveFilter.setAttribute('id', uid + '-groove');
      grooveFilter.setAttribute('x', '-30%'); grooveFilter.setAttribute('y', '-30%');
      grooveFilter.setAttribute('width', '160%'); grooveFilter.setAttribute('height', '160%');
      // Dark inner shadow (top-left light source → shadow on bottom-right inside)
      const gBlur = document.createElementNS(svgNS, 'feGaussianBlur');
      gBlur.setAttribute('in', 'SourceAlpha'); gBlur.setAttribute('stdDeviation', '3'); gBlur.setAttribute('result', 'blur');
      grooveFilter.appendChild(gBlur);
      const gOff1 = document.createElementNS(svgNS, 'feOffset');
      gOff1.setAttribute('in', 'blur'); gOff1.setAttribute('dx', '2'); gOff1.setAttribute('dy', '2'); gOff1.setAttribute('result', 'dOff');
      grooveFilter.appendChild(gOff1);
      const gFlood1 = document.createElementNS(svgNS, 'feFlood');
      gFlood1.setAttribute('flood-color', 'rgba(0,0,0,0.3)'); gFlood1.setAttribute('result', 'dColor');
      grooveFilter.appendChild(gFlood1);
      const gComp1 = document.createElementNS(svgNS, 'feComposite');
      gComp1.setAttribute('in', 'dColor'); gComp1.setAttribute('in2', 'dOff'); gComp1.setAttribute('operator', 'in'); gComp1.setAttribute('result', 'dShadow');
      grooveFilter.appendChild(gComp1);
      // Light highlight (opposite corner)
      const gOff2 = document.createElementNS(svgNS, 'feOffset');
      gOff2.setAttribute('in', 'blur'); gOff2.setAttribute('dx', '-2'); gOff2.setAttribute('dy', '-2'); gOff2.setAttribute('result', 'lOff');
      grooveFilter.appendChild(gOff2);
      const gFlood2 = document.createElementNS(svgNS, 'feFlood');
      gFlood2.setAttribute('flood-color', 'rgba(255,255,255,0.5)'); gFlood2.setAttribute('result', 'lColor');
      grooveFilter.appendChild(gFlood2);
      const gComp2 = document.createElementNS(svgNS, 'feComposite');
      gComp2.setAttribute('in', 'lColor'); gComp2.setAttribute('in2', 'lOff'); gComp2.setAttribute('operator', 'in'); gComp2.setAttribute('result', 'lShadow');
      grooveFilter.appendChild(gComp2);
      const gMerge = document.createElementNS(svgNS, 'feMerge');
      const gM1 = document.createElementNS(svgNS, 'feMergeNode'); gM1.setAttribute('in', 'dShadow'); gMerge.appendChild(gM1);
      const gM2 = document.createElementNS(svgNS, 'feMergeNode'); gM2.setAttribute('in', 'lShadow'); gMerge.appendChild(gM2);
      const gM3 = document.createElementNS(svgNS, 'feMergeNode'); gM3.setAttribute('in', 'SourceGraphic'); gMerge.appendChild(gM3);
      grooveFilter.appendChild(gMerge);
      defs.appendChild(grooveFilter);

      // Filter: convex center disc
      const centerFilter = document.createElementNS(svgNS, 'filter');
      centerFilter.setAttribute('id', uid + '-center');
      centerFilter.setAttribute('x', '-20%'); centerFilter.setAttribute('y', '-20%');
      centerFilter.setAttribute('width', '140%'); centerFilter.setAttribute('height', '140%');
      const cBlur = document.createElementNS(svgNS, 'feGaussianBlur');
      cBlur.setAttribute('in', 'SourceAlpha'); cBlur.setAttribute('stdDeviation', '2'); cBlur.setAttribute('result', 'cb');
      centerFilter.appendChild(cBlur);
      const cOff1 = document.createElementNS(svgNS, 'feOffset');
      cOff1.setAttribute('in', 'cb'); cOff1.setAttribute('dx', '-1.5'); cOff1.setAttribute('dy', '-1.5'); cOff1.setAttribute('result', 'cLO');
      centerFilter.appendChild(cOff1);
      const cF1 = document.createElementNS(svgNS, 'feFlood');
      cF1.setAttribute('flood-color', 'rgba(255,255,255,0.7)'); cF1.setAttribute('result', 'cLC');
      centerFilter.appendChild(cF1);
      const cC1 = document.createElementNS(svgNS, 'feComposite');
      cC1.setAttribute('in', 'cLC'); cC1.setAttribute('in2', 'cLO'); cC1.setAttribute('operator', 'in'); cC1.setAttribute('result', 'cLS');
      centerFilter.appendChild(cC1);
      const cOff2 = document.createElementNS(svgNS, 'feOffset');
      cOff2.setAttribute('in', 'cb'); cOff2.setAttribute('dx', '2'); cOff2.setAttribute('dy', '2'); cOff2.setAttribute('result', 'cDO');
      centerFilter.appendChild(cOff2);
      const cF2 = document.createElementNS(svgNS, 'feFlood');
      cF2.setAttribute('flood-color', 'rgba(0,0,0,0.12)'); cF2.setAttribute('result', 'cDC');
      centerFilter.appendChild(cF2);
      const cC2 = document.createElementNS(svgNS, 'feComposite');
      cC2.setAttribute('in', 'cDC'); cC2.setAttribute('in2', 'cDO'); cC2.setAttribute('operator', 'in'); cC2.setAttribute('result', 'cDS');
      centerFilter.appendChild(cC2);
      const cMerge = document.createElementNS(svgNS, 'feMerge');
      const cM1 = document.createElementNS(svgNS, 'feMergeNode'); cM1.setAttribute('in', 'cDS'); cMerge.appendChild(cM1);
      const cM2 = document.createElementNS(svgNS, 'feMergeNode'); cM2.setAttribute('in', 'cLS'); cMerge.appendChild(cM2);
      const cM3 = document.createElementNS(svgNS, 'feMergeNode'); cM3.setAttribute('in', 'SourceGraphic'); cMerge.appendChild(cM3);
      centerFilter.appendChild(cMerge);
      defs.appendChild(centerFilter);

      // Gradient: arc base color
      const arcGrad = document.createElementNS(svgNS, 'linearGradient');
      arcGrad.setAttribute('id', uid + '-ag');
      arcGrad.setAttribute('x1', '0'); arcGrad.setAttribute('y1', '0');
      arcGrad.setAttribute('x2', '1'); arcGrad.setAttribute('y2', '1');
      const agS1 = document.createElementNS(svgNS, 'stop');
      agS1.setAttribute('offset', '0%'); agS1.setAttribute('stop-color', s.color); agS1.setAttribute('stop-opacity', '0.85');
      arcGrad.appendChild(agS1);
      const agS2 = document.createElementNS(svgNS, 'stop');
      agS2.setAttribute('offset', '50%'); agS2.setAttribute('stop-color', s.color);
      arcGrad.appendChild(agS2);
      const agS3 = document.createElementNS(svgNS, 'stop');
      agS3.setAttribute('offset', '100%'); agS3.setAttribute('stop-color', s.color); agS3.setAttribute('stop-opacity', '0.7');
      arcGrad.appendChild(agS3);
      defs.appendChild(arcGrad);

      // Gradient: tube shine highlight
      const shineGrad = document.createElementNS(svgNS, 'linearGradient');
      shineGrad.setAttribute('id', uid + '-sh');
      shineGrad.setAttribute('x1', '0'); shineGrad.setAttribute('y1', '0');
      shineGrad.setAttribute('x2', '0'); shineGrad.setAttribute('y2', '1');
      const shS1 = document.createElementNS(svgNS, 'stop');
      shS1.setAttribute('offset', '0%'); shS1.setAttribute('stop-color', 'rgba(255,255,255,0.45)');
      shineGrad.appendChild(shS1);
      const shS2 = document.createElementNS(svgNS, 'stop');
      shS2.setAttribute('offset', '50%'); shS2.setAttribute('stop-color', 'rgba(255,255,255,0.05)');
      shineGrad.appendChild(shS2);
      const shS3 = document.createElementNS(svgNS, 'stop');
      shS3.setAttribute('offset', '100%'); shS3.setAttribute('stop-color', 'rgba(0,0,0,0.1)');
      shineGrad.appendChild(shS3);
      defs.appendChild(shineGrad);

      ringSvg.appendChild(defs);

      const cx = 48, cy = 48, r = 35, strokeW = 14, circumference = 2 * Math.PI * r;

      // Layer 1: Groove track
      const groove = document.createElementNS(svgNS, 'circle');
      groove.setAttribute('cx', cx); groove.setAttribute('cy', cy); groove.setAttribute('r', r);
      groove.setAttribute('fill', 'none');
      groove.setAttribute('stroke', 'var(--bg-tertiary)');
      groove.setAttribute('stroke-width', String(strokeW));
      groove.setAttribute('filter', `url(#${uid}-groove)`);
      ringSvg.appendChild(groove);

      // Layer 2: Convex center disc
      const centerDisc = document.createElementNS(svgNS, 'circle');
      centerDisc.setAttribute('cx', cx); centerDisc.setAttribute('cy', cy);
      centerDisc.setAttribute('r', String(r - strokeW / 2 - 2));
      centerDisc.setAttribute('fill', 'var(--bg-card)');
      centerDisc.setAttribute('filter', `url(#${uid}-center)`);
      ringSvg.appendChild(centerDisc);

      // Layer 3: Progress arc (base)
      const arcBase = document.createElementNS(svgNS, 'circle');
      arcBase.setAttribute('cx', cx); arcBase.setAttribute('cy', cy); arcBase.setAttribute('r', r);
      arcBase.setAttribute('fill', 'none');
      arcBase.setAttribute('stroke', `url(#${uid}-ag)`);
      arcBase.setAttribute('stroke-width', String(strokeW - 2));
      arcBase.setAttribute('stroke-linecap', 'round');
      arcBase.setAttribute('stroke-dasharray', `${(s.pct / 100) * circumference} ${circumference}`);
      arcBase.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
      arcBase.style.transition = 'stroke-dasharray 0.8s ease';
      ringSvg.appendChild(arcBase);

      // Layer 4: Shine highlight on arc (3D tube effect)
      const arcShine = document.createElementNS(svgNS, 'circle');
      arcShine.setAttribute('cx', cx); arcShine.setAttribute('cy', cy); arcShine.setAttribute('r', r);
      arcShine.setAttribute('fill', 'none');
      arcShine.setAttribute('stroke', `url(#${uid}-sh)`);
      arcShine.setAttribute('stroke-width', String(strokeW - 4));
      arcShine.setAttribute('stroke-linecap', 'round');
      arcShine.setAttribute('stroke-dasharray', `${(s.pct / 100) * circumference} ${circumference}`);
      arcShine.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
      arcShine.style.transition = 'stroke-dasharray 0.8s ease';
      ringSvg.appendChild(arcShine);

      // Percentage text
      const pctText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      pctText.setAttribute('x', cx); pctText.setAttribute('y', cy + 1);
      pctText.setAttribute('text-anchor', 'middle'); pctText.setAttribute('dominant-baseline', 'central');
      pctText.setAttribute('font-size', '14'); pctText.setAttribute('font-weight', '700');
      pctText.setAttribute('fill', 'var(--text-primary)');
      pctText.setAttribute('font-family', 'var(--font-family)');
      pctText.textContent = s.pct + '%';
      ringSvg.appendChild(pctText);
      card.appendChild(ringSvg);

      cardsGrid.appendChild(card);
    }

    // Row 3: 4 more stats
    const row3Stats = [
      { label: '时间跨度', value: stats.daySpan },
      { label: '最长连续天数', value: stats.longestStreak },
      { label: '系统标记', value: stats.totalFlags },
      { label: '深夜对话', value: stats.lateNightConvs },
    ];

    for (const s of row3Stats) {
      const card = this._neuCard();
      const label = document.createElement('div');
      label.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;';
      label.textContent = s.label;
      card.appendChild(label);
      const val = document.createElement('div');
      val.style.cssText = 'font-size:1.8rem;font-weight:800;color:var(--text-primary);letter-spacing:-0.5px;';
      val.textContent = String(s.value);
      card.appendChild(val);
      cardsGrid.appendChild(card);
    }

    parent.appendChild(cardsGrid);

    // ---- First & Last Conversation (cards float directly) ----
    if (stats.firstConv && stats.lastConv) {
      const milestoneRow = document.createElement('div');
      milestoneRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;';

      milestoneRow.appendChild(this._milestoneCard('第一段对话', stats.firstConv.name || '未命名', formatTimestamp(stats.firstConv.createdAt)));
      milestoneRow.appendChild(this._milestoneCard('最近一段对话', stats.lastConv.name || '未命名', formatTimestamp(stats.lastConv.createdAt)));

      parent.appendChild(milestoneRow);
    }

    // ---- Year Overview (cards float directly) ----
    if (stats.yearlyData && stats.yearlyData.length > 0) {
      parent.appendChild(this._sectionTitle('年度总览'));
      const yearGrid = document.createElement('div');
      yearGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;';
      for (const yr of stats.yearlyData) {
        const card = this._neuCard();
        const yearLabel = document.createElement('div');
        yearLabel.style.cssText = 'font-size:1.2rem;font-weight:700;color:var(--accent);margin-bottom:10px;';
        yearLabel.textContent = yr.year + ' 年';
        card.appendChild(yearLabel);
        const rows = [
          ['对话数', yr.convCount],
          ['消息数', yr.msgCount.toLocaleString()],
          ['总字数', (yr.humanChars + yr.assistantChars).toLocaleString()],
          ['活跃天数', yr.activeDays + ' 天'],
          ['思考次数', yr.thinkingCount.toLocaleString()],
        ];
        for (const [label, value] of rows) {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;justify-content:space-between;font-size:0.8rem;padding:3px 0;';
          const l = document.createElement('span');
          l.style.color = 'var(--text-muted)';
          l.textContent = label;
          row.appendChild(l);
          const v = document.createElement('span');
          v.style.cssText = 'color:var(--text-primary);font-weight:500;';
          v.textContent = value;
          row.appendChild(v);
          card.appendChild(row);
        }
        yearGrid.appendChild(card);
      }
      parent.appendChild(yearGrid);
    }

    // ---- GitHub-style Heatmap (in a single raised card) ----
    if (stats.dateHeatmap && Object.keys(stats.dateHeatmap).length > 0) {
      parent.appendChild(this._sectionTitle('对话热力图'));
      const heatCard = this._neuCard();
      heatCard.appendChild(this._buildHeatmapCalendar(stats.dateHeatmap));
      heatCard.style.marginBottom = '20px';
      parent.appendChild(heatCard);
    }

    // ---- TOP 5 Longest Conversations (in a single raised card) ----
    parent.appendChild(this._sectionTitle('TOP 5 最长对话'));
    const topCard = this._neuCard();
    topCard.style.marginBottom = '20px';
    topCard.style.padding = '8px 0';
    for (let i = 0; i < Math.min(5, stats.topConversations.length); i++) {
      const conv = stats.topConversations[i];
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;justify-content:space-between;padding:10px 20px;font-size:0.85rem;cursor:pointer;border-radius:var(--radius-sm);transition:background 0.15s;';
      if (i < Math.min(5, stats.topConversations.length) - 1) item.style.borderBottom = '1px solid var(--separator-color)';
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
        if (idx >= 0) { state.set('viewMode', 'conversation'); state.set('currentConversationIndex', idx); }
        this.hide();
      });
      topCard.appendChild(item);
    }
    parent.appendChild(topCard);

    // ---- Deep Night Ranking (in a single raised card) ----
    if (stats.deepNightConvs.length > 0) {
      parent.appendChild(this._sectionTitle('深夜对话榜（凌晨2-5点）'));
      const nightCard = this._neuCard();
      nightCard.style.marginBottom = '20px';
      nightCard.style.padding = '8px 0';
      for (let i = 0; i < Math.min(5, stats.deepNightConvs.length); i++) {
        const item = stats.deepNightConvs[i];
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;padding:8px 20px;font-size:0.85rem;';
        if (i < Math.min(5, stats.deepNightConvs.length) - 1) row.style.borderBottom = '1px solid var(--separator-color)';
        const name = document.createElement('span');
        name.style.cssText = 'color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;margin-right:12px;';
        name.textContent = '\uD83C\uDF19 ' + (item.name || '未命名');
        row.appendChild(name);
        const count = document.createElement('span');
        count.style.cssText = 'color:var(--text-muted);white-space:nowrap;';
        count.textContent = item.lateCount + ' 条深夜消息';
        row.appendChild(count);
        nightCard.appendChild(row);
      }
      parent.appendChild(nightCard);
    }

    // ---- Weekday Distribution ----
    // ---- Weekday + Hourly side by side ----
    const activityRow = document.createElement('div');
    activityRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;';

    // Weekday: neumorphic groove bars (slot track + pill inside)
    const weekdayCard = this._neuCard();
    const weekdayTitle = document.createElement('div');
    weekdayTitle.style.cssText = 'font-size:0.85rem;font-weight:600;color:var(--text-primary);margin-bottom:16px;';
    weekdayTitle.textContent = '星期几最爱聊天';
    weekdayCard.appendChild(weekdayTitle);
    const weekdayBar = document.createElement('div');
    weekdayBar.style.cssText = 'display:flex;gap:22px;justify-content:center;height:170px;';
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const maxWeekday = Math.max(...stats.weekdayActivity, 1);
    const trackH = 140;
    for (let d = 0; d < 7; d++) {
      const col = document.createElement('div');
      col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;';
      // Groove track (inset shadow slot)
      const track = document.createElement('div');
      track.style.cssText = `width:24px;height:${trackH}px;border-radius:12px;background:var(--bg-tertiary);box-shadow:var(--shadow-inset);position:relative;`;
      // Data pill — same width as groove, soft 3D with center-left highlight
      const fillH = Math.max(14, (stats.weekdayActivity[d] / maxWeekday) * (trackH - 20));
      const fill = document.createElement('div');
      fill.style.cssText = `width:22px;height:${fillH}px;border-radius:11px;position:absolute;bottom:1px;left:1px;transition:height 0.3s ease;`
        + 'background:linear-gradient(90deg, '
        + 'var(--accent-light) 0%, '
        + 'color-mix(in srgb, var(--accent-light) 85%, #fff) 30%, '
        + 'var(--accent) 60%, '
        + 'color-mix(in srgb, var(--accent) 88%, #333) 100%);'
        + 'box-shadow:'
        + 'inset 3px 2px 6px rgba(255,255,255,0.3),'
        + 'inset -1px -1px 4px rgba(0,0,0,0.1);';
      fill.title = stats.weekdayActivity[d] + ' 条消息';
      track.appendChild(fill);
      col.appendChild(track);
      const label = document.createElement('div');
      label.style.cssText = 'font-size:0.65rem;color:var(--text-muted);';
      label.textContent = weekdays[d];
      col.appendChild(label);
      weekdayBar.appendChild(col);
    }
    weekdayCard.appendChild(weekdayBar);
    activityRow.appendChild(weekdayCard);

    // Hourly Activity
    if (stats.hourlyActivity.some(v => v > 0)) {
      const hourCard = this._neuCard();
      const hourTitle = document.createElement('div');
      hourTitle.style.cssText = 'font-size:0.85rem;font-weight:600;color:var(--text-primary);margin-bottom:16px;';
      hourTitle.textContent = '每日活跃时段';
      hourCard.appendChild(hourTitle);
      const heatmap = document.createElement('div');
      heatmap.style.cssText = 'display:grid;grid-template-columns:repeat(12,1fr);grid-template-rows:repeat(2,1fr);gap:4px;margin-bottom:8px;';
      const maxHour = Math.max(...stats.hourlyActivity);
      for (let h = 0; h < 24; h++) {
        const cell = document.createElement('div');
        const intensity = maxHour > 0 ? stats.hourlyActivity[h] / maxHour : 0;
        cell.style.cssText = `aspect-ratio:1;border-radius:8px;background:var(--accent);opacity:${Math.max(0.06, intensity * 0.85)};transition:opacity 0.15s;`;
        cell.title = `${h}:00 — ${stats.hourlyActivity[h]} 条消息`;
        cell.addEventListener('mouseenter', () => cell.style.opacity = '1');
        cell.addEventListener('mouseleave', () => cell.style.opacity = String(Math.max(0.06, intensity * 0.85)));
        heatmap.appendChild(cell);
      }
      hourCard.appendChild(heatmap);
      const hourLabels = document.createElement('div');
      hourLabels.style.cssText = 'display:grid;grid-template-columns:repeat(12,1fr);gap:4px;';
      for (let h = 0; h < 24; h += 2) {
        const label = document.createElement('div');
        label.style.cssText = 'text-align:center;font-size:0.6rem;color:var(--text-muted);';
        label.textContent = h % 6 === 0 ? h + ':00' : '';
        hourLabels.appendChild(label);
      }
      hourCard.appendChild(hourLabels);
      activityRow.appendChild(hourCard);
    }
    parent.appendChild(activityRow);

    // ---- Monthly Charts (side by side, each in a raised card) ----
    if (stats.monthlyData.labels.length > 1) {
      const chartsRow = document.createElement('div');
      chartsRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;';

      const chartCard1 = this._neuCard();
      const chartTitle1 = document.createElement('div');
      chartTitle1.style.cssText = 'font-size:0.85rem;font-weight:600;color:var(--text-primary);margin-bottom:12px;';
      chartTitle1.textContent = '每月对话频率';
      chartCard1.appendChild(chartTitle1);
      const canvas1 = document.createElement('canvas');
      canvas1.style.cssText = 'width:100%;height:180px;';
      chartCard1.appendChild(canvas1);
      chartsRow.appendChild(chartCard1);

      const chartCard2 = this._neuCard();
      const chartTitle2 = document.createElement('div');
      chartTitle2.style.cssText = 'font-size:0.85rem;font-weight:600;color:var(--text-primary);margin-bottom:12px;';
      chartTitle2.textContent = '每月字数';
      chartCard2.appendChild(chartTitle2);
      const canvas2 = document.createElement('canvas');
      canvas2.style.cssText = 'width:100%;height:180px;';
      chartCard2.appendChild(canvas2);
      chartsRow.appendChild(chartCard2);

      parent.appendChild(chartsRow);
      requestAnimationFrame(() => {
        drawLineChart(canvas1, { labels: stats.monthlyData.labels, values: stats.monthlyData.convCounts }, {});
        drawBarChart(canvas2, {
          labels: stats.monthlyData.labels,
          series: [
            { name: names.human || 'Human', values: stats.monthlyData.humanChars, color: '#7c6eea' },
            { name: names.assistant || 'Assistant', values: stats.monthlyData.assistantChars, color: '#da7756' },
          ],
        }, {});
      });
    }

    // ---- Word Cloud (Top Words) — in a raised card ----
    if (stats.topHumanWords.length > 0 || stats.topAssistantWords.length > 0) {
      const wordTitleRow = document.createElement('div');
      wordTitleRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;';
      const wordTitle = this._sectionTitle('高频词');
      wordTitle.style.marginBottom = '0';
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
      wordCard.style.marginBottom = '20px';

      // Two columns
      const columns = document.createElement('div');
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
      emojiCard.style.marginBottom = '20px';
      const emojiRow = document.createElement('div');
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
      thinkGrid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;';
      const thinkStats = [
        { label: '总思考次数', value: stats.totalThinkingCount.toLocaleString() + ' 次' },
        { label: '累计思考时间', value: this.formatMs(stats.totalThinkingMs) },
        { label: '最长单次思考', value: this.formatMs(stats.longestThinkingMs) },
        { label: '平均思考时间', value: this.formatMs(stats.totalThinkingCount > 0 ? Math.round(stats.totalThinkingMs / stats.totalThinkingCount) : 0) },
      ];
      for (const s of thinkStats) {
        const card = this._neuCard();
        const label = document.createElement('div');
        label.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;';
        label.textContent = s.label;
        card.appendChild(label);
        const val = document.createElement('div');
        val.style.cssText = 'font-size:1.2rem;font-weight:600;color:var(--thinking-text);';
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
      titleCard.style.marginBottom = '20px';
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
          const dayKey = date.toISOString().slice(0, 10);
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
        if (msg.createdAt) yr.activeDaysSet.add(new Date(msg.createdAt).toISOString().slice(0, 10));
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
    el.style.cssText = 'background:var(--bg-card);border-radius:var(--radius-lg);padding:20px;margin-bottom:20px;box-shadow:var(--shadow);';
    return el;
  }

  /** Neumorphic card — convex / raised (matching Figma design) */
  _neuCard() {
    const el = document.createElement('div');
    el.style.cssText = 'background:var(--bg-card);border-radius:var(--radius-lg);padding:20px 22px;text-align:left;box-shadow:var(--shadow);';
    return el;
  }

  _sectionTitle(text) {
    const el = document.createElement('h3');
    el.style.cssText = 'font-size:1.1rem;font-weight:700;margin-bottom:14px;margin-top:8px;color:var(--text-primary);';
    el.textContent = text;
    return el;
  }

  _milestoneCard(label, name, time) {
    const card = this._neuCard();
    card.style.textAlign = 'left';
    card.style.padding = '14px';
    const labelEl = document.createElement('div');
    labelEl.style.cssText = 'font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;';
    labelEl.textContent = label;
    card.appendChild(labelEl);
    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:0.9rem;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    nameEl.textContent = name;
    card.appendChild(nameEl);
    const timeEl = document.createElement('div');
    timeEl.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-top:2px;';
    timeEl.textContent = time;
    card.appendChild(timeEl);
    return card;
  }

  _buildHeatmapCalendar(dateHeatmap) {
    const container = document.createElement('div');
    container.style.cssText = 'margin-bottom:28px;overflow-x:auto;';

    const dates = Object.keys(dateHeatmap).sort();
    if (dates.length === 0) return container;

    const latest = new Date(dates[dates.length - 1]);
    const start = new Date(latest);
    start.setDate(start.getDate() - 364);
    start.setDate(start.getDate() - start.getDay()); // Align to Sunday

    const maxCount = Math.max(...Object.values(dateHeatmap), 1);
    const CELL = 11, GAP = 2;
    const weekdays = ['', '周一', '', '周三', '', '周五', ''];

    // Outer wrapper with weekday labels on the left
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;gap:4px;';

    // Weekday labels column
    const weekdayLabels = document.createElement('div');
    weekdayLabels.style.cssText = `display:flex;flex-direction:column;gap:${GAP}px;justify-content:flex-start;padding-top:${CELL + GAP + 4}px;`;
    for (let d = 0; d < 7; d++) {
      const label = document.createElement('div');
      label.style.cssText = `height:${CELL}px;font-size:0.6rem;color:var(--text-muted);display:flex;align-items:center;line-height:1;`;
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
        const dayKey = current.toISOString().slice(0, 10);
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
        const opacity = cell.count === 0 ? '0.15' : (0.25 + intensity * 0.75).toFixed(2);
        el.style.cssText = `width:${CELL}px;height:${CELL}px;border-radius:2px;background:${cell.count === 0 ? 'var(--bg-secondary)' : 'var(--accent)'};opacity:${opacity};`;
        el.title = cell.dayKey + ': ' + cell.count + ' 条消息';
        weekCol.appendChild(el);
      }
      grid.appendChild(weekCol);
    }

    gridArea.appendChild(grid);

    // Legend
    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;align-items:center;gap:4px;margin-top:8px;justify-content:flex-end;font-size:0.6rem;color:var(--text-muted);';
    legend.appendChild(document.createTextNode('Less'));
    const levels = [0.15, 0.35, 0.55, 0.75, 1.0];
    for (const lv of levels) {
      const box = document.createElement('div');
      box.style.cssText = `width:${CELL}px;height:${CELL}px;border-radius:2px;background:${lv === 0.15 ? 'var(--bg-secondary)' : 'var(--accent)'};opacity:${lv};`;
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
}
