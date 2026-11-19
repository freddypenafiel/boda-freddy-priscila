// Módulo "Invitados": gestión de los 100 invitados, RSVP, grupos, WhatsApp y exportación CSV.
import * as db from '../db.js';
import { esc, toast, openModal } from '../ui.js';
import { icon } from '../icons.js';

const RSVP_LABELS = { pendiente: 'Pendiente', si: 'Confirmado', no: 'No asiste' };
const SIDE_LABELS = { ambos: 'Ambos', novio: 'Lado de Freddy', novia: 'Lado de Priscila' };
const fState = { group: 'all', rsvp: 'all', side: 'all', witness: 'all', q: '' };

function publicRsvpUrl(code) {
  const base = new URL('boda/', location.href).href;
  const demoQ = db.getMode() === 'demo' ? '&demo=1' : '';
  return `${base}?code=${encodeURIComponent(code)}${demoQ}`;
}

function cleanPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length === 10) return '593' + digits.slice(1);
  return digits;
}

function waUrl(guest, wedding) {
  const url = publicRsvpUrl(guest.rsvp_code);
  const compTxt = guest.companions > 0 ? ` (hemos reservado ${1 + guest.companions} cupos para ti y tus acompañantes)` : '';
  const msg = `¡Hola ${guest.full_name}! 🌿💍\n\nCon mucha alegría queremos invitarte a nuestra boda (${wedding.couple_names || 'Freddy & Priscila'}) el viernes 26 de febrero de 2027.${compTxt}\n\nPuedes ver todos los detalles y confirmar tu asistencia en este enlace personal:\n${url}\n\n¡Nos encantará contar contigo!`;
  const ph = cleanPhone(guest.phone);
  return ph ? `https://wa.me/${ph}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export async function renderInvitados(el, ctx) {
  const [wedding, guests, groups, tables] = await Promise.all([
    db.getWedding(),
    db.list('guests', { order: 'full_name' }),
    db.list('guest_groups', { order: 'id' }),
    db.list('seating_tables', { order: 'sort' }),
  ]);

  const groupById = Object.fromEntries(groups.map((g) => [String(g.id), g]));
  const tableById = Object.fromEntries(tables.map((t) => [String(t.id), t]));
  const target = wedding.guest_target || 100;

  const totalPersons = guests.reduce((n, g) => n + 1 + (g.companions || 0), 0);
  const confirmedPersons = guests.filter((g) => g.rsvp === 'si').reduce((n, g) => n + 1 + (g.companions_confirmed || 0), 0);
  const pendingPersons = guests.filter((g) => g.rsvp === 'pendiente').reduce((n, g) => n + 1 + (g.companions || 0), 0);
  const declinedPersons = guests.filter((g) => g.rsvp === 'no').reduce((n, g) => n + 1 + (g.companions || 0), 0);
  const nonWitness = guests.filter((g) => g.is_witness === false).length;

  el.innerHTML = `
  <header class="page-head">
    <div>
      <span class="eyebrow">${icon('users', 14)} Control con previsión · Prov. 22:3</span>
      <h1>Lista de Invitados</h1>
      <p>Organiza tus <strong>${target} invitados</strong> por grupo, envía invitaciones personales por WhatsApp y sigue las confirmaciones en tiempo real.</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-outline" id="btn-export-csv">${icon('download', 16)} Exportar CSV</button>
      ${ctx.isAdmin ? `<button class="btn btn-primary" id="btn-new-guest">${icon('userPlus', 16)} Agregar invitado</button>` : ''}
    </div>
  </header>

  <section class="kpi-strip">
    <div class="kpi-card"><span>Total en lista</span><strong>${totalPersons} <small>/ ${target}</small></strong><small class="muted">${guests.length} invitaciones</small></div>
    <div class="kpi-card kpi-ok"><span>Confirmados (Sí)</span><strong>${confirmedPersons}</strong><small class="muted">${guests.filter((g) => g.rsvp === 'si').length} familias/personas</small></div>
    <div class="kpi-card kpi-warn"><span>Pendientes</span><strong>${pendingPersons}</strong><small class="muted">por confirmar</small></div>
    <div class="kpi-card"><span>No asisten</span><strong>${declinedPersons}</strong><small class="muted">${nonWitness ? `${nonWitness} fam. no Testigos (Col. 4:6)` : 'Control de aforo'}</small></div>
  </section>

  <section class="toolbar card">
    <div class="search-box">
      ${icon('search', 16)}
      <input id="g-q" type="search" placeholder="Buscar por nombre, teléfono o nota…" value="${esc(fState.q)}">
    </div>
    <select id="g-group">
      <option value="all">Todos los grupos</option>
      ${groups.map((g) => `<option value="${g.id}" ${String(fState.group) === String(g.id) ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
    </select>
    <select id="g-rsvp">
      <option value="all">Todos los estados RSVP</option>
      <option value="si" ${fState.rsvp === 'si' ? 'selected' : ''}>Confirmados</option>
      <option value="pendiente" ${fState.rsvp === 'pendiente' ? 'selected' : ''}>Pendientes</option>
      <option value="no" ${fState.rsvp === 'no' ? 'selected' : ''}>No asisten</option>
    </select>
    <select id="g-side">
      <option value="all">Lado: todos</option>
      <option value="novio" ${fState.side === 'novio' ? 'selected' : ''}>Lado de Freddy</option>
      <option value="novia" ${fState.side === 'novia' ? 'selected' : ''}>Lado de Priscila</option>
      <option value="ambos" ${fState.side === 'ambos' ? 'selected' : ''}>Ambos</option>
    </select>
    <select id="g-wit">
      <option value="all">Todos</option>
      <option value="true" ${fState.witness === 'true' ? 'selected' : ''}>Hermanos / Testigos</option>
      <option value="false" ${fState.witness === 'false' ? 'selected' : ''}>Familiares no Testigos</option>
    </select>
  </section>

  <section class="card table-card">
    <div class="table-wrap" id="guests-table"></div>
  </section>`;

  const mount = el.querySelector('#guests-table');

  function paint() {
    const q = fState.q.trim().toLowerCase();
    const list = guests.filter((g) => {
      if (fState.group !== 'all' && String(g.group_id) !== String(fState.group)) return false;
      if (fState.rsvp !== 'all' && g.rsvp !== fState.rsvp) return false;
      if (fState.side !== 'all' && g.side !== fState.side) return false;
      if (fState.witness !== 'all' && String(Boolean(g.is_witness)) !== fState.witness) return false;
      if (q) {
        const hay = `${g.full_name} ${g.phone || ''} ${g.notes || ''} ${g.diet || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!list.length) {
      mount.innerHTML = `<div class="empty-state">${icon('users', 26)}<p>No hay invitados en esta vista. Usa “Agregar invitado” para empezar tu lista.</p></div>`;
      return;
    }

    mount.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Invitado</th>
          <th>Grupo</th>
          <th>Cupos</th>
          <th>RSVP</th>
          <th>Mesa</th>
          <th>Invitación</th>
          <th class="right">Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${list.map((g) => {
          const grp = groupById[String(g.group_id)];
          const tbl = tableById[String(g.table_id)];
          const totalC = 1 + (g.companions || 0);
          const confC = g.rsvp === 'si' ? 1 + (g.companions_confirmed || 0) : 0;
          return `<tr>
            <td>
              <div class="cell-main">
                <strong>${esc(g.full_name)}</strong>
                ${g.is_witness === false ? '<span class="pill pill-verse" title="Explicar con tacto cómo es la boda (Col. 4:6)">No Testigo</span>' : ''}
              </div>
              <small class="muted">
                ${g.phone ? esc(g.phone) + ' · ' : ''}${g.diet ? '🍽️ ' + esc(g.diet) + ' · ' : ''}${esc(g.notes || g.rsvp_message || '')}
              </small>
            </td>
            <td>${grp ? `<span class="pill" style="border-left:3px solid ${esc(grp.color || '#4A6B53')}">${esc(grp.name)}</span>` : '<span class="muted">—</span>'}</td>
            <td><strong>${totalC}</strong>${g.rsvp === 'si' ? `<small class="muted"> (${confC} sí)</small>` : ''}${g.children ? `<small class="muted"> · ${g.children} niño(s)</small>` : ''}</td>
            <td>
              ${ctx.isAdmin ? `<select class="mini-select rsvp-${g.rsvp}" data-rsvp="${esc(g.id)}">
                <option value="pendiente" ${g.rsvp === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                <option value="si" ${g.rsvp === 'si' ? 'selected' : ''}>Confirmado</option>
                <option value="no" ${g.rsvp === 'no' ? 'selected' : ''}>No asiste</option>
              </select>` : `<span class="pill rsvp-${g.rsvp}">${RSVP_LABELS[g.rsvp]}</span>`}
            </td>
            <td>${tbl ? `<span class="pill pill-stage">${esc(tbl.name)}</span>` : '<span class="muted">Sin mesa</span>'}</td>
            <td>
              <div class="btn-row">
                <button class="chip-btn chip-wa" data-wa="${esc(g.id)}" title="Enviar invitación por WhatsApp">
                  ${icon('whatsapp', 14)} ${g.invitation_sent ? 'Reenviar' : 'WhatsApp'}
                </button>
                <button class="icon-btn" data-copy="${esc(g.rsvp_code)}" title="Copiar enlace RSVP personal">${icon('copy', 14)}</button>
              </div>
            </td>
            <td class="right">
              ${ctx.isAdmin ? `<button class="icon-btn" data-edit="${esc(g.id)}" title="Editar">${icon('edit', 15)}</button>
                <button class="icon-btn icon-danger" data-del="${esc(g.id)}" title="Eliminar">${icon('trash', 15)}</button>` : ''}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

    mount.querySelectorAll('[data-rsvp]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        const g = guests.find((x) => String(x.id) === String(sel.dataset.rsvp));
        const val = sel.value;
        try {
          await db.update('guests', g.id, {
            rsvp: val,
            companions_confirmed: val === 'si' ? (g.companions || 0) : 0,
            rsvp_at: new Date().toISOString(),
          });
          toast(`RSVP de ${g.full_name}: ${RSVP_LABELS[val]}`);
        } catch (e) { toast(e.message, 'error'); }
      });
    });

    mount.querySelectorAll('[data-wa]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const g = guests.find((x) => String(x.id) === String(btn.dataset.wa));
        if (!g) return;
        window.open(waUrl(g, wedding), '_blank', 'noopener');
        if (ctx.isAdmin && !g.invitation_sent) {
          try { await db.update('guests', g.id, { invitation_sent: true }); } catch { /* noop */ }
        }
      });
    });

    mount.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const link = publicRsvpUrl(btn.dataset.copy);
        try {
          await navigator.clipboard.writeText(link);
          toast('Enlace personal RSVP copiado ✔');
        } catch {
          prompt('Copia este enlace RSVP:', link);
        }
      });
    });

    mount.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const g = guests.find((x) => String(x.id) === String(btn.dataset.edit));
        if (g) openGuestModal(g, groups, tables);
      });
    });

    mount.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este invitado de la lista?')) return;
        try { await db.remove('guests', btn.dataset.del); toast('Invitado eliminado'); }
        catch (e) { toast(e.message, 'error'); }
      });
    });
  }

  paint();

  el.querySelector('#g-q').addEventListener('input', (e) => { fState.q = e.target.value; paint(); });
  el.querySelector('#g-group').addEventListener('change', (e) => { fState.group = e.target.value; paint(); });
  el.querySelector('#g-rsvp').addEventListener('change', (e) => { fState.rsvp = e.target.value; paint(); });
  el.querySelector('#g-side').addEventListener('change', (e) => { fState.side = e.target.value; paint(); });
  el.querySelector('#g-wit').addEventListener('change', (e) => { fState.witness = e.target.value; paint(); });
  el.querySelector('#btn-new-guest')?.addEventListener('click', () => openGuestModal(null, groups, tables));
  el.querySelector('#btn-export-csv').addEventListener('click', () => exportCsv(guests, groupById, tableById));
}

function openGuestModal(g, groups, tables) {
  const isEdit = Boolean(g);
  openModal({
    title: isEdit ? 'Editar invitado' : 'Agregar invitado',
    wide: true,
    submitLabel: isEdit ? 'Guardar cambios' : 'Agregar a la lista',
    body: `
      <div class="form-grid">
        <label class="field"><span>Nombre completo / Familia *</span>
          <input name="full_name" required value="${esc(g?.full_name || '')}" placeholder="Ej. Carlos Gómez y esposa">
        </label>
        <label class="field"><span>Grupo</span>
          <select name="group_id">
            <option value="">Sin grupo</option>
            ${groups.map((gr) => `<option value="${gr.id}" ${String(g?.group_id) === String(gr.id) ? 'selected' : ''}>${esc(gr.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Lado</span>
          <select name="side">
            ${Object.entries(SIDE_LABELS).map(([k, v]) => `<option value="${k}" ${(g?.side || 'ambos') === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Teléfono (WhatsApp)</span>
          <input name="phone" type="tel" value="${esc(g?.phone || '')}" placeholder="0991234567">
        </label>
        <label class="field"><span>Acompañantes adicionales</span>
          <input name="companions" type="number" min="0" max="10" value="${esc(g?.companions ?? 0)}">
        </label>
        <label class="field"><span>Niños incluidos</span>
          <input name="children" type="number" min="0" max="10" value="${esc(g?.children ?? 0)}">
        </label>
        <label class="field"><span>Estado RSVP</span>
          <select name="rsvp">
            <option value="pendiente" ${(g?.rsvp || 'pendiente') === 'pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="si" ${g?.rsvp === 'si' ? 'selected' : ''}>Confirmado (Sí)</option>
            <option value="no" ${g?.rsvp === 'no' ? 'selected' : ''}>No asiste</option>
          </select>
        </label>
        <label class="field"><span>Mesa asignada</span>
          <select name="table_id">
            <option value="">Sin asignar</option>
            ${tables.map((t) => `<option value="${t.id}" ${String(g?.table_id) === String(t.id) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Restricción alimentaria / dieta</span>
          <input name="diet" value="${esc(g?.diet || '')}" placeholder="Ej. Sin gluten, vegetariano…">
        </label>
        <label class="field field-check">
          <input type="checkbox" name="is_witness" ${g?.is_witness !== false ? 'checked' : ''}>
          <span>Es hermano/a Testigo de Jehová</span>
        </label>
      </div>
      <label class="field"><span>Notas</span>
        <textarea name="notes" rows="2" placeholder="Observaciones…">${esc(g?.notes || '')}</textarea>
      </label>`,
    onSubmit: async (fd) => {
      const s = (k) => String(fd.get(k) || '').trim() || null;
      const full_name = s('full_name');
      if (!full_name) throw new Error('Escribe el nombre del invitado.');
      const companions = Math.max(0, Number(fd.get('companions')) || 0);
      const rsvp = s('rsvp') || 'pendiente';
      const payload = {
        full_name,
        group_id: s('group_id') ? Number(s('group_id')) : null,
        side: s('side') || 'ambos',
        phone: s('phone'),
        companions,
        companions_confirmed: rsvp === 'si' ? companions : 0,
        children: Math.max(0, Number(fd.get('children')) || 0),
        rsvp,
        table_id: s('table_id') ? Number(s('table_id')) : null,
        diet: s('diet'),
        is_witness: fd.get('is_witness') === 'on',
        notes: s('notes'),
      };
      if (isEdit) {
        await db.update('guests', g.id, payload);
        toast('Invitado actualizado ✔');
      } else {
        await db.insert('guests', payload);
        toast('Invitado agregado ✔');
      }
    },
  });
}

function exportCsv(guests, groupById, tableById) {
  const headers = ['Nombre', 'Grupo', 'Lado', 'Teléfono', 'Cupos', 'Confirmados', 'RSVP', 'Mesa', 'Dieta', 'Código RSVP', 'Notas'];
  const csvEsc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = guests.map((g) => [
    g.full_name,
    groupById[String(g.group_id)]?.name || '',
    SIDE_LABELS[g.side] || '',
    g.phone || '',
    1 + (g.companions || 0),
    g.rsvp === 'si' ? 1 + (g.companions_confirmed || 0) : 0,
    RSVP_LABELS[g.rsvp] || g.rsvp,
    tableById[String(g.table_id)]?.name || '',
    g.diet || '',
    g.rsvp_code || '',
    g.notes || g.rsvp_message || '',
  ].map(csvEsc).join(','));
  const blob = new Blob(['\uFEFF' + [headers.map(csvEsc).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'invitados_boda_freddy_priscila.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Lista exportada en CSV ✔');
}
