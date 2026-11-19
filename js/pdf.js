// Generador unificado de reportes PDF (Imprimir / Guardar como PDF) en Verde Salvia & Beige.
import { esc, toast, fmtMoney, fmtDate } from './ui.js';
import { STAGES, CATEGORIES } from './data/seed.js';

function openPrintDoc({ title, subtitle, verse, bodyHtml }) {
  const w = window.open('', '_blank');
  if (!w) {
    toast('Permite las ventanas emergentes en tu navegador para generar el PDF.', 'error');
    return;
  }
  const today = fmtDate(new Date().toISOString());
  w.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: 'Segoe UI', -apple-system, Arial, sans-serif;
    color: #1F2D24;
    background: #FFFFFF;
    max-width: 820px;
    margin: 0 auto;
    padding: 16px;
    font-size: 12px;
    line-height: 1.45;
  }
  .bar-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-bottom: 14px;
  }
  .btn-print {
    background: #2F4B38;
    color: #FFFFFF;
    border: none;
    border-radius: 8px;
    padding: 9px 18px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
  }
  .btn-print:hover { background: #3E6049; }
  header.doc-head {
    background: linear-gradient(135deg, #1F3527 0%, #2F4B38 60%, #4A6B53 100%);
    color: #FFFFFF;
    padding: 18px 22px;
    border-radius: 10px;
    border-bottom: 4px solid #B6863A;
    margin-bottom: 16px;
  }
  header.doc-head h1 { margin: 0 0 4px; font-size: 19px; letter-spacing: 0.6px; }
  header.doc-head .sub { color: #F5E6C8; font-size: 12.5px; margin: 0; }
  header.doc-head .verse { margin-top: 6px; font-style: italic; font-size: 11.5px; color: #E8F1EA; }
  .kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }
  .kpi {
    background: #F7F4EE;
    border: 1px solid #DFE6DF;
    border-top: 3px solid #4A6B53;
    border-radius: 7px;
    padding: 9px 11px;
  }
  .kpi span { display: block; font-size: 10px; text-transform: uppercase; color: #55665B; font-weight: 700; }
  .kpi strong { display: block; font-size: 16px; color: #1F3527; margin-top: 2px; }
  h2 {
    font-size: 13.5px;
    color: #2F4B38;
    border-bottom: 1.5px solid #D5E2D7;
    padding-bottom: 4px;
    margin: 16px 0 8px;
    page-break-after: avoid;
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11.5px; }
  th, td { border: 1px solid #D5E2D7; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #E9F0EA; color: #1F3527; font-weight: 700; }
  tr:nth-child(even) td { background: #FCFBF8; }
  .right { text-align: right; }
  .tag {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    background: #E9F0EA;
    color: #2F4B38;
  }
  .tag-ok   { background: #E8F5EE; color: #226B41; }
  .tag-warn { background: #FEF3E2; color: #A66316; }
  .tag-err  { background: #FDECEC; color: #B42318; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .box {
    border: 1px solid #D5E2D7;
    border-radius: 8px;
    padding: 10px 13px;
    background: #FCFBF8;
    page-break-inside: avoid;
  }
  .box h3 { margin: 0 0 6px; font-size: 12.5px; color: #2F4B38; }
  .box ul { margin: 0; padding-left: 16px; }
  .box li { margin-bottom: 3px; }
  .done { text-decoration: line-through; color: #6B7B70; }
  footer.doc-foot {
    margin-top: 18px;
    padding-top: 8px;
    border-top: 1px solid #DFE6DF;
    display: flex;
    justify-content: space-between;
    font-size: 10.5px;
    color: #55665B;
  }
  @media print {
    .bar-actions { display: none; }
    body { padding: 0; max-width: none; }
  }
</style>
</head>
<body>
  <div class="bar-actions">
    <button class="btn-print" onclick="window.print()">🖨️ Guardar como PDF / Imprimir</button>
  </div>
  <header class="doc-head">
    <h1>${esc(title)}</h1>
    <p class="sub">${esc(subtitle)}</p>
    ${verse ? `<div class="verse">${esc(verse)}</div>` : ''}
  </header>
  ${bodyHtml}
  <footer class="doc-foot">
    <span>Boda Freddy &amp; Priscila · Una boda que honra a Jehová</span>
    <span>Generado el ${esc(today)}</span>
  </footer>
</body>
</html>`);
  w.document.close();
}

export function exportTasksPdf({ wedding, tasks, principles }) {
  const pById = Object.fromEntries(principles.map((p) => [p.id, p]));
  const done = tasks.filter((t) => t.status === 'hecho').length;
  const inProg = tasks.filter((t) => t.status === 'en_progreso').length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const stagesHtml = STAGES.map((s) => {
    const list = tasks.filter((t) => t.stage === s.key);
    if (!list.length) return '';
    return `<h2>${esc(s.label)} — ${esc(s.hint)} (${list.filter((x) => x.status === 'hecho').length}/${list.length})</h2>
    <table>
      <thead><tr><th style="width:28px;">✓</th><th>Tarea y detalles</th><th style="width:110px;">Responsable</th><th style="width:90px;">Principio</th><th style="width:82px;">Fecha</th></tr></thead>
      <tbody>
        ${list.map((t) => {
          const p = pById[t.principle_id];
          const sym = t.status === 'hecho' ? '☑' : t.status === 'en_progreso' ? '◐' : '☐';
          return `<tr>
            <td style="text-align:center;font-size:14px;">${sym}</td>
            <td class="${t.status === 'hecho' ? 'done' : ''}"><strong>${esc(t.title)}</strong>${t.description ? `<br><small>${esc(t.description)}</small>` : ''}</td>
            <td>${esc(t.assignee || '—')}</td>
            <td>${p ? `<span class="tag">${esc(p.scripture)}</span>` : '—'}</td>
            <td>${t.due_date ? esc(fmtDate(t.due_date, { day: 'numeric', month: 'short', year: '2-digit' })) : '—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  }).join('');

  openPrintDoc({
    title: `Checklist de Tareas — ${wedding.couple_names || 'Freddy & Priscila'}`,
    subtitle: `Fecha de boda: ${wedding.wedding_date ? fmtDate(wedding.wedding_date) : '26 de febrero de 2027'} · Avance: ${pct}%`,
    verse: '“Háganlo todo de forma digna y ordenada” — 1 Corintios 14:40',
    bodyHtml: `
      <div class="kpis">
        <div class="kpi"><span>Total tareas</span><strong>${tasks.length}</strong></div>
        <div class="kpi"><span>Completadas</span><strong>${done}</strong></div>
        <div class="kpi"><span>En progreso</span><strong>${inProg}</strong></div>
        <div class="kpi"><span>Avance</span><strong>${pct}%</strong></div>
      </div>
      ${stagesHtml}`,
  });
}

export function exportGuestsPdf({ wedding, guests, groups, tables }) {
  const gById = Object.fromEntries(groups.map((g) => [String(g.id), g.name]));
  const tById = Object.fromEntries(tables.map((t) => [String(t.id), t.name]));
  const totalP = guests.reduce((n, g) => n + 1 + (g.companions || 0), 0);
  const confP = guests.filter((g) => g.rsvp === 'si').reduce((n, g) => n + 1 + (g.companions_confirmed || 0), 0);
  const pendP = guests.filter((g) => g.rsvp === 'pendiente').reduce((n, g) => n + 1 + (g.companions || 0), 0);
  const noP = guests.filter((g) => g.rsvp === 'no').reduce((n, g) => n + 1 + (g.companions || 0), 0);

  const rsvpBadge = (r) => r === 'si' ? '<span class="tag tag-ok">Confirmado</span>'
    : r === 'no' ? '<span class="tag tag-err">No asiste</span>'
    : '<span class="tag tag-warn">Pendiente</span>';

  openPrintDoc({
    title: `Lista Oficial de Invitados — ${wedding.couple_names || 'Freddy & Priscila'}`,
    subtitle: `Meta de aforo: ${wedding.guest_target || 100} invitados · ${guests.length} registros en lista`,
    verse: '“El prudente ve el peligro y se esconde” — Proverbios 22:3 · “Sigan la senda de la hospitalidad” — Romanos 12:13',
    bodyHtml: `
      <div class="kpis">
        <div class="kpi"><span>Total en lista</span><strong>${totalP} / ${wedding.guest_target || 100}</strong></div>
        <div class="kpi"><span>Confirmados (Sí)</span><strong>${confP}</strong></div>
        <div class="kpi"><span>Pendientes</span><strong>${pendP}</strong></div>
        <div class="kpi"><span>No asisten</span><strong>${noP}</strong></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Invitado / Familia</th><th>Grupo</th><th>Cupos</th><th>RSVP</th><th>Mesa</th><th>Teléfono / Notas</th></tr></thead>
        <tbody>
          ${guests.length ? guests.map((g, i) => `<tr>
            <td>${i + 1}</td>
            <td><strong>${esc(g.full_name)}</strong>${g.is_witness === false ? ' <span class="tag tag-warn">No Testigo</span>' : ''}${g.diet ? `<br><small>Dieta: ${esc(g.diet)}</small>` : ''}</td>
            <td>${esc(gById[String(g.group_id)] || '—')}</td>
            <td>${1 + (g.companions || 0)}${g.rsvp === 'si' ? ` (${1 + (g.companions_confirmed || 0)} sí)` : ''}</td>
            <td>${rsvpBadge(g.rsvp)}</td>
            <td>${esc(tById[String(g.table_id)] || 'Sin mesa')}</td>
            <td>${esc([g.phone, g.notes, g.rsvp_message].filter(Boolean).join(' · ') || '—')}</td>
          </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;">Sin invitados registrados todavía.</td></tr>'}
        </tbody>
      </table>`,
  });
}

export function exportBudgetPdf({ wedding, items, payments, vendors }) {
  const vById = Object.fromEntries(vendors.map((v) => [String(v.id), v.name]));
  const paysByItem = {};
  payments.forEach((p) => { (paysByItem[String(p.budget_item_id)] ||= []).push(p); });

  const target = Number(wedding.budget_target || 0);
  const totalEst = items.reduce((n, b) => n + Number(b.estimated || 0), 0);
  const totalReal = items.reduce((n, b) => n + Number(b.actual ?? b.estimated ?? 0), 0);
  const totalPaid = payments.reduce((n, p) => n + Number(p.amount || 0), 0);
  const balance = Math.max(0, totalReal - totalPaid);

  openPrintDoc({
    title: `Presupuesto y Pagos (USD) — ${wedding.couple_names || 'Freddy & Priscila'}`,
    subtitle: `Planificación sin deudas · Moneda: Dólares (USD)`,
    verse: 'Principio de sencillez y equilibrio financiero — 1 Juan 2:15-17 · Lucas 14:28',
    bodyHtml: `
      <div class="kpis">
        <div class="kpi"><span>Meta</span><strong>${fmtMoney(target || totalEst)}</strong></div>
        <div class="kpi"><span>Proyectado / Real</span><strong>${fmtMoney(totalReal)}</strong></div>
        <div class="kpi"><span>Total abonado</span><strong>${fmtMoney(totalPaid)}</strong></div>
        <div class="kpi"><span>Saldo pendiente</span><strong>${fmtMoney(balance)}</strong></div>
      </div>
      <h2>Detalle de Rubros</h2>
      <table>
        <thead><tr><th>Concepto</th><th>Categoría</th><th>Proveedor</th><th class="right">Estimado</th><th class="right">Real</th><th class="right">Abonado</th><th class="right">Saldo</th></tr></thead>
        <tbody>
          ${items.map((b) => {
            const paid = (paysByItem[String(b.id)] || []).reduce((n, p) => n + Number(p.amount || 0), 0);
            const real = Number(b.actual ?? b.estimated ?? 0);
            const saldo = Math.max(0, real - paid);
            const cat = CATEGORIES[b.category]?.label || b.category || 'General';
            return `<tr>
              <td><strong>${esc(b.concept)}</strong>${b.notes ? `<br><small>${esc(b.notes)}</small>` : ''}</td>
              <td>${esc(cat)}</td>
              <td>${esc(vById[String(b.vendor_id)] || '—')}</td>
              <td class="right">${fmtMoney(b.estimated)}</td>
              <td class="right">${b.actual != null ? fmtMoney(b.actual) : '—'}</td>
              <td class="right">${fmtMoney(paid)}</td>
              <td class="right"><strong>${fmtMoney(saldo)}</strong></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${payments.length ? `<h2>Historial de Abonos (${payments.length})</h2>
      <table>
        <thead><tr><th>Fecha</th><th>Rubro</th><th>Método</th><th>Nota</th><th class="right">Monto</th></tr></thead>
        <tbody>
          ${payments.map((p) => {
            const it = items.find((x) => String(x.id) === String(p.budget_item_id));
            return `<tr>
              <td>${esc(fmtDate(p.paid_on, { day: 'numeric', month: 'short', year: 'numeric' }))}</td>
              <td>${esc(it?.concept || '—')}</td>
              <td>${esc(p.method || '—')}</td>
              <td>${esc(p.note || '—')}</td>
              <td class="right"><strong>${fmtMoney(p.amount)}</strong></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>` : ''}`,
  });
}

export function exportVendorsPdf({ wedding, vendors }) {
  const statusMap = { cotizando: 'Cotizando', reservado: 'Reservado', pagado: 'Pagado', descartado: 'Descartado' };
  const confirmed = vendors.filter((v) => v.status === 'reservado' || v.status === 'pagado');
  const sum = confirmed.reduce((n, v) => n + Number(v.quote || 0), 0);

  openPrintDoc({
    title: `Directorio de Proveedores — ${wedding.couple_names || 'Freddy & Priscila'}`,
    subtitle: `${vendors.length} proveedores registrados · ${confirmed.length} reservados/pagados (${fmtMoney(sum)})`,
    verse: '“Los planes del que es diligente sin duda dan buenos resultados” — Proverbios 21:5',
    bodyHtml: `
      <table>
        <thead><tr><th>Categoría</th><th>Proveedor</th><th>Contacto y Teléfono</th><th>Estado</th><th class="right">Cotización</th><th>Notas</th></tr></thead>
        <tbody>
          ${vendors.length ? vendors.map((v) => `<tr>
            <td>${esc(v.category || '—')}</td>
            <td><strong>${esc(v.name)}</strong></td>
            <td>${esc([v.contact, v.phone, v.email].filter(Boolean).join(' · ') || '—')}</td>
            <td><span class="tag">${esc(statusMap[v.status] || v.status)}</span></td>
            <td class="right">${v.quote != null ? fmtMoney(v.quote) : '—'}</td>
            <td>${esc(v.notes || '—')}</td>
          </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;">Sin proveedores registrados todavía.</td></tr>'}
        </tbody>
      </table>`,
  });
}

export function exportFullWeddingPdf({ wedding, tasks, guests, team, budget, payments, songs }) {
  const done = tasks.filter((t) => t.status === 'hecho').length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const confP = guests.filter((g) => g.rsvp === 'si').reduce((n, g) => n + 1 + (g.companions_confirmed || 0), 0);
  const totalP = guests.reduce((n, g) => n + 1 + (g.companions || 0), 0);
  const totalReal = budget.reduce((n, b) => n + Number(b.actual ?? b.estimated ?? 0), 0);
  const totalPaid = payments.reduce((n, p) => n + Number(p.amount || 0), 0);

  const couples = team.filter((r) => /damas/i.test(r.role));
  const staff = team.filter((r) => !/damas/i.test(r.role));
  const pendingTasks = tasks.filter((t) => t.status !== 'hecho').slice(0, 12);

  openPrintDoc({
    title: `Resumen General de la Boda — ${wedding.couple_names || 'Freddy & Priscila'}`,
    subtitle: `${wedding.wedding_date ? fmtDate(wedding.wedding_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Viernes 26 de febrero de 2027'} · ${wedding.city || 'Azogues, Cañar'}`,
    verse: '“Ya sea que coman o beban o hagan cualquier otra cosa, háganlo todo para la gloria de Dios” — 1 Corintios 10:31',
    bodyHtml: `
      <div class="kpis">
        <div class="kpi"><span>Avance tareas</span><strong>${done}/${tasks.length} (${pct}%)</strong></div>
        <div class="kpi"><span>Invitados</span><strong>${confP} sí / ${totalP} lista</strong></div>
        <div class="kpi"><span>Presupuesto</span><strong>${fmtMoney(totalReal)}</strong></div>
        <div class="kpi"><span>Total abonado</span><strong>${fmtMoney(totalPaid)}</strong></div>
      </div>
      <div class="grid-2">
        <div class="box">
          <h3>Datos Clave de la Boda</h3>
          <ul>
            <li><strong>Salón del Reino:</strong> ${esc(wedding.kingdom_hall || 'Por definir')}</li>
            <li><strong>Orador del discurso:</strong> ${esc(wedding.speaker || 'Por definir')}</li>
            <li><strong>Boda civil:</strong> ${esc(wedding.civil_date ? fmtDate(wedding.civil_date) : 'Por definir')} ${wedding.civil_place ? `(${esc(wedding.civil_place)})` : ''}</li>
            <li><strong>Local de recepción:</strong> ${esc(wedding.reception_venue || 'Por definir')}</li>
            <li><strong>Director del Banquete:</strong> ${esc(wedding.banquet_director || 'Por definir')}</li>
            <li><strong>Código de vestimenta:</strong> ${esc(wedding.dress_colors || 'Verde salvia y beige')}</li>
          </ul>
        </div>
        <div class="box">
          <h3>Equipo y Mix de Baile</h3>
          <ul>
            ${couples.map((c, i) => `<li><strong>Pareja ${i + 1}:</strong> ${esc(c.partner || '')} &amp; ${esc(c.person || '')}</li>`).join('')}
            ${staff.map((r) => `<li><strong>${esc(r.role)}:</strong> ${esc(r.person || 'Por definir')}</li>`).join('')}
          </ul>
          ${songs.length ? `<p style="margin:6px 0 0;font-size:11px;"><strong>Mix (~8 min):</strong> ${songs.map((s) => esc(s.title)).join(' · ')}</p>` : ''}
        </div>
      </div>
      <h2>Próximas Tareas Pendientes (${pendingTasks.length})</h2>
      <table>
        <thead><tr><th>☐</th><th>Tarea</th><th>Responsable</th><th>Fecha límite</th></tr></thead>
        <tbody>
          ${pendingTasks.length ? pendingTasks.map((t) => `<tr>
            <td style="text-align:center;">☐</td>
            <td><strong>${esc(t.title)}</strong></td>
            <td>${esc(t.assignee || '—')}</td>
            <td>${t.due_date ? esc(fmtDate(t.due_date, { day: 'numeric', month: 'short', year: '2-digit' })) : '—'}</td>
          </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;">¡Todas las tareas están completas!</td></tr>'}
        </tbody>
      </table>`,
  });
}
