/**
 * Claude spark logo SVG (hardcoded asset, safe for template.innerHTML).
 */
export const SPARK_SVG = '<svg overflow="visible" width="100%" height="100%" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M96 40L99.5 42l0 1.5-1 3.5-42.5 10-4-9.93L96 40z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(330deg) scaleY(1.09) rotate(-330deg)"/><path d="M80.1 10.59l4.9 1.03 1.3 1.6 1.24 3.84-.51 2.45L58.5 58.5 49 49l25.3-34.51 5.8-3.9z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(300deg) scaleY(.925) rotate(-300deg)"/><path d="M55.5 4.5l3-2 2.5 1 2.5 3.5-6.85 41.16L52 45l-2-5.5 3.5-31 2-4z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(270deg) scaleY(1.075) rotate(-270deg)"/><path d="M23.43 5.16l3.08-3.94 2.01-.46 3.99.58 1.97 1.54 14.35 31.8 5.19 15.11-6.07 3.38L24.8 11.19l-1.38-6.03z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(240deg) scaleY(.94) rotate(-240deg)"/><path d="M8.5 27l-1-4 3-3.5 3.5.5 1 0 21 15.5 6.5 5 9 7-5 8.5-4.5-3.5-3-3L10 29 8.5 27z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(210deg) scaleY(1.06) rotate(-210deg)"/><path d="M2.5 53L.24 50.5l0-2.22L2.5 47.5 28 49l25 2-.81 4.98L4.5 53.5 2.5 53z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(180deg) scaleY(.955) rotate(-180deg)"/><path d="M17.5 79.03H12.5l-2-2.29V74l8.5-6L53.5 46 57 52 17.5 79.03z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(150deg) scaleY(1.111) rotate(-150deg)"/><path d="M27 93l-2 .5-3-1.5.5-2.5L52 50.5 56 56 34 85l-7 8z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(120deg) scaleY(1.103) rotate(-120deg)"/><path d="M52 98l-1.5 2-3 1-2.5-2-1.5-3L51 56l4.5.5L52 98z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(90deg) scaleY(1.229) rotate(-90deg)"/><path d="M77.5 87v4l-.5 1.5-2 1-3.5-.47L47.47 57.26 57 50l8 14.5.75 5.25L77.5 87z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(60deg) scaleY(1.119) rotate(-60deg)"/><path d="M89 81l.5 2.5-1.5 2-1.5-.5-8.5-6-13-11.5-10-7 3-9.5 5 3 3 5.5 23 21.5z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(30deg) scaleY(1.082) rotate(-30deg)"/><path d="M82.5 55.5L95 56.5l3 2 2 3v2.16l-5.5 2.34L66.5 59 55 58.5l3-10.5 8 6 16.5 1.5z" fill="currentColor" style="transform-origin:50px 50px;transform:rotate(0deg) scaleY(.998) rotate(0deg)"/></svg>';

/**
 * Create a spark logo element (safe: hardcoded SVG, not user input).
 * @param {number} size - Size in pixels
 * @returns {HTMLElement}
 */
export function createSparkIcon(size = 20) {
  const span = document.createElement('span');
  span.style.cssText = `width:${size}px;height:${size}px;display:inline-flex;color:var(--accent);flex-shrink:0;`;
  // Safe: SPARK_SVG is a hardcoded constant, not user-supplied data
  const t = document.createElement('template');
  t.innerHTML = SPARK_SVG;
  span.appendChild(t.content);
  return span;
}
