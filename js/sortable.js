// Motor táctil y de mouse para reordenar listas (arrastrar desde ⋮⋮ o mantener pulsado).
// Diseñado para Android WebView (Capacitor) y PC sin bloquear nunca el scroll vertical normal.

const LONG_PRESS_MS = 280;
const MOVE_CANCEL_PX = 8;

/**
 * Habilita reordenamiento por arrastre (handle inmediato o pulsación larga en la fila).
 * @param {HTMLElement} listEl Contenedor <ul> con hijos [data-sort-id]
 * @param {Object} opts
 * @param {string} [opts.itemSelector='[data-sort-id]']
 * @param {string} [opts.handleSelector='.drag-handle']
 * @param {boolean} [opts.enabled=true]
 * @param {(orderedIds: string[]) => Promise<void>|void} opts.onReorder
 */
export function enableTouchSort(listEl, {
  itemSelector = '[data-sort-id]',
  handleSelector = '.drag-handle',
  enabled = true,
  onReorder,
} = {}) {
  if (!listEl || !enabled) return () => {};

  let active = null;
  let holdTimer = null;
  let startX = 0;
  let startY = 0;
  let lastClientY = 0;
  let scrollRaf = null;
  let initialOrder = [];

  const getItems = () => [...listEl.querySelectorAll(`:scope > ${itemSelector}`)];

  const isInteractive = (target) =>
    Boolean(target.closest('a, button:not(.drag-handle), input, select, textarea, label.check'));

  const clearHold = () => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  };

  const stopAutoScroll = () => {
    if (scrollRaf) { cancelAnimationFrame(scrollRaf); scrollRaf = null; }
  };

  const updateOrderNumbers = () => {
    getItems().forEach((el, idx) => {
      const badge = el.querySelector('.sort-num, .couple-n');
      if (badge) badge.textContent = String(idx + 1);
    });
  };

  const startDrag = (item, clientY) => {
    if (active) return;
    clearHold();
    const rect = item.getBoundingClientRect();
    initialOrder = getItems().map((x) => x.dataset.sortId);

    const placeholder = document.createElement(item.tagName);
    placeholder.className = 'sort-placeholder';
    placeholder.style.height = `${rect.height}px`;

    item.parentNode.insertBefore(placeholder, item);

    // Clonar estilos visuales flotantes sobre el elemento real
    item.classList.add('is-dragging');
    item.style.position = 'fixed';
    item.style.left = `${rect.left}px`;
    item.style.top = `${rect.top}px`;
    item.style.width = `${rect.width}px`;
    item.style.zIndex = '180';
    item.style.pointerEvents = 'none';
    item.style.margin = '0';

    listEl.classList.add('is-sorting');
    document.body.classList.add('sort-no-select');
    if (navigator.vibrate) { try { navigator.vibrate(18); } catch { /* noop */ } }

    active = {
      item,
      placeholder,
      offsetY: clientY - rect.top,
      startTop: rect.top,
    };
    lastClientY = clientY;
    tickAutoScroll();
  };

  const moveDrag = (clientY) => {
    if (!active) return;
    lastClientY = clientY;
    const top = clientY - active.offsetY;
    active.item.style.top = `${top}px`;

    const siblings = getItems().filter((x) => x !== active.item);
    let inserted = false;
    for (const sib of siblings) {
      const r = sib.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (clientY < mid) {
        if (active.placeholder.nextSibling !== sib) {
          listEl.insertBefore(active.placeholder, sib);
        }
        inserted = true;
        break;
      }
    }
    if (!inserted && listEl.lastElementChild !== active.placeholder) {
      listEl.appendChild(active.placeholder);
    }
  };

  const tickAutoScroll = () => {
    if (!active) return;
    const edge = 72;
    const h = window.innerHeight;
    let delta = 0;
    if (lastClientY < edge) delta = -Math.ceil((edge - lastClientY) / 7);
    else if (lastClientY > h - edge) delta = Math.ceil((lastClientY - (h - edge)) / 7);
    if (delta !== 0) {
      window.scrollBy(0, delta);
      moveDrag(lastClientY);
    }
    scrollRaf = requestAnimationFrame(tickAutoScroll);
  };

  const finishDrag = async (cancelled = false) => {
    clearHold();
    stopAutoScroll();
    if (!active) return;

    const { item, placeholder } = active;
    active = null;

    item.classList.remove('is-dragging');
    item.style.position = '';
    item.style.left = '';
    item.style.top = '';
    item.style.width = '';
    item.style.zIndex = '';
    item.style.pointerEvents = '';
    item.style.margin = '';

    listEl.classList.remove('is-sorting');
    document.body.classList.remove('sort-no-select');

    if (placeholder.parentNode) {
      placeholder.parentNode.insertBefore(item, placeholder);
      placeholder.remove();
    }

    if (cancelled) return;

    const nextOrder = getItems().map((x) => x.dataset.sortId);
    const changed = nextOrder.length === initialOrder.length && nextOrder.some((id, i) => id !== initialOrder[i]);
    if (changed) {
      updateOrderNumbers();
      if (typeof onReorder === 'function') {
        await onReorder(nextOrder);
      }
    }
  };

  /* ---------------- Pointer / Touch listeners ---------------- */
  const onPointerDown = (e) => {
    if (e.button && e.button !== 0) return;
    const item = e.target.closest(itemSelector);
    if (!item || item.parentElement !== listEl) return;
    if (getItems().length < 2) return;

    const onHandle = Boolean(e.target.closest(handleSelector));
    if (!onHandle && isInteractive(e.target)) return;

    startX = e.clientX;
    startY = e.clientY;
    lastClientY = e.clientY;

    if (onHandle) {
      e.preventDefault();
      startDrag(item, e.clientY);
    } else {
      // Mantener pulsado ~280ms en cualquier parte de la fila para arrastrar
      clearHold();
      holdTimer = setTimeout(() => {
        startDrag(item, lastClientY);
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (e) => {
    lastClientY = e.clientY;
    if (active) {
      e.preventDefault();
      moveDrag(e.clientY);
      return;
    }
    if (holdTimer) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_CANCEL_PX) {
        clearHold(); // El usuario está haciendo scroll normal
      }
    }
  };

  const onTouchMoveGuard = (e) => {
    if (active && e.cancelable) e.preventDefault();
  };

  const onPointerUp = () => finishDrag(false);
  const onPointerCancel = () => finishDrag(true);
  const onContextMenu = (e) => {
    if (active || holdTimer) e.preventDefault();
  };

  listEl.addEventListener('pointerdown', onPointerDown);
  listEl.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('touchmove', onTouchMoveGuard, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);

  return () => {
    finishDrag(true);
    listEl.removeEventListener('pointerdown', onPointerDown);
    listEl.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('touchmove', onTouchMoveGuard);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
  };
}
