// Módulo "Presupuesto": control en USD con mentalidad "Cero deudas · 1 Juan 2:15-17", rubros y abonos.
import * as db from '../db.js';
import { esc, toast, openModal, fmtMoney, fmtDate, todayISO } from '../ui.js';
import { icon } from '../icons.js';
import { CATEGORIES } from '../data/seed.js';
import { exportBudgetPdf } from '../pdf.js';

const PAY_METHODS = ['Transferencia', 'Deuna', 'Banco Pichincha', 'Efectivo', 'Tarjeta (sin diferir)'];

export async function renderPresupuesto(el, ctx) {
  const [wedding, items, payments, vendors] = await Promise.all([
    db.getWedding(),
    db.list('budget_items', { order: 'category' }),
    db.list('payments', { order: 'paid_on', ascending: false }),
    db.list('vendors', { order: 'name' }),
  ]);

  const vendorById = Object.fromEntries(vendors.map((v) => [String(v.id), v]));
  const paysByItem = {};
  payments.forEach((p) => { (paysByItem[String(p.budget_item_id)] ||= []).push(p); });

  const target = Number(wedding.budget_target || 0);
  const totalEst = items.reduce((n, b) => n + Number(b.estimated || 0), 0);
  const totalReal = items.reduce((n, b) => n + Number(b.actual ?? b.estimated ?? 0), 0);
  const totalPaid = payments.reduce((n, p) => n + Number(p.amount || 0), 0);
  const balance = Math.max(0, totalReal - totalPaid);
  const overBudget = target > 0 && totalReal > target;

  // Totales por categoría para gráfico de barras
  const byCat = {};
  items.forEach((b) => {
    const k = b.category || 'presupuesto';
    const cost = Number(b.actual ?? b.estimated ?? 0);
    const paid = (paysByItem[String(b.id)] || []).reduce((n, p) => n + Number(p.amount || 0), 0);
    byCat[k] = { cost: (byCat[k]?.cost || 0) + cost, paid: (byCat[k]?.paid || 0) + paid };
  });
  const catEntries = Object.entries(byCat).sort((a, b) => b[1].cost - a[1].cost);
  const maxCat = Math.max(1, ...catEntries.map(([, v]) => v.cost));

  el.innerHTML = `
  <header class="page-head">
    <div>
      <span class="eyebrow">${icon('wallet', 14)} Sencillez y cero deudas · 1 Juan 2:15-17</span>
      <h1>Presupuesto y Pagos (USD)</h1>
      <p>Mantén un control claro entre lo estimado, el costo real y cada abono realizado, para empezar el matrimonio en paz y sin deudas.</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-outline" id="btn-export-budget-pdf">${icon('printer', 16)} Exportar PDF</button>
      ${ctx.isAdmin ? `<button class="btn btn-primary" id="btn-new-item">${icon('plus', 16)} Nuevo rubro</button>` : ''}
    </div>
  </header>

  <section class="kpi-strip">
    <div class="kpi-card"><span>Presupuesto meta</span><strong>${fmtMoney(target || totalEst)}</strong><small class="muted">Estimado en rubros: ${fmtMoney(totalEst)}</small></div>
    <div class="kpi-card ${overBudget ? 'kpi-err' : ''}"><span>Costo proyectado / real</span><strong>${fmtMoney(totalReal)}</strong><small class="muted">${overBudget ? `Excede la meta en ${fmtMoney(totalReal - target)}` : 'Dentro del presupuesto ✔'}</small></div>
    <div class="kpi-card kpi-ok"><span>Total abonado</span><strong>${fmtMoney(totalPaid)}</strong><small class="muted">${payments.length} pago(s) registrado(s)</small></div>
    <div class="kpi-card kpi-warn"><span>Saldo por pagar</span><strong>${fmtMoney(balance)}</strong><small class="muted">${totalReal ? Math.round((totalPaid / totalReal) * 100) : 0}% cubierto</small></div>
  </section>

  ${catEntries.length ? `<section class="card">
    <header class="card-head"><h2>${icon('dollar', 18)} Distribución por categoría</h2><span class="muted">Barra clara: proyectado · Barra oscura: abonado</span></header>
    <div class="chart-bars">
      ${catEntries.map(([k, v]) => {
        const c = CATEGORIES[k] || { label: k, emoji: '💰' };
        const wCost = Math.round((v.cost / maxCat) * 100);
        const wPaid = Math.round((Math.min(v.paid, v.cost) / maxCat) * 100);
        return `<div class="chart-row">
          <div class="chart-lbl">${c.emoji} ${esc(c.label)}</div>
          <div class="chart-track">
            <div class="chart-est" style="width:${wCost}%"></div>
            <div class="chart-paid" style="width:${wPaid}%"></div>
          </div>
          <div class="chart-val"><strong>${fmtMoney(v.paid)}</strong> <small>/ ${fmtMoney(v.cost)}</small></div>
        </div>`;
      }).join('')}
    </div>
  </section>` : ''}

  <section class="card table-card">
    <header class="card-head" style="padding:16px 20px 12px;margin:0;">
      <h2>${icon('clipboard', 18)} Detalle de rubros</h2>
    </header>
    <div class="table-wrap">
      ${items.length ? `<table class="data-table">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Estimado</th>
            <th>Real</th>
            <th>Abonado</th>
            <th>Saldo</th>
            <th class="right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((b) => {
            const cat = CATEGORIES[b.category] || { label: b.category || 'General', emoji: '💰' };
            const ven = vendorById[String(b.vendor_id)];
            const itemPays = paysByItem[String(b.id)] || [];
            const paid = itemPays.reduce((n, p) => n + Number(p.amount || 0), 0);
            const real = Number(b.actual ?? b.estimated ?? 0);
            const saldo = Math.max(0, real - paid);
            return `<tr>
              <td>
                <strong>${esc(b.concept)}</strong>
                <div class="task-meta" style="margin-top:4px;">
                  <span class="pill">${cat.emoji} ${esc(cat.label)}</span>
                  ${ven ? `<span class="pill pill-stage">${esc(ven.name)}</span>` : ''}
                  ${b.notes ? `<small class="muted">${esc(b.notes)}</small>` : ''}
                </div>
                ${itemPays.length ? `<div class="pay-list">
                  ${itemPays.map((p) => `<span class="pay-chip">${fmtMoney(p.amount)} · ${fmtDate(p.paid_on, { day: 'numeric', month: 'short' })}${p.method ? ` (${esc(p.method)})` : ''}
                    ${ctx.isAdmin ? `<button class="pay-del" data-del-pay="${esc(p.id)}" title="Borrar abono">×</button>` : ''}</span>`).join('')}
                </div>` : ''}
              </td>
              <td>${fmtMoney(b.estimated)}</td>
              <td>${b.actual != null ? `<strong>${fmtMoney(b.actual)}</strong>` : '<span class="muted">—</span>'}</td>
              <td class="txt-ok"><strong>${fmtMoney(paid)}</strong></td>
              <td>${saldo === 0 && real > 0 ? '<span class="pill pill-ok">Pagado</span>' : `<strong>${fmtMoney(saldo)}</strong>`}</td>
              <td class="right">
                ${ctx.isAdmin ? `<button class="chip-btn" data-pay="${esc(b.id)}">${icon('plus', 13)} Abono</button>
                  <button class="icon-btn" data-edit="${esc(b.id)}" title="Editar">${icon('edit', 15)}</button>
                  <button class="icon-btn icon-danger" data-del="${esc(b.id)}" title="Eliminar">${icon('trash', 15)}</button>` : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>` : `<div class="empty-state">${icon('wallet', 26)}<p>No hay rubros aún. Pulsa “Nuevo rubro” para armar tu presupuesto.</p></div>`}
    </div>
  </section>`;

  el.querySelector('#btn-export-budget-pdf').addEventListener('click', () => exportBudgetPdf({ wedding, items, payments, vendors }));
  el.querySelector('#btn-new-item')?.addEventListener('click', () => openItemModal(null, vendors));
  el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
    const it = items.find((x) => String(x.id) === String(b.dataset.edit));
    if (it) openItemModal(it, vendors);
  }));
  el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Eliminar este rubro y todos sus abonos?')) return;
    try { await db.remove('budget_items', b.dataset.del); toast('Rubro eliminado'); }
    catch (e) { toast(e.message, 'error'); }
  }));
  el.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => {
    const it = items.find((x) => String(x.id) === String(b.dataset.pay));
    if (it) openPayModal(it);
  }));
  el.querySelectorAll('[data-del-pay]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Borrar este abono?')) return;
    try { await db.remove('payments', b.dataset.delPay); toast('Abono eliminado'); }
    catch (e) { toast(e.message, 'error'); }
  }));
}

function openItemModal(item, vendors) {
  const isEdit = Boolean(item);
  openModal({
    title: isEdit ? 'Editar rubro' : 'Nuevo rubro del presupuesto',
    wide: true,
    submitLabel: isEdit ? 'Guardar' : 'Agregar rubro',
    body: `
      <label class="field"><span>Concepto *</span>
        <input name="concept" required value="${esc(item?.concept || '')}" placeholder="Ej. Banquete 100 platos">
      </label>
      <div class="form-grid">
        <label class="field"><span>Categoría</span>
          <select name="category">
            ${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${(item?.category || 'recepcion') === k ? 'selected' : ''}>${c.emoji} ${esc(c.label)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Proveedor vinculado</span>
          <select name="vendor_id">
            <option value="">Ninguno</option>
            ${vendors.map((v) => `<option value="${v.id}" ${String(item?.vendor_id) === String(v.id) ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Monto estimado (USD) *</span>
          <input name="estimated" type="number" min="0" step="0.01" required value="${esc(item?.estimated ?? 0)}">
        </label>
        <label class="field"><span>Costo real acordado (USD)</span>
          <input name="actual" type="number" min="0" step="0.01" value="${esc(item?.actual ?? '')}" placeholder="Opcional">
        </label>
      </div>
      <label class="field"><span>Notas</span>
        <textarea name="notes" rows="2">${esc(item?.notes || '')}</textarea>
      </label>`,
    onSubmit: async (fd) => {
      const s = (k) => String(fd.get(k) || '').trim() || null;
      const concept = s('concept');
      if (!concept) throw new Error('Escribe el concepto.');
      const payload = {
        concept,
        category: s('category') || 'recepcion',
        vendor_id: s('vendor_id'),
        estimated: Number(fd.get('estimated')) || 0,
        actual: s('actual') !== null ? Number(fd.get('actual')) : null,
        notes: s('notes'),
      };
      if (isEdit) { await db.update('budget_items', item.id, payload); toast('Rubro actualizado ✔'); }
      else { await db.insert('budget_items', payload); toast('Rubro agregado ✔'); }
    },
  });
}

function openPayModal(item) {
  openModal({
    title: `Registrar abono · ${item.concept}`,
    submitLabel: 'Guardar abono',
    body: `
      <div class="form-grid">
        <label class="field"><span>Monto abonado (USD) *</span>
          <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Ej. 250">
        </label>
        <label class="field"><span>Fecha del pago</span>
          <input name="paid_on" type="date" value="${todayISO()}">
        </label>
      </div>
      <label class="field"><span>Método de pago</span>
        <select name="method">${PAY_METHODS.map((m) => `<option value="${m}">${m}</option>`).join('')}</select>
      </label>
      <label class="field"><span>Comprobante / nota</span>
        <input name="note" placeholder="Ej. Anticipo 50 %, comprobante #123">
      </label>`,
    onSubmit: async (fd) => {
      const amount = Number(fd.get('amount'));
      if (!amount || amount <= 0) throw new Error('Ingresa un monto mayor a 0.');
      await db.insert('payments', {
        budget_item_id: item.id,
        amount,
        paid_on: String(fd.get('paid_on') || todayISO()),
        method: String(fd.get('method') || '').trim() || null,
        note: String(fd.get('note') || '').trim() || null,
      });
      toast(`Abono de ${fmtMoney(amount)} registrado ✔`);
    },
  });
}
