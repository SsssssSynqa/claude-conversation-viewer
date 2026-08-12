let chartId = 0;

/**
 * Adds a shared pointer, touch and keyboard interaction layer to a canvas chart.
 * `draw(activeIndex)` must redraw the canvas and return hit-test/anchor geometry.
 */
export function mountInteractiveCanvasChart({
  stage,
  canvas,
  title,
  itemCount,
  draw,
  formatTooltip,
  tableHeaders,
  tableRows,
}) {
  const id = `stats-chart-${++chartId}`;
  const tooltip = document.createElement('div');
  tooltip.id = `${id}-tooltip`;
  tooltip.className = 'stats-chart-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  stage.appendChild(tooltip);

  const live = document.createElement('div');
  live.id = `${id}-live`;
  live.className = 'visually-hidden';
  live.setAttribute('aria-live', 'polite');
  stage.appendChild(live);

  const table = buildAccessibleTable(`${id}-table`, `${title}完整数据`, tableHeaders, tableRows);
  stage.appendChild(table);

  canvas.tabIndex = 0;
  canvas.classList.add('stats-interactive-canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${title}。悬停或聚焦查看精确数据，点击或按 Enter 锁定，按 Escape 关闭。`);
  canvas.setAttribute('aria-describedby', `${live.id} ${table.id}`);

  let model = null;
  let hoverIndex = null;
  let keyboardIndex = null;
  let pinnedIndex = null;
  let resizeFrame = 0;
  let exporting = false;

  const currentIndex = () => pinnedIndex ?? keyboardIndex ?? hoverIndex;

  const render = () => {
    model = draw(exporting ? null : currentIndex());
    if (!exporting && currentIndex() != null) positionTooltip(currentIndex());
  };

  const showTooltip = (index, announce = false) => {
    if (index == null || index < 0 || index >= itemCount) {
      tooltip.hidden = true;
      canvas.removeAttribute('aria-activedescendant');
      return;
    }
    const content = formatTooltip(index);
    tooltip.textContent = '';
    const heading = document.createElement('strong');
    heading.className = 'stats-chart-tooltip-title';
    heading.textContent = content.title;
    tooltip.appendChild(heading);
    for (const line of content.lines) {
      const row = document.createElement('span');
      row.className = 'stats-chart-tooltip-row';
      if (line.color) {
        const swatch = document.createElement('i');
        swatch.className = 'stats-chart-tooltip-swatch';
        swatch.style.background = line.color;
        row.appendChild(swatch);
      }
      const label = document.createElement('span');
      label.textContent = line.label;
      row.appendChild(label);
      const value = document.createElement('b');
      value.textContent = line.value;
      row.appendChild(value);
      tooltip.appendChild(row);
    }
    tooltip.hidden = false;
    stage.classList.toggle('is-pinned', pinnedIndex != null);
    positionTooltip(index);
    if (announce) live.textContent = content.announcement || [content.title, ...content.lines.map(line => `${line.label}${line.value}`)].join('，');
  };

  const positionTooltip = (index) => {
    if (tooltip.hidden || !model?.getAnchor) return;
    const anchor = model.getAnchor(index);
    if (!anchor) return;
    const stageWidth = stage.clientWidth;
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const left = Math.max(8, Math.min(stageWidth - tooltipWidth - 8, anchor.x - tooltipWidth / 2));
    const preferAbove = anchor.y - tooltipHeight - 14 >= 4;
    const top = preferAbove ? anchor.y - tooltipHeight - 14 : anchor.y + 14;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(4, top)}px`;
    tooltip.dataset.placement = preferAbove ? 'top' : 'bottom';
  };

  const updateTransient = (index, source, announce = false) => {
    if (pinnedIndex != null && source !== 'keyboard') return;
    if (source === 'keyboard') keyboardIndex = index;
    else hoverIndex = index;
    render();
    showTooltip(index, announce);
  };

  const clearTransient = (source) => {
    if (source === 'keyboard') keyboardIndex = null;
    else hoverIndex = null;
    if (pinnedIndex == null) {
      tooltip.hidden = true;
      stage.classList.remove('is-pinned');
      render();
    }
  };

  const indexFromPointer = (event) => {
    if (!model?.hitTest) return null;
    const rect = canvas.getBoundingClientRect();
    return model.hitTest(event.clientX - rect.left, event.clientY - rect.top);
  };

  const handlePointerMove = (event) => {
    if (pinnedIndex != null) return;
    const index = indexFromPointer(event);
    if (index == null) return clearTransient('pointer');
    updateTransient(index, 'pointer');
  };

  const handleClick = (event) => {
    const index = indexFromPointer(event);
    if (index == null) return;
    pinnedIndex = pinnedIndex === index ? null : index;
    hoverIndex = index;
    keyboardIndex = null;
    render();
    if (pinnedIndex == null) clearTransient('pointer');
    else showTooltip(index, true);
  };

  const handleKeydown = (event) => {
    const active = currentIndex() ?? 0;
    let next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(itemCount - 1, active + 1);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(0, active - 1);
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = itemCount - 1;
    if (next != null) {
      event.preventDefault();
      pinnedIndex = null;
      updateTransient(next, 'keyboard', true);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const index = keyboardIndex ?? pinnedIndex ?? 0;
      pinnedIndex = pinnedIndex === index ? null : index;
      keyboardIndex = index;
      render();
      showTooltip(index, true);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      pinnedIndex = null;
      keyboardIndex = null;
      hoverIndex = null;
      tooltip.hidden = true;
      stage.classList.remove('is-pinned');
      live.textContent = '';
      render();
    }
  };

  const handleFocus = () => updateTransient(pinnedIndex ?? keyboardIndex ?? 0, 'keyboard', true);
  const handleBlur = (event) => {
    if (stage.contains(event.relatedTarget)) return;
    clearTransient('keyboard');
  };

  canvas.addEventListener('pointermove', handlePointerMove, { passive: true });
  stage.addEventListener('pointerleave', () => clearTransient('pointer'));
  canvas.addEventListener('click', handleClick);
  canvas.addEventListener('keydown', handleKeydown);
  canvas.addEventListener('focus', handleFocus);
  canvas.addEventListener('blur', handleBlur);

  const resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(render);
  });
  resizeObserver.observe(stage);
  requestAnimationFrame(render);

  return {
    setExporting(value) {
      exporting = value;
      tooltip.hidden = true;
      render();
      if (!value && currentIndex() != null) showTooltip(currentIndex());
    },
    destroy() {
      resizeObserver.disconnect();
      cancelAnimationFrame(resizeFrame);
    },
  };
}

function buildAccessibleTable(id, captionText, headers, rows) {
  const table = document.createElement('table');
  table.id = id;
  table.className = 'visually-hidden stats-chart-data-table';
  const caption = document.createElement('caption');
  caption.textContent = captionText;
  table.appendChild(caption);
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const text of headers) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = text;
    headRow.appendChild(th);
  }
  head.appendChild(headRow);
  table.appendChild(head);
  const body = document.createElement('tbody');
  for (const values of rows) {
    const row = document.createElement('tr');
    values.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      cell.textContent = value;
      row.appendChild(cell);
    });
    body.appendChild(row);
  }
  table.appendChild(body);
  return table;
}
