/**
 * Lightweight canvas chart drawing — neumorphic style.
 * Clean line and bar charts matching the Figma design aesthetic.
 */

/**
 * Draw a clean line chart with gradient fill, smooth curve, and dots.
 */
export function drawLineChart(canvas, data, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 80 || h < 80) return null;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const padding = { top: 20, right: 20, bottom: 36, left: 44 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const maxVal = Math.max(...data.values, 1);
  const styles = getComputedStyle(document.documentElement);
  const color = opts.color || styles.getPropertyValue('--stats-trend').trim() || '#b96145';
  const textColor = styles.getPropertyValue('--text-muted').trim() || 'rgba(128,128,128,0.8)';
  const gridColor = styles.getPropertyValue('--stats-grid').trim() || 'rgba(128,128,128,0.12)';
  const pointCenter = styles.getPropertyValue('--bg-card').trim() || '#faf9f5';
  const chartFont = styles.getPropertyValue('--stats-font-ui').trim() || 'system-ui, sans-serif';

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 3]);
  ctx.font = `11px ${chartFont}`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
    ctx.fillText(String(Math.round(maxVal - (maxVal / 4) * i)), padding.left - 8, y + 3);
  }
  ctx.setLineDash([]);

  if (data.values.length < 2) return null;
  const stepX = chartW / (data.values.length - 1);
  const points = data.values.map((value, index) => ({
    x: padding.left + stepX * index,
    y: padding.top + chartH - (value / maxVal) * chartH,
    value,
  }));

  const tracePath = () => {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];
      const tension = 0.3;
      ctx.bezierCurveTo(
        p1.x + (p2.x - p0.x) * tension,
        p1.y + (p2.y - p0.y) * tension,
        p2.x - (p3.x - p1.x) * tension,
        p2.y - (p3.y - p1.y) * tension,
        p2.x,
        p2.y,
      );
    }
  };

  ctx.beginPath();
  tracePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
  gradient.addColorStop(0, withAlpha(color, 0.1255));
  gradient.addColorStop(1, withAlpha(color, 0.0078));
  ctx.lineTo(points.at(-1).x, padding.top + chartH);
  ctx.lineTo(points[0].x, padding.top + chartH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = pointCenter;
    ctx.fill();
  }

  const activeIndex = Number.isInteger(opts.activeIndex) ? opts.activeIndex : null;
  if (activeIndex != null && points[activeIndex]) {
    const active = points[activeIndex];
    ctx.beginPath();
    ctx.moveTo(active.x, padding.top);
    ctx.lineTo(active.x, padding.top + chartH);
    ctx.strokeStyle = withAlpha(color, 0.34);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(active.x, active.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = pointCenter;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.fillStyle = textColor;
  ctx.font = `10px ${chartFont}`;
  ctx.textAlign = 'center';
  const labelSkip = Math.max(1, Math.floor(data.labels.length / 8));
  for (let i = 0; i < data.labels.length; i += labelSkip) {
    ctx.fillText(data.labels[i], points[i].x, h - padding.bottom + 14);
  }

  return {
    hitTest(x) {
      if (x < padding.left - stepX / 2 || x > w - padding.right + stepX / 2) return null;
      return Math.max(0, Math.min(points.length - 1, Math.round((x - padding.left) / stepX)));
    },
    getAnchor(index) {
      return points[index] ? { x: points[index].x, y: points[index].y } : null;
    },
  };
}

/**
 * Draw two comparable monthly series as quiet translucent ribbons.
 * The chart deliberately avoids individual bar tracks so the overall rhythm is visible first.
 */
export function drawAreaComparisonChart(canvas, data, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 80 || h < 80) return null;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const padding = { top: 18, right: 18, bottom: 34, left: 50 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const styles = getComputedStyle(document.documentElement);
  const textColor = styles.getPropertyValue('--text-muted').trim() || 'rgba(128,128,128,0.8)';
  const gridColor = styles.getPropertyValue('--stats-grid').trim() || 'rgba(128,128,128,0.12)';
  const chartFont = styles.getPropertyValue('--stats-font-ui').trim() || 'system-ui, sans-serif';
  const maxVal = Math.max(...data.series.flatMap(series => series.values), 1);

  ctx.font = `10px ${chartFont}`;
  ctx.fillStyle = textColor;
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.6;
  ctx.textAlign = 'right';
  for (let i = 0; i <= 3; i++) {
    const y = padding.top + (chartH / 3) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
    ctx.fillText(formatNumber(maxVal - (maxVal / 3) * i), padding.left - 9, y + 3);
  }

  if (data.labels.length < 2) return null;
  const stepX = chartW / (data.labels.length - 1);
  const allPoints = [];

  data.series.forEach((series, seriesIndex) => {
    const points = series.values.map((value, index) => ({
      x: padding.left + stepX * index,
      y: padding.top + chartH - (value / maxVal) * chartH,
    }));
    allPoints.push(points);

    const tracePath = () => {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        const midX = (current.x + next.x) / 2;
        ctx.bezierCurveTo(midX, current.y, midX, next.y, next.x, next.y);
      }
    };

    ctx.beginPath();
    tracePath();
    ctx.lineTo(points.at(-1).x, padding.top + chartH);
    ctx.lineTo(points[0].x, padding.top + chartH);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, withAlpha(series.color, seriesIndex === 0 ? 0.24 : 0.18));
    gradient.addColorStop(1, withAlpha(series.color, 0.015));
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    tracePath();
    ctx.strokeStyle = series.color;
    ctx.lineWidth = seriesIndex === 0 ? 2.2 : 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  });

  const activeIndex = Number.isInteger(opts.activeIndex) ? opts.activeIndex : null;
  if (activeIndex != null && allPoints[0]?.[activeIndex]) {
    const activeX = allPoints[0][activeIndex].x;
    ctx.beginPath();
    ctx.moveTo(activeX, padding.top);
    ctx.lineTo(activeX, padding.top + chartH);
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    data.series.forEach((series, seriesIndex) => {
      const point = allPoints[seriesIndex][activeIndex];
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = styles.getPropertyValue('--bg-card').trim() || '#fff';
      ctx.fill();
      ctx.strokeStyle = series.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });
  }

  ctx.fillStyle = textColor;
  ctx.font = `10px ${chartFont}`;
  ctx.textAlign = 'center';
  const labelSkip = Math.max(1, Math.ceil(data.labels.length / 9));
  for (let i = 0; i < data.labels.length; i += labelSkip) {
    ctx.fillText(data.labels[i], padding.left + stepX * i, h - 11);
  }

  return {
    hitTest(x) {
      if (x < padding.left - stepX / 2 || x > w - padding.right + stepX / 2) return null;
      return Math.max(0, Math.min(data.labels.length - 1, Math.round((x - padding.left) / stepX)));
    },
    getAnchor(index) {
      const points = allPoints.map(series => series[index]).filter(Boolean);
      if (!points.length) return null;
      return { x: points[0].x, y: Math.min(...points.map(point => point.y)) };
    },
  };
}

/**
 * Draw a 24-hour radial clock. The circular structure makes the daily cycle legible at a glance,
 * while each ray keeps the exact hour value available as a proportional length.
 */
export function drawRadialActivityChart(canvas, values, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 80 || h < 80) return null;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const styles = getComputedStyle(document.documentElement);
  const color = opts.color || styles.getPropertyValue('--stats-human').trim() || '#d67858';
  const trackColor = styles.getPropertyValue('--stats-track').trim() || 'rgba(128,128,128,0.12)';
  const gridColor = styles.getPropertyValue('--stats-grid').trim() || 'rgba(128,128,128,0.12)';
  const textColor = styles.getPropertyValue('--text-primary').trim() || '#252321';
  const mutedColor = styles.getPropertyValue('--text-muted').trim() || '#7b7771';
  const chartFont = styles.getPropertyValue('--stats-font-ui').trim() || 'system-ui, sans-serif';
  const dataFont = styles.getPropertyValue('--stats-font-data').trim() || chartFont;

  const centerX = w / 2;
  const centerY = h / 2 + 4;
  const outerLimit = Math.min(w, h) / 2 - 24;
  const innerRadius = Math.min(64, outerLimit * 0.48);
  const minRay = Math.max(13, outerLimit * 0.11);
  const maxRay = Math.max(38, outerLimit - innerRadius - minRay - 6);
  const maxValue = Math.max(...values, 1);
  const peakValue = Math.max(...values);
  const peakHour = Math.max(0, values.indexOf(peakValue));
  const activeHour = Number.isInteger(opts.activeIndex) ? opts.activeIndex : null;

  ctx.lineCap = 'round';
  for (let hour = 0; hour < 24; hour++) {
    const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
    const start = innerRadius + 13;
    const intensity = values[hour] / maxValue;
    const trackEnd = start + minRay + maxRay;
    const valueEnd = start + minRay + maxRay * intensity;

    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * start, centerY + Math.sin(angle) * start);
    ctx.lineTo(centerX + Math.cos(angle) * trackEnd, centerY + Math.sin(angle) * trackEnd);
    ctx.strokeStyle = withAlpha(trackColor, 0.72);
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * start, centerY + Math.sin(angle) * start);
    ctx.lineTo(centerX + Math.cos(angle) * valueEnd, centerY + Math.sin(angle) * valueEnd);
    ctx.strokeStyle = withAlpha(color, 0.38 + intensity * 0.62);
    ctx.lineWidth = hour === activeHour ? 10 : hour === peakHour ? 8 : 6;
    ctx.stroke();

    if (hour === activeHour) {
      ctx.beginPath();
      ctx.arc(centerX + Math.cos(angle) * valueEnd, centerY + Math.sin(angle) * valueEnd, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  const markers = [
    { hour: 0, label: '0  夜' },
    { hour: 6, label: '6  晨' },
    { hour: 12, label: '12  昼' },
    { hour: 18, label: '18  暮' },
  ];
  ctx.font = `500 11px ${chartFont}`;
  ctx.fillStyle = mutedColor;
  for (const marker of markers) {
    const angle = (marker.hour / 24) * Math.PI * 2 - Math.PI / 2;
    const radius = outerLimit + 11;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    ctx.textAlign = marker.hour === 6 ? 'left' : marker.hour === 18 ? 'right' : 'center';
    ctx.textBaseline = marker.hour === 0 ? 'bottom' : marker.hour === 12 ? 'top' : 'middle';
    ctx.fillText(marker.label, x, y);
  }

  const centerHour = activeHour ?? peakHour;
  const centerValue = values[centerHour] || 0;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = mutedColor;
  ctx.font = `500 10px ${chartFont}`;
  ctx.fillText(activeHour == null ? '活跃峰值' : '当前时段', centerX, centerY - 24);
  ctx.fillStyle = textColor;
  ctx.font = `${activeHour == null ? 500 : 600} 25px ${dataFont}`;
  ctx.fillText(`${centerHour}:00`, centerX, centerY + 1);
  ctx.fillStyle = color;
  ctx.font = `600 10px ${chartFont}`;
  ctx.fillText(`${centerValue.toLocaleString()} 条消息`, centerX, centerY + 28);

  return {
    hitTest(x, y) {
      const dx = x - centerX;
      const dy = y - centerY;
      const radius = Math.hypot(dx, dy);
      if (radius < innerRadius || radius > outerLimit + 20) return null;
      const normalized = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
      return Math.round(normalized / (Math.PI * 2) * 24) % 24;
    },
    getAnchor(hour) {
      if (hour == null) return null;
      const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
      const intensity = values[hour] / maxValue;
      const radius = innerRadius + 13 + minRay + maxRay * intensity;
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    },
  };
}

/**
 * Draw a grouped bar chart with rounded bars.
 */
export function drawBarChart(canvas, data, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const padding = { top: 20, right: 20, bottom: 50, left: 52 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const styles = getComputedStyle(document.documentElement);
  const textColor = styles.getPropertyValue('--text-muted').trim() || 'rgba(128,128,128,0.8)';
  const gridColor = styles.getPropertyValue('--stats-grid').trim() || 'rgba(128,128,128,0.12)';
  const chartFont = styles.getPropertyValue('--stats-font-ui').trim() || 'system-ui, sans-serif';

  // Max stacked value
  let maxVal = 0;
  for (let i = 0; i < data.labels.length; i++) {
    let sum = 0;
    for (const s of data.series) sum += s.values[i] || 0;
    if (sum > maxVal) maxVal = sum;
  }
  maxVal = maxVal || 1;

  // Grid
  const gridLines = 4;
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 3]);
  ctx.font = `11px ${chartFont}`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'right';
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
    const val = maxVal - (maxVal / gridLines) * i;
    ctx.fillText(formatNumber(val), padding.left - 8, y + 3);
  }
  ctx.setLineDash([]);

  // Bars — grouped side by side with rounded tops
  const groupGap = 6;
  const groupWidth = (chartW / data.labels.length) - groupGap;
  const barWidth = Math.max(4, groupWidth / data.series.length - 2);
  const barRadius = Math.min(3, barWidth / 2);

  for (let i = 0; i < data.labels.length; i++) {
    const groupX = padding.left + i * (groupWidth + groupGap) + groupGap / 2;
    for (let si = 0; si < data.series.length; si++) {
      const s = data.series[si];
      const val = s.values[i] || 0;
      const barH = (val / maxVal) * chartH;
      const x = groupX + si * (barWidth + 2);
      const y = padding.top + chartH - barH;

      if (barH > 0) {
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, [barRadius, barRadius, 0, 0]);
        ctx.fillStyle = s.color;
        ctx.fill();
      }
    }
  }

  // X labels
  ctx.fillStyle = textColor;
  ctx.font = `10px ${chartFont}`;
  ctx.textAlign = 'center';
  const labelSkip = Math.max(1, Math.floor(data.labels.length / 8));
  for (let i = 0; i < data.labels.length; i += labelSkip) {
    const x = padding.left + i * (groupWidth + groupGap) + groupGap / 2 + groupWidth / 2;
    ctx.fillText(data.labels[i], x, h - padding.bottom + 14);
  }

  // Legend (centered at bottom)
  ctx.font = `11px ${chartFont}`;
  let totalLegendW = 0;
  for (const s of data.series) totalLegendW += ctx.measureText(s.name).width + 28;
  let legendX = (w - totalLegendW) / 2;
  const legendY = h - 10;
  for (const s of data.series) {
    ctx.beginPath();
    ctx.roundRect(legendX, legendY - 8, 8, 8, 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.fillText(s.name, legendX + 12, legendY);
    legendX += ctx.measureText(s.name).width + 28;
  }
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.round(n).toString();
}

function withAlpha(color, alpha) {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const value = color.slice(1);
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
  return color;
}
