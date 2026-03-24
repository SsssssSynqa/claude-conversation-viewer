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
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const padding = { top: 20, right: 20, bottom: 36, left: 44 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const maxVal = Math.max(...data.values, 1);
  const color = opts.color || '#7c6eea';
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || 'rgba(128,128,128,0.8)';
  const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || 'rgba(128,128,128,0.12)';

  // Grid lines (subtle)
  const gridLines = 4;
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 3]);
  ctx.font = '10px -apple-system, sans-serif';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'right';
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
    const val = Math.round(maxVal - (maxVal / gridLines) * i);
    ctx.fillText(String(val), padding.left - 8, y + 3);
  }
  ctx.setLineDash([]);

  if (data.values.length < 2) return;

  const stepX = chartW / (data.values.length - 1);

  // Build points array
  const points = data.values.map((v, i) => ({
    x: padding.left + stepX * i,
    y: padding.top + chartH - (v / maxVal) * chartH,
  }));

  // Smooth curve (cardinal spline)
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  // Stroke the line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Gradient fill under curve
  const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
  gradient.addColorStop(0, color + '20');
  gradient.addColorStop(1, color + '02');
  ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
  ctx.lineTo(points[0].x, padding.top + chartH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Dots with white center
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  // X labels
  ctx.fillStyle = textColor;
  ctx.font = '9px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  const labelSkip = Math.max(1, Math.floor(data.labels.length / 8));
  for (let i = 0; i < data.labels.length; i += labelSkip) {
    ctx.fillText(data.labels[i], points[i].x, h - padding.bottom + 14);
  }
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
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || 'rgba(128,128,128,0.8)';
  const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || 'rgba(128,128,128,0.12)';

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
  ctx.font = '10px -apple-system, sans-serif';
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
  ctx.font = '9px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  const labelSkip = Math.max(1, Math.floor(data.labels.length / 8));
  for (let i = 0; i < data.labels.length; i += labelSkip) {
    const x = padding.left + i * (groupWidth + groupGap) + groupGap / 2 + groupWidth / 2;
    ctx.fillText(data.labels[i], x, h - padding.bottom + 14);
  }

  // Legend (centered at bottom)
  ctx.font = '10px -apple-system, sans-serif';
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
