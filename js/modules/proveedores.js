// Módulo "Proveedores" y "Comprobantes de Pago":
// contactos, cotizaciones, WhatsApp, abonos, subida de comprobantes (foto/PDF), visor y descarga.
import * as db from '../db.js';
import { esc, toast, openModal, fmtMoney, fmtDate, todayISO, celebrate } from '../ui.js';
import { icon } from '../icons.js';
import { exportVendorsPdf } from '../pdf.js';
import {
  parsePaymentMeta,
  encodePaymentNote,
  prepareReceiptFile,
  formatFileSize,
  isPdfReceipt,
  isImageReceipt,
  downloadOrShareReceipt,
  openReceiptViewer,
} from '../receipts.js';

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

const PAY_METHODS = [
  'Transferencia', 'Deuna', 'Banco Pichincha', 'Banco Guayaquil',
  'Produbanco', 'Cooperativa JEP', 'Efectivo', 'Tarjeta (sin diferir)',
];

const fState = {
  tab: 'vendors',   // 'vendors' | 'receipts'
  status: 'all',
  q: '',
  rVendor: 'all',
  rOnlyFiles: false,
  rq: '',
};

function cleanPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.startsWith('0') && d.length === 10 ? '593' + d.slice(1) : d;
}

/** Relaciona cada pago con su proveedor (por metadata o mediante su rubro de presupuesto). */
function resolvePaymentInfo(payment, budgetById, vendorById) {
  const meta = parsePaymentMeta(payment);
  const bItem = payment.budget_item_id ? budgetById[String(payment.budget_item_id)] : null;
  const vendorId = meta.vendorId || (bItem?.vendor_id ? String(bItem.vendor_id) : null);
  const vendor = vendorId ? vendorById[String(vendorId)] : null;
  return {
    payment,
    meta,
    budgetItem: bItem,
    vendor,
    vendorId: vendor ? String(vendor.id) : vendorId,
    vendorName: vendor?.name || meta.vendorName || bItem?.concept || 'Pago general',
    receipt: meta.receipt,
    note: meta.note,
  };
}

export async function renderProveedores(el, ctx) {
  const [wedding, vendors, budgetItems, payments] = await Promise.all([
    db.getWedding(),
    db.list('vendors', { order: 'name' }),
    db.list('budget_items'),
    db.list('payments', { order: 'paid_on', ascending: false }),
  ]);

  const vendorById = Object.fromEntries(vendors.map((v) => [String(v.id), v]));
  const budgetById = Object.fromEntries(budgetItems.map((b) => [String(b.id), b]));

  const enrichedPayments = payments.map((p) => resolvePaymentInfo(p, budgetById, vendorById));
  const paysByVendor = {};
  enrichedPayments.forEach((ep) => {
    if (ep.vendorId) (paysByVendor[String(ep.vendorId)] ||= []).push(ep);
  });

  const reserved = vendors.filter((v) => v.status === 'reservado' || v.status === 'pagado');
  const totalQuoted = reserved.reduce((n, v) => n + Number(v.quote || 0), 0);
  const totalPaidVendors = enrichedPayments.reduce((n, ep) => n + Number(ep.payment.amount || 0), 0);
  const receiptsCount = enrichedPayments.filter((ep) => ep.receipt).length;

  el.innerHTML = `
  <header class="page-head">
    <div>
      <span class="eyebrow">${icon('briefcase', 14)} Planificación diligente · Prov. 21:5</span>
      <h1>Proveedores y Comprobantes</h1>
      <p>Organiza tus cotizaciones, escribe por WhatsApp y guarda los comprobantes de transferencia (foto o PDF) de cada pago.</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-outline" id="btn-export-vendors-pdf">${icon('printer', 16)} Exportar PDF</button>
      ${ctx.isAdmin ? `<button class="btn btn-outline" id="btn-new-receipt">${icon('upload', 16)} Subir comprobante</button>` : ''}
      ${ctx.isAdmin ? `<button class="btn btn-primary" id="btn-new-vendor">${icon('plus', 16)} Nuevo proveedor</button>` : ''}
    </div>
  </header>

  <section class="kpi-strip">
    <div class="kpi-card"><span>Total proveedores</span><strong>${vendors.length}</strong><small class="muted">en directorio</small></div>
    <div class="kpi-card kpi-ok"><span>Reservados / Pagados</span><strong>${reserved.length}</strong><small class="muted">confirmados para la boda</small></div>
    <div class="kpi-card kpi-warn"><span>Total abonado</span><strong>${fmtMoney(totalPaidVendors)}</strong><small class="muted">${payments.length} pago(s) registrado(s)</small></div>
    <div class="kpi-card"><span>Comprobantes guardados</span><strong>${receiptsCount}</strong><small class="muted">contratado: ${fmtMoney(totalQuoted)}</small></div>
  </section>

  <div class="subtabs" role="tablist">
    <button type="button" class="subtab ${fState.tab === 'vendors' ? 'active' : ''}" data-tab="vendors">
      ${icon('briefcase', 16)} Proveedores <span class="subtab-count">${vendors.length}</span>
    </button>
    <button type="button" class="subtab ${fState.tab === 'receipts' ? 'active' : ''}" data-tab="receipts">
      ${icon('receipt', 16)} Comprobantes de Pago <span class="subtab-count">${receiptsCount}</span>
    </button>
  </div>

  <div id="tab-vendors" ${fState.tab === 'vendors' ? '' : 'hidden'}>
    <section class="toolbar card" style="margin-bottom:16px;">
      <div class="search-box">
        ${icon('search', 16)}
        <input id="v-q" type="search" placeholder="Buscar proveedor, categoría o contacto…" value="${esc(fState.q)}">
      </div>
      <select id="v-status">
        <option value="all">Todos los estados</option>
        ${Object.entries(VENDOR_STATUS).map(([k, v]) => `<option value="${k}" ${fState.status === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
    </section>
    <div id="vendors-grid" class="vendors-grid"></div>
  </div>

  <div id="tab-receipts" ${fState.tab === 'receipts' ? '' : 'hidden'}>
    <section class="toolbar card" style="margin-bottom:16px;">
      <div class="search-box">
        ${icon('search', 16)}
        <input id="r-q" type="search" placeholder="Buscar por proveedor, método o nota…" value="${esc(fState.rq)}">
      </div>
      <select id="r-vendor">
        <option value="all">Todos los proveedores</option>
        ${vendors.map((v) => `<option value="${esc(v.id)}" ${fState.rVendor === String(v.id) ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}
      </select>
      <label class="chip-check">
        <input type="checkbox" id="r-only-files" ${fState.rOnlyFiles ? 'checked' : ''}>
        <span>Solo con archivo</span>
      </label>
    </section>
    <div id="receipts-grid" class="receipts-grid"></div>
  </div>`;

  const mountVendors = el.querySelector('#vendors-grid');
  const mountReceipts = el.querySelector('#receipts-grid');

  /* ---------------- Pintar Proveedores ---------------- */
  function paintVendors() {
    const q = fState.q.trim().toLowerCase();
    const list = vendors.filter((v) => {
      if (fState.status !== 'all' && v.status !== fState.status) return false;
      if (q && !`${v.name} ${v.category || ''} ${v.contact || ''} ${v.notes || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });

    if (!list.length) {
      mountVendors.innerHTML = `<div class="card empty-state" style="grid-column:1/-1">${icon('briefcase', 28)}<p>Aún no hay proveedores en esta vista. Agrega tus cotizaciones de local, catering, fotos o flores.</p></div>`;
      return;
    }

    mountVendors.innerHTML = list.map((v) => {
      const ph = cleanPhone(v.phone);
      const vPays = paysByVendor[String(v.id)] || [];
      const paid = vPays.reduce((n, ep) => n + Number(ep.payment.amount || 0), 0);
      const vReceipts = vPays.filter((ep) => ep.receipt).length;
      const quote = Number(v.quote || 0);
      const saldo = quote > 0 ? Math.max(0, quote - paid) : 0;
      const pct = quote > 0 ? Math.min(100, Math.round((paid / quote) * 100)) : (paid > 0 ? 100 : 0);

      return `<article class="card vendor-card">
        <div class="vendor-top">
          <span class="pill pill-stage">${esc(v.category || 'General')}</span>
          <span class="pill vstatus-${v.status}">${VENDOR_STATUS[v.status] || v.status}</span>
        </div>
        <h3>${esc(v.name)}</h3>
        ${v.contact ? `<p class="muted">Contacto: <strong>${esc(v.contact)}</strong></p>` : ''}
        ${v.quote != null ? `<p class="vendor-quote">${fmtMoney(v.quote)}</p>` : ''}
        ${(quote > 0 || paid > 0) ? `
          <div class="vendor-pay-box">
            <div class="vendor-pay-row">
              <span>Abonado: <strong class="txt-ok">${fmtMoney(paid)}</strong></span>
              ${quote > 0
                ? (saldo === 0 && paid > 0
                    ? `<span class="pill pill-ok">Pagado 100%</span>`
                    : `<span>Saldo: <strong>${fmtMoney(saldo)}</strong></span>`)
                : `<span>${vPays.length} pago(s)</span>`}
            </div>
            ${quote > 0 ? `<div class="bar bar-sm" style="margin-top:6px;"><span style="width:${pct}%"></span></div>` : ''}
            ${vReceipts > 0 ? `<small class="vendor-rcp-tag">${icon('receipt', 12)} ${vReceipts} comprobante${vReceipts > 1 ? 's' : ''} guardado${vReceipts > 1 ? 's' : ''}</small>` : ''}
          </div>` : ''}
        ${v.notes ? `<p class="vendor-notes">${esc(v.notes)}</p>` : ''}
        <div class="vendor-foot">
          <div class="btn-row">
            <button class="chip-btn chip-rcp" data-vendor-pays="${esc(v.id)}" title="Ver o subir comprobantes de pago">
              ${icon('receipt', 13)} ${vPays.length ? `Pagos (${vPays.length})` : '+ Comprobante'}
            </button>
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

    mountVendors.querySelectorAll('[data-vendor-pays]').forEach((b) => b.addEventListener('click', () => {
      const v = vendors.find((x) => String(x.id) === String(b.dataset.vendorPays));
      if (!v) return;
      const vPays = paysByVendor[String(v.id)] || [];
      if (!vPays.length && ctx.isAdmin) {
        openUploadPaymentModal({ vendors, budgetItems, selectedVendorId: v.id, paysByVendor });
      } else {
        openVendorPaymentsDrawer({ vendor: v, vendorPays: vPays, vendors, budgetItems, paysByVendor, ctx });
      }
    }));

    mountVendors.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
      const v = vendors.find((x) => String(x.id) === String(b.dataset.edit));
      if (v) openVendorModal(v);
    }));

    mountVendors.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este proveedor?')) return;
      try { await db.remove('vendors', b.dataset.del); toast('Proveedor eliminado'); }
      catch (e) { toast(e.message, 'error'); }
    }));

    mountVendors.querySelectorAll('[data-to-budget]').forEach((b) => b.addEventListener('click', async () => {
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

  /* ---------------- Pintar Galería de Comprobantes ---------------- */
  function paintReceipts() {
    const q = fState.rq.trim().toLowerCase();
    const list = enrichedPayments.filter((ep) => {
      if (fState.rVendor !== 'all' && String(ep.vendorId || '') !== fState.rVendor) return false;
      if (fState.rOnlyFiles && !ep.receipt) return false;
      if (q && !`${ep.vendorName} ${ep.payment.method || ''} ${ep.note || ''} ${ep.receipt?.name || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });

    if (!list.length) {
      mountReceipts.innerHTML = `<div class="card empty-state" style="grid-column:1/-1">
        ${icon('receipt', 32)}
        <p>Aún no hay comprobantes registrados aquí. Sube las capturas o PDFs de tus transferencias al fotógrafo, DJ o catering para tener todo respaldado en la nube.</p>
        ${ctx.isAdmin ? `<button type="button" class="btn btn-primary" id="btn-empty-upload" style="margin-top:8px;">${icon('upload', 15)} Subir primer comprobante</button>` : ''}
      </div>`;
      mountReceipts.querySelector('#btn-empty-upload')?.addEventListener('click', () =>
        openUploadPaymentModal({ vendors, budgetItems, selectedVendorId: fState.rVendor !== 'all' ? fState.rVendor : null, paysByVendor }));
      return;
    }

    mountReceipts.innerHTML = list.map((ep) => {
      const p = ep.payment;
      const r = ep.receipt;
      const isPdf = isPdfReceipt(r);
      const isImg = isImageReceipt(r);

      return `<article class="card receipt-card">
        <div class="receipt-thumb ${r ? 'has-file' : 'no-file'}" ${r ? `data-view-rcp="${esc(p.id)}"` : ''}>
          ${isImg
            ? `<img src="${r.data}" alt="${esc(r.name)}" loading="lazy"><span class="thumb-pill">🖼️ Foto</span>`
            : isPdf
              ? `<div class="receipt-pdf-mini">${icon('fileText', 34)}<strong>Documento PDF</strong><small>${esc(r.name)}</small></div><span class="thumb-pill pdf">📄 PDF</span>`
              : `<div class="receipt-nofile">${icon('receipt', 28)}<span>Sin archivo adjunto</span></div>`}
        </div>
        <div class="receipt-card-body">
          <div class="vendor-top">
            <span class="pill pill-stage">${esc(ep.vendorName)}</span>
            ${p.method ? `<span class="pill">${esc(p.method)}</span>` : ''}
          </div>
          <div class="receipt-card-amt">
            <strong>${fmtMoney(p.amount)}</strong>
            <small class="muted">${esc(fmtDate(p.paid_on, { day: 'numeric', month: 'short', year: 'numeric' }))}</small>
          </div>
          ${ep.note ? `<p class="vendor-notes">${esc(ep.note)}</p>` : ''}
          ${r ? `<small class="muted" style="font-size:0.74rem;word-break:break-all;">📎 ${esc(r.name)}${r.size ? ` · ${formatFileSize(r.size)}` : ''}</small>` : ''}
        </div>
        <div class="vendor-foot">
          <div class="btn-row">
            ${r ? `<button class="chip-btn" data-view-rcp="${esc(p.id)}">${icon('eye', 13)} Ver</button>
                   <button class="chip-btn chip-wa" data-dl-rcp="${esc(p.id)}">${icon('download', 13)} Descargar</button>`
                : (ctx.isAdmin ? `<button class="chip-btn chip-rcp" data-attach-rcp="${esc(p.id)}">${icon('upload', 13)} Adjuntar foto/PDF</button>` : '')}
          </div>
          ${ctx.isAdmin ? `<button class="icon-btn icon-danger" data-del-rcp="${esc(p.id)}" title="Eliminar pago">${icon('trash', 15)}</button>` : ''}
        </div>
      </article>`;
    }).join('');

    mountReceipts.querySelectorAll('[data-view-rcp]').forEach((b) => b.addEventListener('click', () => {
      const ep = enrichedPayments.find((x) => String(x.payment.id) === String(b.dataset.viewRcp));
      if (ep?.receipt) {
        openReceiptViewer({ payment: ep.payment, vendorName: ep.vendorName, budgetConcept: ep.budgetItem?.concept, receipt: ep.receipt });
      }
    }));

    mountReceipts.querySelectorAll('[data-dl-rcp]').forEach((b) => b.addEventListener('click', () => {
      const ep = enrichedPayments.find((x) => String(x.payment.id) === String(b.dataset.dlRcp));
      if (ep?.receipt) downloadOrShareReceipt(ep.receipt, `Comprobante ${ep.vendorName} ${fmtMoney(ep.payment.amount)}`);
    }));

    mountReceipts.querySelectorAll('[data-attach-rcp]').forEach((b) => b.addEventListener('click', () => {
      const ep = enrichedPayments.find((x) => String(x.payment.id) === String(b.dataset.attachRcp));
      if (ep) openAttachReceiptModal(ep);
    }));

    mountReceipts.querySelectorAll('[data-del-rcp]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este pago y su comprobante?')) return;
      try { await db.remove('payments', b.dataset.delRcp); toast('Pago y comprobante eliminados'); }
      catch (e) { toast(e.message, 'error'); }
    }));
  }

  paintVendors();
  paintReceipts();

  /* ---------------- Eventos de pestañas y controles ---------------- */
  el.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => {
    fState.tab = btn.dataset.tab;
    el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === fState.tab));
    el.querySelector('#tab-vendors').hidden = fState.tab !== 'vendors';
    el.querySelector('#tab-receipts').hidden = fState.tab !== 'receipts';
  }));

  el.querySelector('#v-q').addEventListener('input', (e) => { fState.q = e.target.value; paintVendors(); });
  el.querySelector('#v-status').addEventListener('change', (e) => { fState.status = e.target.value; paintVendors(); });

  el.querySelector('#r-q').addEventListener('input', (e) => { fState.rq = e.target.value; paintReceipts(); });
  el.querySelector('#r-vendor').addEventListener('change', (e) => { fState.rVendor = e.target.value; paintReceipts(); });
  el.querySelector('#r-only-files').addEventListener('change', (e) => { fState.rOnlyFiles = e.target.checked; paintReceipts(); });

  el.querySelector('#btn-export-vendors-pdf').addEventListener('click', () =>
    exportVendorsPdf({ wedding, vendors, payments, budgetItems }));
  el.querySelector('#btn-new-vendor')?.addEventListener('click', () => openVendorModal(null));
  el.querySelector('#btn-new-receipt')?.addEventListener('click', () =>
    openUploadPaymentModal({
      vendors,
      budgetItems,
      selectedVendorId: fState.tab === 'receipts' && fState.rVendor !== 'all' ? fState.rVendor : null,
      paysByVendor,
    }));
}

/* ---------------- Modal: Historial de pagos y comprobantes de un proveedor ---------------- */
function openVendorPaymentsDrawer({ vendor, vendorPays, vendors, budgetItems, paysByVendor, ctx }) {
  const paid = vendorPays.reduce((n, ep) => n + Number(ep.payment.amount || 0), 0);
  const quote = Number(vendor.quote || 0);
  const saldo = quote > 0 ? Math.max(0, quote - paid) : 0;

  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal modal-wide">
      <header class="modal-head">
        <h3>${icon('receipt', 18)} Pagos y Comprobantes · ${esc(vendor.name)}</h3>
        <button type="button" class="icon-btn" data-close>${icon('x', 18)}</button>
      </header>
      <div class="modal-body">
        <div class="vendor-pay-summary">
          <div><span>Cotización</span><strong>${quote ? fmtMoney(quote) : 'Sin definir'}</strong></div>
          <div><span>Total abonado</span><strong class="txt-ok">${fmtMoney(paid)}</strong></div>
          <div><span>Saldo pendiente</span><strong>${quote ? fmtMoney(saldo) : '—'}</strong></div>
        </div>
        ${vendorPays.length ? `<ul class="team-list" style="margin-top:14px;">
          ${vendorPays.map((ep) => {
            const p = ep.payment;
            const r = ep.receipt;
            return `<li class="team-row">
              <div class="rcp-mini-icon ${r ? 'has' : ''}">${icon(r ? (isPdfReceipt(r) ? 'fileText' : 'image') : 'receipt', 18)}</div>
              <div class="team-info">
                <strong>${fmtMoney(p.amount)} · ${esc(fmtDate(p.paid_on, { day: 'numeric', month: 'short', year: 'numeric' }))}</strong>
                <small class="muted">${esc([p.method, ep.note, r ? `📎 ${r.name}` : 'Sin comprobante adjunto'].filter(Boolean).join(' · '))}</small>
              </div>
              <div class="btn-row">
                ${r ? `<button type="button" class="chip-btn" data-vp-view="${esc(p.id)}">${icon('eye', 13)} Ver</button>
                       <button type="button" class="chip-btn chip-wa" data-vp-dl="${esc(p.id)}">${icon('download', 13)}</button>`
                    : (ctx.isAdmin ? `<button type="button" class="chip-btn chip-rcp" data-vp-attach="${esc(p.id)}">${icon('upload', 13)} Adjuntar</button>` : '')}
                ${ctx.isAdmin ? `<button type="button" class="icon-btn icon-danger" data-vp-del="${esc(p.id)}" title="Eliminar">${icon('trash', 14)}</button>` : ''}
              </div>
            </li>`;
          }).join('')}
        </ul>` : `<div class="empty-state">${icon('receipt', 26)}<p>No hay pagos registrados para este proveedor todavía.</p></div>`}
      </div>
      <footer class="modal-foot">
        <button type="button" class="btn btn-ghost" data-close>Cerrar</button>
        ${ctx.isAdmin ? `<button type="button" class="btn btn-primary" id="btn-vp-add">${icon('upload', 15)} Registrar pago / comprobante</button>` : ''}
      </footer>
    </div>`;

  document.body.appendChild(back);
  const close = () => { back.classList.remove('open'); setTimeout(() => back.remove(), 200); };
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });

  back.querySelector('#btn-vp-add')?.addEventListener('click', () => {
    close();
    setTimeout(() => openUploadPaymentModal({ vendors, budgetItems, selectedVendorId: vendor.id, paysByVendor }), 180);
  });

  back.querySelectorAll('[data-vp-view]').forEach((b) => b.addEventListener('click', () => {
    const ep = vendorPays.find((x) => String(x.payment.id) === String(b.dataset.vpView));
    if (ep?.receipt) openReceiptViewer({ payment: ep.payment, vendorName: vendor.name, budgetConcept: ep.budgetItem?.concept, receipt: ep.receipt });
  }));

  back.querySelectorAll('[data-vp-dl]').forEach((b) => b.addEventListener('click', () => {
    const ep = vendorPays.find((x) => String(x.payment.id) === String(b.dataset.vpDl));
    if (ep?.receipt) downloadOrShareReceipt(ep.receipt, `Comprobante ${vendor.name} ${fmtMoney(ep.payment.amount)}`);
  }));

  back.querySelectorAll('[data-vp-attach]').forEach((b) => b.addEventListener('click', () => {
    const ep = vendorPays.find((x) => String(x.payment.id) === String(b.dataset.vpAttach));
    if (ep) { close(); setTimeout(() => openAttachReceiptModal(ep), 180); }
  }));

  back.querySelectorAll('[data-vp-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Eliminar este pago y su comprobante?')) return;
    try {
      await db.remove('payments', b.dataset.vpDel);
      toast('Pago eliminado');
      close();
    } catch (e) { toast(e.message, 'error'); }
  }));

  requestAnimationFrame(() => back.classList.add('open'));
}

/* ---------------- Modal: Registrar Pago y Subir Comprobante (Foto o PDF) ---------------- */
function openUploadPaymentModal({ vendors, budgetItems, selectedVendorId = null, paysByVendor = {} }) {
  let preparedFile = null;

  const { form } = openModal({
    title: 'Subir pago y comprobante',
    wide: true,
    submitLabel: 'Guardar en la nube',
    body: `
      <div class="form-grid">
        <label class="field"><span>Proveedor *</span>
          <select name="vendor_id" id="up-vendor" required>
            <option value="">Selecciona un proveedor…</option>
            ${vendors.map((v) => `<option value="${esc(v.id)}" ${String(selectedVendorId) === String(v.id) ? 'selected' : ''}>${esc(v.name)}${v.quote ? ` (${fmtMoney(v.quote)})` : ''}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Monto transferido / pagado (USD) *</span>
          <input name="amount" id="up-amount" type="number" min="0.01" step="0.01" required placeholder="Ej. 155">
          <div class="quick-amt-row" id="up-quick-amts"></div>
        </label>
        <label class="field"><span>Fecha del pago</span>
          <input name="paid_on" type="date" value="${todayISO()}">
        </label>
        <label class="field"><span>Método de pago</span>
          <select name="method">${PAY_METHODS.map((m) => `<option value="${m}">${m}</option>`).join('')}</select>
        </label>
      </div>

      <label class="field"><span>Nota / referencia del pago</span>
        <input name="note" placeholder="Ej. Anticipo 50% acordado, transferencia Banco Pichincha">
      </label>

      <div class="field">
        <span>Comprobante (Foto o PDF)</span>
        <label class="receipt-drop" id="up-drop">
          <input type="file" id="up-file" accept="image/*,application/pdf" hidden>
          <div class="receipt-drop-empty" id="up-drop-empty">
            ${icon('upload', 24)}
            <strong>Toca para elegir foto o PDF del comprobante</strong>
            <small class="muted">Capturas de transferencia, fotos de cámara o PDF del banco (hasta 3.5 MB)</small>
          </div>
          <div class="receipt-preview" id="up-preview" hidden></div>
        </label>
      </div>

      <div class="form-grid" style="margin-top:4px;">
        <label class="field"><span>Estado del proveedor</span>
          <select name="vendor_status" id="up-vstatus">
            <option value="">Mantener estado actual</option>
            <option value="reservado">Marcar como Reservado</option>
            <option value="pagado">Marcar como Pagado</option>
          </select>
        </label>
        <label class="field field-check" style="margin-top:20px;">
          <input type="checkbox" name="sync_budget" checked>
          <span>Reflejar automáticamente en Presupuesto</span>
        </label>
      </div>`,
    onSubmit: async (fd) => {
      const vendorId = String(fd.get('vendor_id') || '').trim();
      const vendor = vendors.find((v) => String(v.id) === vendorId);
      if (!vendor) throw new Error('Selecciona un proveedor.');

      const amount = Number(fd.get('amount'));
      if (!amount || amount <= 0) throw new Error('Ingresa un monto mayor a 0.');

      const paidOn = String(fd.get('paid_on') || todayISO());
      const method = String(fd.get('method') || '').trim() || null;
      const plainNote = String(fd.get('note') || '').trim();
      const syncBudget = fd.get('sync_budget') === 'on';
      const newStatus = String(fd.get('vendor_status') || '').trim();

      let budgetItemId = null;
      const existingBudget = budgetItems.find((b) => String(b.vendor_id) === String(vendor.id));
      if (existingBudget) {
        budgetItemId = existingBudget.id;
      } else if (syncBudget) {
        const created = await db.insert('budget_items', {
          category: 'proveedores',
          concept: `${vendor.category ? vendor.category + ': ' : ''}${vendor.name}`,
          estimated: Number(vendor.quote || amount),
          actual: vendor.quote != null ? Number(vendor.quote) : null,
          vendor_id: vendor.id,
          notes: vendor.notes || null,
        });
        budgetItemId = created.id;
      }

      const encodedNote = encodePaymentNote(plainNote, {
        vendorId: vendor.id,
        vendorName: vendor.name,
        receipt: preparedFile,
      });

      await db.insert('payments', {
        budget_item_id: budgetItemId,
        amount,
        paid_on: paidOn,
        method,
        note: encodedNote,
      });

      if (newStatus && newStatus !== vendor.status) {
        await db.update('vendors', vendor.id, { status: newStatus });
      }

      celebrate();
      toast(preparedFile
        ? `Pago de ${fmtMoney(amount)} y comprobante guardados en la nube ✔`
        : `Pago de ${fmtMoney(amount)} guardado en la nube ✔`);
    },
  });

  const vSel = form.querySelector('#up-vendor');
  const amtIn = form.querySelector('#up-amount');
  const quickWrap = form.querySelector('#up-quick-amts');
  const statusSel = form.querySelector('#up-vstatus');

  const updateQuickHints = () => {
    const v = vendors.find((x) => String(x.id) === String(vSel.value));
    if (!v || !v.quote) { quickWrap.innerHTML = ''; return; }
    const quote = Number(v.quote);
    const prevPaid = (paysByVendor[String(v.id)] || []).reduce((n, ep) => n + Number(ep.payment.amount || 0), 0);
    const saldo = Math.max(0, quote - prevPaid);
    const half = Math.round((quote / 2) * 100) / 100;

    quickWrap.innerHTML = `
      ${half > 0 ? `<button type="button" class="quick-amt" data-val="${half}">50% (${fmtMoney(half)})</button>` : ''}
      ${saldo > 0 && saldo !== half ? `<button type="button" class="quick-amt" data-val="${saldo}">Saldo (${fmtMoney(saldo)})</button>` : ''}`;

    quickWrap.querySelectorAll('.quick-amt').forEach((b) => b.addEventListener('click', () => {
      amtIn.value = b.dataset.val;
      suggestStatus();
    }));

    if (v.status === 'cotizando' && !statusSel.value) statusSel.value = 'reservado';
  };

  const suggestStatus = () => {
    const v = vendors.find((x) => String(x.id) === String(vSel.value));
    if (!v) return;
    const prevPaid = (paysByVendor[String(v.id)] || []).reduce((n, ep) => n + Number(ep.payment.amount || 0), 0);
    const total = prevPaid + (Number(amtIn.value) || 0);
    if (v.quote && total >= Number(v.quote)) statusSel.value = 'pagado';
    else if (v.status === 'cotizando') statusSel.value = 'reservado';
  };

  vSel.addEventListener('change', updateQuickHints);
  amtIn.addEventListener('input', suggestStatus);
  updateQuickHints();

  const fileIn = form.querySelector('#up-file');
  const dropEmpty = form.querySelector('#up-drop-empty');
  const prevBox = form.querySelector('#up-preview');

  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0];
    if (!f) return;
    dropEmpty.innerHTML = `${icon('clock', 22)}<strong>Procesando comprobante…</strong><small class="muted">Optimizando para la nube</small>`;
    try {
      preparedFile = await prepareReceiptFile(f);
      dropEmpty.hidden = true;
      prevBox.hidden = false;
      prevBox.innerHTML = `
        ${isImageReceipt(preparedFile)
          ? `<img src="${preparedFile.data}" alt="Vista previa">`
          : `<div class="receipt-prev-pdf">${icon('fileText', 32)}<span>PDF listo</span></div>`}
        <div class="receipt-prev-info">
          <strong>${esc(preparedFile.name)}</strong>
          <small class="muted">${formatFileSize(preparedFile.size)} · Listo para subir ✔</small>
          <button type="button" class="chip-btn" id="up-clear-file" style="margin-top:6px;">Cambiar archivo</button>
        </div>`;
      prevBox.querySelector('#up-clear-file').addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        preparedFile = null;
        fileIn.value = '';
        prevBox.hidden = true;
        dropEmpty.hidden = false;
        dropEmpty.innerHTML = `${icon('upload', 24)}<strong>Toca para elegir foto o PDF del comprobante</strong><small class="muted">Capturas de transferencia, fotos de cámara o PDF del banco (hasta 3.5 MB)</small>`;
      });
    } catch (e) {
      preparedFile = null;
      fileIn.value = '';
      dropEmpty.innerHTML = `${icon('upload', 24)}<strong>Toca para elegir foto o PDF del comprobante</strong><small class="muted">Capturas de transferencia, fotos de cámara o PDF del banco (hasta 3.5 MB)</small>`;
      toast(e.message, 'error');
    }
  });
}

/* ---------------- Modal: Adjuntar comprobante a un pago ya existente ---------------- */
function openAttachReceiptModal(ep) {
  let preparedFile = null;
  const { form } = openModal({
    title: `Adjuntar comprobante · ${ep.vendorName}`,
    submitLabel: 'Guardar comprobante',
    body: `
      <p class="muted" style="margin-bottom:12px;">
        Pago de <strong>${fmtMoney(ep.payment.amount)}</strong> (${esc(fmtDate(ep.payment.paid_on))})${ep.payment.method ? ` · ${esc(ep.payment.method)}` : ''}.
      </p>
      <label class="receipt-drop">
        <input type="file" id="att-file" accept="image/*,application/pdf" hidden>
        <div class="receipt-drop-empty" id="att-empty">
          ${icon('upload', 24)}
          <strong>Elegir foto o PDF del comprobante</strong>
          <small class="muted">JPG, PNG, WEBP o PDF (hasta 3.5 MB)</small>
        </div>
        <div class="receipt-preview" id="att-prev" hidden></div>
      </label>`,
    onSubmit: async () => {
      if (!preparedFile) throw new Error('Selecciona una foto o un archivo PDF.');
      const encodedNote = encodePaymentNote(ep.note, {
        vendorId: ep.vendorId,
        vendorName: ep.vendorName,
        receipt: preparedFile,
      });
      await db.update('payments', ep.payment.id, { note: encodedNote });
      toast('Comprobante adjuntado y guardado en la nube ✔');
    },
  });

  const fileIn = form.querySelector('#att-file');
  const emptyEl = form.querySelector('#att-empty');
  const prevEl = form.querySelector('#att-prev');

  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0];
    if (!f) return;
    try {
      preparedFile = await prepareReceiptFile(f);
      emptyEl.hidden = true;
      prevEl.hidden = false;
      prevEl.innerHTML = `
        ${isImageReceipt(preparedFile)
          ? `<img src="${preparedFile.data}" alt="Vista previa">`
          : `<div class="receipt-prev-pdf">${icon('fileText', 32)}<span>PDF</span></div>`}
        <div class="receipt-prev-info">
          <strong>${esc(preparedFile.name)}</strong>
          <small class="muted">${formatFileSize(preparedFile.size)} · Listo ✔</small>
        </div>`;
    } catch (e) {
      preparedFile = null;
      toast(e.message, 'error');
    }
  });
}

/* ---------------- Modal: Crear / Editar Proveedor ---------------- */
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
