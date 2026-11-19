// Utilidades de interfaz: escape, formato, toasts y modales.
export const TZ = 'America/Guayaquil';

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtMoney = (n) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n || 0));

export function fmtDate(value, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!value) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00-05:00`) : new Date(value);
  return new Intl.DateTimeFormat('es-EC', { timeZone: TZ, ...opts }).format(d);
}

export const fmtTime = (value) =>
  value ? new Intl.DateTimeFormat('es-EC', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '';

/** ISO → valor para <input type="datetime-local"> en hora de Ecuador. */
export function toLocalInput(iso) {
  if (!iso) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}
/** Valor de datetime-local (hora de Ecuador, UTC-5 sin horario de verano) → ISO. */
export const fromLocalInput = (v) => (v ? new Date(`${v}:00-05:00`).toISOString() : null);

export const todayISO = () => toLocalInput(new Date().toISOString()).slice(0, 10);

export function toast(msg, type = 'ok') {
  let wrap = document.getElementById('toasts');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toasts';
    wrap.className = 'toasts';
    wrap.setAttribute('aria-live', 'polite');
    document.body.appendChild(wrap);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  wrap.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
}

/**
 * Abre un modal con formulario.
 * onSubmit(formData, form) puede devolver false para no cerrar.
 */
export function openModal({ title, body, submitLabel = 'Guardar', onSubmit, wide = false }) {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <form class="modal ${wide ? 'modal-wide' : ''}" novalidate>
      <header class="modal-head">
        <h3>${esc(title)}</h3>
        <button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button>
      </header>
      <div class="modal-body">${body}</div>
      <footer class="modal-foot">
        <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
        <button type="submit" class="btn btn-primary">${esc(submitLabel)}</button>
      </footer>
    </form>`;
  document.body.appendChild(back);
  const form = back.querySelector('form');

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    back.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => back.remove(), 200);
  }
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const ok = await onSubmit(new FormData(form), form);
      if (ok !== false) close();
    } catch (err) {
      toast(err.message || 'Ocurrió un error', 'error');
    } finally {
      btn.disabled = false;
    }
  });
  requestAnimationFrame(() => back.classList.add('open'));
  setTimeout(() => form.querySelector('input:not([type=hidden]),select,textarea')?.focus(), 60);
  return { close, form };
}
