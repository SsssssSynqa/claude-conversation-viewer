/**
 * Time formatting utilities.
 */

export function formatTimestamp(iso) {
  if (!iso) return '未知时间';
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '未知时间';
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return '未知时间';
  }
}

export function formatShortTime(iso) {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

export function formatDate(iso) {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (e) {
    return '';
  }
}

export function formatLocalDateStamp(dateInput = new Date()) {
  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  } catch (e) {
    return '';
  }
}

export function formatMonthKey(iso) {
  if (!iso) return 'unknown';
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return 'unknown';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  } catch (e) {
    return 'unknown';
  }
}

export function formatMonthLabel(monthKey) {
  if (monthKey === 'unknown') return '未知日期';
  const [year, month] = monthKey.split('-');
  return `${year}年${parseInt(month)}月`;
}

export function formatDuration(startIso, stopIso) {
  if (!startIso || !stopIso) return '';
  try {
    const start = new Date(startIso);
    const stop = new Date(stopIso);
    const ms = stop - start;
    if (ms < 0 || isNaN(ms)) return '';
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainSec = Math.floor(seconds % 60);
    return `${minutes}m${remainSec}s`;
  } catch (e) {
    return '';
  }
}

export function getTimeDiffMinutes(iso1, iso2) {
  try {
    const d1 = new Date(iso1);
    const d2 = new Date(iso2);
    return Math.abs(d2 - d1) / (1000 * 60);
  } catch (e) {
    return 0;
  }
}

export function getHourOfDay(iso) {
  try {
    return new Date(iso).getHours();
  } catch (e) {
    return 0;
  }
}
