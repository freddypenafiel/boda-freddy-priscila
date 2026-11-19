// Módulo "Mesas": plano de 10-12 mesas con arrastrar y soltar + asignación rápida en móvil + hoja imprimible para acomodadores.
import * as db from '../db.js';
import { esc, toast, openModal } from '../ui.js';
import { icon } from '../icons.js';

function seatsOf(g) {
  if (g.rsvp === 'no') return 0;
  return 1 + (g.rsvp === 'si' ? (g.companions_confirmed ?? g.companions ?? 0) : (g.companions || 0));
}

export async function renderMesas(el, ctx) {
  const [wedding, tables, guests, groups] = await Promise.all([
    db.getWedding(),
    db.list('seating_tables', { order: 'sort' }),
    db.list('guests', { order: 'full_name' }),
    db.list('guest_groups', { order: 'id' }),
  ]);

  const groupById = Object.fromEntries(groups.map((g) => [String(g.id), g]));
  const activeGuests = guests.filter((g) => g.rsvp !== 'no');
  const unassigned = activeGuests.filter((g) => !g.table_id);

  const totalCap = tables.reduce((n, t) => n + Number(t.capacity || 0), 0);
  const seatedCount = activeGuests.filter((g) => g.table_id).reduce((n, g) => n + seatsOf(g), 0);
  const unseatedCount = unassigned.reduce((n, g) => n + seatsOf(g), 0);

  el.innerHTML = `
  <header class="page-head">
    <div>
      <span class="eyebrow">${icon('tables', 14)} Distribución ordenada · 1 Cor. 14:40</span>
      <h1>Plano de Mesas</h1>
      <p>Arrastra a cada invitado hacia su mesa (o usa el selector en celular). Ideal para organizar los <strong>${wedding.guest_target || 150} invitados</strong> en 15 mesas.</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-outline" id="btn-print-tables">${icon('printer', 16)} Lista para acomodadores</button>
      ${ctx.isAdmin ? `<button class="btn btn-primary" id="btn-new-table">${icon('plus', 16)} Nueva mesa</button>` : ''}
    </div>
  </header>

  <section class="kpi-strip">
    <div class="kpi-card"><span>Mesas creadas</span><strong>${tables.length}</strong><small class="muted">Capacidad total: ${totalCap} sillas</small></div>
    <div class="kpi-card kpi-ok"><span>Personas ubicadas</span><strong>${seatedCount}</strong><small class="muted">con mesa asignada</small></div>
    <div class="kpi-card ${unseatedCount ? 'kpi-warn' : ''}"><span>Sin asignar</span><strong>${unseatedCount}</strong><small class="muted">${unassigned.length} familias/invitados</small></div>
    <div class="kpi-card"><span>Sillas disponibles</span><strong>${Math.max(0, totalCap - seatedCount)}</strong><small class="muted">en las mesas actuales</small></div>
  </section>

  <div class="seating-layout">
    <aside class="card seating-pool dropzone" data-table="">
      <header class="card-head">
        <h2>${icon('users', 17)} Sin mesa (${unassigned.length})</h2>
      </header>
      <p class="muted" style="margin-bottom:10px;font-size:0.8rem;">Arrastra un invitado a una mesa o elige la mesa directamente.</p>
      <ul class="seat-list">
        ${unassigned.length ? unassigned.map((g) => guestChipHtml(g, groupById, tables, ctx.isAdmin)).join('')
          : `<li class="empty">${icon('check', 16)} ¡Todos los invitados activos tienen mesa!</li>`}
      </ul>
    </aside>

    <section class="tables-grid">
      ${tables.length ? tables.map((t) => {
        const members = activeGuests.filter((g) => String(g.table_id) === String(t.id));
        const used = members.reduce((n, g) => n + seatsOf(g), 0);
        const cap = Number(t.capacity || 10);
        const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
        const full = used > cap;
        return `<article class="card table-box dropzone ${full ? 'is-over' : ''}" data-table="${esc(t.id)}">
          <header class="card-head">
            <div>
              <h2>${esc(t.name)}</h2>
              <small class="${full ? 'txt-err' : 'muted'}"><strong>${used}/${cap}</strong> personas${full ? ' · ¡Excede capacidad!' : ''}</small>
            </div>
            ${ctx.isAdmin ? `<div class="btn-row">
              <button class="icon-btn" data-edit-table="${esc(t.id)}" title="Editar mesa">${icon('edit', 14)}</button>
              <button class="icon-btn icon-danger" data-del-table="${esc(t.id)}" title="Eliminar mesa">${icon('trash', 14)}</button>
            </div>` : ''}
          </header>
          <div class="bar bar-sm" style="margin:0 0 10px;"><span style="width:${pct}%"></span></div>
          <ul class="seat-list">
            ${members.length ? members.map((g) => guestChipHtml(g, groupById, tables, ctx.isAdmin)).join('')
              : `<li class="drop-hint">Suelta aquí un invitado…</li>`}
          </ul>
        </article>`;
      }).join('') : `<div class="card empty-state"><p>Aún no has creado mesas. Pulsa “Nueva mesa”.</p></div>`}
    </section>
  </div>`;

  // Drag & Drop (escritorio)
  if (ctx.isAdmin) {
    let draggedId = null;
    el.querySelectorAll('.seat-chip[draggable="true"]').forEach((chip) => {
      chip.addEventListener('dragstart', (e) => {
        draggedId = chip.dataset.guest;
        chip.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedId);
      });
      chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
    });

    el.querySelectorAll('.dropzone').forEach((zone) => {
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const gid = e.dataTransfer.getData('text/plain') || draggedId;
        if (!gid) return;
        const tid = zone.dataset.table ? Number(zone.dataset.table) : null;
        await assignGuest(gid, tid);
      });
    });

    // Selector rápido (móvil y escritorio)
    el.querySelectorAll('[data-move-guest]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        const tid = sel.value ? Number(sel.value) : null;
        await assignGuest(sel.dataset.moveGuest, tid);
      });
    });

    el.querySelector('#btn-new-table')?.addEventListener('click', () => openTableModal(null, tables.length));
    el.querySelectorAll('[data-edit-table]').forEach((b) => b.addEventListener('click', () => {
      const t = tables.find((x) => String(x.id) === String(b.dataset.editTable));
      if (t) openTableModal(t, tables.length);
    }));
    el.querySelectorAll('[data-del-table]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta mesa? Los invitados asignados quedarán en “Sin mesa”.')) return;
      try { await db.remove('seating_tables', b.dataset.delTable); toast('Mesa eliminada'); }
      catch (e) { toast(e.message, 'error'); }
    }));
  }

  el.querySelector('#btn-print-tables').addEventListener('click', () => printUsherList(wedding, tables, activeGuests));
}

function guestChipHtml(g, groupById, tables, isAdmin) {
  const grp = groupById[String(g.group_id)];
  const seats = seatsOf(g);
  return `<li class="seat-chip" draggable="${isAdmin ? 'true' : 'false'}" data-guest="${esc(g.id)}">
    <div class="seat-chip-info">
      <span class="seat-dot" style="background:${esc(grp?.color || '#4A6B53')}"></span>
      <strong>${esc(g.full_name)}</strong>
      <span class="pill">${seats} p.</span>
    </div>
    ${isAdmin ? `<select class="mini-select seat-sel" data-move-guest="${esc(g.id)}" aria-label="Mover a mesa">
      <option value="">Sin mesa</option>
      ${tables.map((t) => `<option value="${t.id}" ${String(g.table_id) === String(t.id) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
    </select>` : ''}
  </li>`;
}

async function assignGuest(guestId, tableId) {
  try {
    await db.update('guests', guestId, { table_id: tableId });
    toast(tableId ? 'Invitado ubicado en mesa ✔' : 'Invitado movido a Sin mesa');
  } catch (e) {
    toast(e.message, 'error');
  }
}

function openTableModal(table, count) {
  const isEdit = Boolean(table);
  openModal({
    title: isEdit ? 'Editar mesa' : 'Nueva mesa',
    submitLabel: isEdit ? 'Guardar' : 'Crear mesa',
    body: `
      <label class="field"><span>Nombre de la mesa *</span>
        <input name="name" required value="${esc(table?.name || `Mesa ${count}`)}" placeholder="Ej. Mesa 11 · Familia">
      </label>
      <div class="form-grid">
        <label class="field"><span>Capacidad (sillas)</span>
          <input name="capacity" type="number" min="2" max="24" value="${esc(table?.capacity ?? 10)}">
        </label>
        <label class="field"><span>Orden</span>
          <input name="sort" type="number" min="1" value="${esc(table?.sort ?? count + 1)}">
        </label>
      </div>`,
    onSubmit: async (fd) => {
      const name = String(fd.get('name') || '').trim();
      if (!name) throw new Error('Escribe el nombre de la mesa.');
      const payload = {
        name,
        capacity: Math.max(2, Number(fd.get('capacity')) || 10),
        sort: Number(fd.get('sort')) || count + 1,
      };
      if (isEdit) { await db.update('seating_tables', table.id, payload); toast('Mesa actualizada ✔'); }
      else { await db.insert('seating_tables', payload); toast('Mesa creada ✔'); }
    },
  });
}

function printUsherList(wedding, tables, guests) {
  const w = window.open('', '_blank');
  if (!w) return toast('Permite las ventanas emergentes para imprimir.', 'error');
  const tableById = Object.fromEntries(tables.map((t) => [String(t.id), t.name]));
  const sorted = [...guests].sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'));

  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Lista de Acomodadores · ${esc(wedding.couple_names || 'Freddy & Priscila')}</title>
  <style>
    body{font-family:Segoe UI,sans-serif;color:#1F2D24;padding:24px;max-width:900px;margin:0 auto;}
    h1{color:#2F4B38;border-bottom:3px solid #B6863A;padding-bottom:8px;margin-bottom:6px;font-size:20px;}
    h2{color:#2F4B38;margin:20px 0 8px;font-size:15px;}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;}
    th,td{border:1px solid #C8D5CA;padding:6px 8px;text-align:left;}
    th{background:#E9F0EA;color:#1F3527;}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    .box{border:1px solid #C8D5CA;border-radius:6px;padding:10px;page-break-inside:avoid;}
    .box h3{margin:0 0 6px;color:#2F4B38;font-size:13px;}
    .box ul{margin:0;padding-left:16px;font-size:12px;}
    @media print { .no-print{display:none;} }
  </style></head><body>
  <button class="no-print" onclick="window.print()" style="float:right;padding:8px 14px;background:#2F4B38;color:#fff;border:none;border-radius:6px;cursor:pointer;">🖨️ Imprimir / Guardar PDF</button>
  <h1>Lista de Mesas para Acomodadores — ${esc(wedding.couple_names || 'Freddy & Priscila')}</h1>
  <p style="font-size:12px;color:#55665B;">“Háganlo todo de forma digna y ordenada” (1 Cor. 14:40) · Total activos: ${guests.reduce((n, g) => n + seatsOf(g), 0)} personas</p>
  <h2>1. Lista Alfabética de Invitados</h2>
  <table><thead><tr><th>Invitado</th><th>Personas</th><th>Mesa</th><th>Estado</th><th>Notas / Dieta</th></tr></thead><tbody>
  ${sorted.map((g) => `<tr><td><strong>${esc(g.full_name)}</strong></td><td>${seatsOf(g)}</td><td>${esc(tableById[String(g.table_id)] || 'Sin asignar')}</td><td>${g.rsvp === 'si' ? 'Confirmado' : 'Pendiente'}</td><td>${esc([g.diet, g.notes].filter(Boolean).join(' · '))}</td></tr>`).join('')}
  </tbody></table>
  <h2>2. Distribución por Mesa</h2>
  <div class="grid">
  ${tables.map((t) => {
    const ms = guests.filter((g) => String(g.table_id) === String(t.id));
    const used = ms.reduce((n, g) => n + seatsOf(g), 0);
    return `<div class="box"><h3>${esc(t.name)} (${used}/${t.capacity})</h3><ul>${ms.length ? ms.map((g) => `<li>${esc(g.full_name)} (${seatsOf(g)})</li>`).join('') : '<li><em>Sin invitados asignados</em></li>'}</ul></div>`;
  }).join('')}
  </div></body></html>`);
  w.document.close();
}
