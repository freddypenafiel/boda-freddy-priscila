// Módulo "Proveedores": contactos, cotizaciones, WhatsApp y envío al presupuesto.
import * as db from '../db.js';
import { esc, toast, openModal, fmtMoney } from '../ui.js';
import { icon } from '../icons.js';
import { exportVendorsPdf } from '../pdf.js';

const VENDOR_CATS = [
  'Local de recepción', 'Banquete / Catering', 'Fotografía y video',
  'Música y sonido', 'Flores y decoración', 'Torta y postre',
  'Vestimenta y alquiler', 'Registro Civil / Legal', 'Otros',
];

const VENDOR_STATUS = {
  cotizando: 'Cotizando',
  reservado: 'Reservado',
  pagado: 'Pagado',
  descartado: 'Descartado',
};

const fState = { status: 'all', q: '' };

function cleanPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.startsWith('0') && d.length === 10 ? '593' + d.slice(1) : d;
}

export async function renderProveedores(el, ctx) {
  const [wedding, vendors] = await Promise.all([
    db.getWedding(),
    db.list('vendors', { order: 'name' }),
  ]);

  const reserved = vendors.filter((v) => v.status === 'reservado' || v.status === 'pagado');
  const totalQuoted = reserved.reduce((n, v) => n + Number(v.quote || 0), 0);

  el.innerHTML = `
  <header class="page-head">
    <div>
      <span class="eyebrow">${icon('briefcase', 14)} Planificación diligente · Prov. 21:5</span>
      <h1>Proveedores y Cotizaciones</h1>
      <p>Compara opciones de local, comida, foto, flores y alquileres. Llama o escribe por WhatsApp con un toque y pásalos al presupuesto.</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-outline" id="btn-export-vendors-pdf">${icon('printer', 16)} Exportar PDF</button>
      ${ctx.isAdmin ? `<button class="btn btn-primary" id="btn-new-vendor">${icon('plus', 16)} Nuevo proveedor</button>` : ''}
    </div>
  </header>

  <section class="kpi-strip">
    <div class="kpi-card"><span>Total proveedores</span><strong>${vendors.length}</strong><small class="muted">en directorio</small></div>
    <div class="kpi-card kpi-ok"><span>Reservados / Pagados</span><strong>${reserved.length}</strong><small class="muted">confirmados para la boda</small></div>
    <div class="kpi-card kpi-warn"><span>Cotizando</span><strong>${vendors.filter((v) => v.status === 'cotizando').length}</strong><small class="muted">en evaluación</small></div>
    <div class="kpi-card"><span>Suma contratada</span><strong>${fmtMoney(totalQuoted)}</strong><small class="muted">en proveedores confirmados</small></div>
  </section>

  <section class="toolbar card">
    <div class="search-box">
      ${icon('search', 16)}
      <input id="v-q" type="search" placeholder="Buscar proveedor, categoría o contacto…" value="${esc(fState.q)}">
    </div>
    <select id="v-status">
      <option value="all">Todos los estados</option>
      ${Object.entries(VENDOR_STATUS).map(([k, v]) => `<option value="${k}" ${fState.status === k ? 'selected' : ''}>${v}</option>`).join('')}
    </select>
  </section>

  <div id="vendors-grid" class="vendors-grid"></div>`;

  const mount = el.querySelector('#vendors-grid');

  function paint() {
    const q = fState.q.trim().toLowerCase();
    const list = vendors.filter((v) => {
      if (fState.status !== 'all' && v.status !== fState.status) return false;
      if (q && !`${v.name} ${v.category || ''} ${v.contact || ''} ${v.notes || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });

    if (!list.length) {
      mount.innerHTML = `<div class="card empty-state" style="grid-column:1/-1">${icon('briefcase', 28)}<p>Aún no hay proveedores en esta vista. Agrega tus cotizaciones de local, catering, fotos o flores.</p></div>`;
      return;
    }

    mount.innerHTML = list.map((v) => {
      const ph = cleanPhone(v.phone);
      return `<article class="card vendor-card">
        <div class="vendor-top">
          <span class="pill pill-stage">${esc(v.category || 'General')}</span>
          <span class="pill vstatus-${v.status}">${VENDOR_STATUS[v.status] || v.status}</span>
        </div>
        <h3>${esc(v.name)}</h3>
        ${v.contact ? `<p class="muted">Contacto: <strong>${esc(v.contact)}</strong></p>` : ''}
        ${v.quote != null ? `<p class="vendor-quote">${fmtMoney(v.quote)}</p>` : ''}
        ${v.notes ? `<p class="vendor-notes">${esc(v.notes)}</p>` : ''}
        <div class="vendor-foot">
          <div class="btn-row">
            ${v.phone ? `<a class="chip-btn" href="tel:${esc(v.phone)}">${icon('phone', 13)} Llamar</a>` : ''}
            ${ph ? `<a class="chip-btn chip-wa" href="https://wa.me/${ph}" target="_blank" rel="noopener">${icon('whatsapp', 13)} WhatsApp</a>` : ''}
            ${ctx.isAdmin ? `<button class="chip-btn" data-to-budget="${esc(v.id)}" title="Crear rubro en presupuesto">${icon('wallet', 13)} + Presupuesto</button>` : ''}
          </div>
          ${ctx.isAdmin ? `<div class="btn-row">
            <button class="icon-btn" data-edit="${esc(v.id)}" title="Editar">${icon('edit', 15)}</button>
            <button class="icon-btn icon-danger" data-del="${esc(v.id)}" title="Eliminar">${icon('trash', 15)}</button>
          </div>` : ''}
        </div>
      </article>`;
    }).join('');

    mount.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
      const v = vendors.find((x) => String(x.id) === String(b.dataset.edit));
      if (v) openVendorModal(v);
    }));

    mount.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este proveedor?')) return;
      try { await db.remove('vendors', b.dataset.del); toast('Proveedor eliminado'); }
      catch (e) { toast(e.message, 'error'); }
    }));

    mount.querySelectorAll('[data-to-budget]').forEach((b) => b.addEventListener('click', async () => {
      const v = vendors.find((x) => String(x.id) === String(b.dataset.toBudget));
      if (!v) return;
      try {
        const existing = await db.list('budget_items');
        if (existing.some((it) => String(it.vendor_id) === String(v.id))) {
          return toast(`${v.name} ya tiene un rubro creado en Presupuesto.`, 'error');
        }
        await db.insert('budget_items', {
          category: 'proveedores',
          concept: `${v.category ? v.category + ': ' : ''}${v.name}`,
          estimated: Number(v.quote || 0),
          actual: v.status === 'reservado' || v.status === 'pagado' ? Number(v.quote || 0) : null,
          vendor_id: v.id,
          notes: v.notes || null,
        });
        toast(`Rubro creado en Presupuesto para ${v.name} ✔`);
      } catch (e) { toast(e.message, 'error'); }
    }));
  }

  paint();
  el.querySelector('#v-q').addEventListener('input', (e) => { fState.q = e.target.value; paint(); });
  el.querySelector('#v-status').addEventListener('change', (e) => { fState.status = e.target.value; paint(); });
  el.querySelector('#btn-export-vendors-pdf').addEventListener('click', () => exportVendorsPdf({ wedding, vendors }));
  el.querySelector('#btn-new-vendor')?.addEventListener('click', () => openVendorModal(null));
}

function openVendorModal(v) {
  const isEdit = Boolean(v);
  openModal({
    title: isEdit ? 'Editar proveedor' : 'Nuevo proveedor',
    wide: true,
    submitLabel: isEdit ? 'Guardar cambios' : 'Agregar proveedor',
    body: `
      <div class="form-grid">
        <label class="field"><span>Nombre del proveedor / local *</span>
          <input name="name" required value="${esc(v?.name || '')}" placeholder="Ej. Quinta Los Sauces">
        </label>
        <label class="field"><span>Categoría</span>
          <select name="category">
            ${VENDOR_CATS.map((c) => `<option value="${c}" ${(v?.category || VENDOR_CATS[0]) === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Persona de contacto</span>
          <input name="contact" value="${esc(v?.contact || '')}" placeholder="Ej. Sra. Elena">
        </label>
        <label class="field"><span>Teléfono / WhatsApp</span>
          <input name="phone" type="tel" value="${esc(v?.phone || '')}" placeholder="0991234567">
        </label>
        <label class="field"><span>Cotización (USD)</span>
          <input name="quote" type="number" min="0" step="0.01" value="${esc(v?.quote ?? '')}" placeholder="Ej. 850">
        </label>
        <label class="field"><span>Estado</span>
          <select name="status">
            ${Object.entries(VENDOR_STATUS).map(([k, lbl]) => `<option value="${k}" ${(v?.status || 'cotizando') === k ? 'selected' : ''}>${lbl}</option>`).join('')}
          </select>
        </label>
      </div>
      <label class="field"><span>Correo electrónico</span>
        <input name="email" type="email" value="${esc(v?.email || '')}">
      </label>
      <label class="field"><span>Notas / qué incluye</span>
        <textarea name="notes" rows="2" placeholder="Ej. Incluye mantelería, 10 mesas, meseros…">${esc(v?.notes || '')}</textarea>
      </label>`,
    onSubmit: async (fd) => {
      const s = (k) => String(fd.get(k) || '').trim() || null;
      const name = s('name');
      if (!name) throw new Error('Escribe el nombre del proveedor.');
      const payload = {
        name,
        category: s('category'),
        contact: s('contact'),
        phone: s('phone'),
        email: s('email'),
        quote: s('quote') !== null ? Number(fd.get('quote')) : null,
        status: s('status') || 'cotizando',
        notes: s('notes'),
      };
      if (isEdit) { await db.update('vendors', v.id, payload); toast('Proveedor actualizado ✔'); }
      else { await db.insert('vendors', payload); toast('Proveedor agregado ✔'); }
    },
  });
}
