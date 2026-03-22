/**
 * Lightweight canvas chart drawing.
 * Simple line and bar charts without external dependencies.
 */

const CHART_COLORS = {
  line: '#7c6eea',
  barHuman: '#7c6eea',
  barAssistant: '#da7756',
  grid: 'rgba(128,128,128,0.15)',
  text: 'rgba(128,128,128,0.8)',
  bg: 'transparent',
};

/**
 * Draw a line chart on a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {{ labels: string[], values: number[] }} data
 * @param {{ title?: string, color?: string }} opts
 */
export function drawLineChart(canvas, data, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const maxVal = Math.max(...data.values, 1);
  const color = opts.color || CHART_COLORS.line;

  // Title
  if (opts.title) {
    ctx.fillStyle = CHART_COLORS.text;
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.title, w / 2, 16);
  }

  // Grid lines
  const gridLines = 4;
  ctx.strokeStyle = CHART_COLORS.grid;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    const val = Math.round(maxVal - (maxVal / gridLines) * i);
    ctx.fillStyle = CHART_COLORS.text;
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(val), padding.left - 8, y + 4);
  }
  ctx.setLineDash([]);

  if (data.values.length < 2) return;

  // Line
  const stepX = chartW / (data.values.length - 1);
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';

  for (let i = 0; i < data.values.length; i++) {
    const x = padding.left + stepX * i;
    const y = padding.top + chartH - (data.values[i] / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Fill area under line
  ctx.lineTo(padding.left + stepX * (data.values.length - 1), padding.top + chartH);
  ctx.lineTo(padding.left, padding.top + chartH);
  ctx.closePath();
  ctx.fillStyle = color.replace(')', ', 0.1)').replace('rgb', 'rgba');
  ctx.fill();

  // Dots
  for (let i = 0; i < data.values.length; i++) {
    const x = padding.left + stepX * i;
    const y = padding.top + chartH - (data.values[i] / maxVal) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // X labels
  ctx.fillStyle = CHART_COLORS.text;
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  const labelSkip = Math.max(1, Math.floor(data.labels.length / 8));
  for (let i = 0; i < data.labels.length; i += labelSkip) {
    const x = padding.left + stepX * i;
    ctx.fillText(data.labels[i], x, h - padding.bottom + 16);
  }
}

/**
 * Draw a stacked bar chart.
 * @param {HTMLCanvasElement} canvas
 * @param {{ labels: string[], series: { name: string, values: number[], color: string }[] }} data
 * @param {{ title?: string }} opts
 */
export function drawBarChart(canvas, data, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const padding = { top: 30, right: 20, bottom: 40, left: 60 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  // Find max stacked value
  let maxVal = 0;
  for (let i = 0; i < data.labels.length; i++) {
    let sum = 0;
    for (const s of data.series) sum += s.values[i] || 0;
    if (sum > maxVal) maxVal = sum;
  }
  maxVal = maxVal || 1;

  // Title
  if (opts.title) {
    ctx.fillStyle = CHART_COLORS.text;
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.title, w / 2, 16);
  }

  // Grid
  const gridLines = 4;
  ctx.strokeStyle = CHART_COLORS.grid;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    const val = maxVal - (maxVal / gridLines) * i;
    ctx.fillStyle = CHART_COLORS.text;
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatNumber(val), padding.left - 8, y + 4);
  }
  ctx.setLineDash([]);

  // Bars
  const barGap = 4;
  const barWidth = Math.max(4, (chartW / data.labels.length) - barGap);

  for (let i = 0; i < data.labels.length; i++) {
    let stackY = padding.top + chartH;
    for (const s of data.series) {
      const val = s.values[i] || 0;
      const barH = (val / maxVal) * chartH;
      ctx.fillStyle = s.color;
      ctx.fillRect(
        padding.left + i * (barWidth + barGap),
        stackY - barH,
        barWidth,
        barH
      );
      stackY -= barH;
    }
  }

  // X labels
  ctx.fillStyle = CHART_COLORS.text;
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  const labelSkip = Math.max(1, Math.floor(data.labels.length / 8));
  for (let i = 0; i < data.labels.length; i += labelSkip) {
    const x = padding.left + i * (barWidth + barGap) + barWidth / 2;
    ctx.fillText(data.labels[i], x, h - padding.bottom + 16);
  }

  // Legend
  let legendX = padding.left;
  const legendY = h - 8;
  ctx.font = '10px -apple-system, sans-serif';
  for (const s of data.series) {
    ctx.fillStyle = s.color;
    ctx.fillRect(legendX, legendY - 8, 10, 10);
    ctx.fillStyle = CHART_COLORS.text;
    ctx.textAlign = 'left';
    ctx.fillText(s.name, legendX + 14, legendY);
    legendX += ctx.measureText(s.name).width + 30;
  }
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.round(n).toString();
}
