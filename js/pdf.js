// Motor unificado de PDFs reales (.pdf) en Verde Salvia & Beige.
// Funciona en Web (descarga directa .pdf) y en APK Android (Capacitor Filesystem + Share nativo).
// Siempre abre dentro de la app con botón "← Volver" y soporte del botón Atrás de Android.
import { esc, toast, fmtMoney, fmtDate } from './ui.js';
import { STAGES, CATEGORIES } from './data/seed.js';

let html2pdfPromise = null;

function loadHtml2Pdf() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  if (!html2pdfPromise) {
    html2pdfPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = './js/vendor/html2pdf.bundle.min.js';
      s.onload = () => (window.html2pdf ? resolve(window.html2pdf) : reject(new Error('No se pudo cargar html2pdf')));
      s.onerror = () => reject(new Error('No se pudo cargar el generador de PDF'));
      document.head.appendChild(s);
    });
  }
  return html2pdfPromise;
}

function slugFile(name, ext = 'pdf') {
  const clean = String(name || 'documento')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
  return `${clean || 'Boda_Freddy_Priscila'}.${ext}`;
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

/** Guarda o comparte un archivo de texto (ej. CSV) compatible con Web y APK Android. */
export async function downloadOrShareText(filename, content, mime = 'text/csv;charset=utf-8', title = 'Exportar archivo') {
  const cap = window.Capacitor;
  if (cap?.Plugins?.Filesystem && cap?.Plugins?.Share) {
    try {
      const saved = await cap.Plugins.Filesystem.writeFile({
        path: filename,
        data: utf8ToBase64('\uFEFF' + content),
        directory: 'CACHE',
      });
      await cap.Plugins.Share.share({
        title,
        text: `${title} — Boda Freddy & Priscila`,
        url: saved.uri,
        dialogTitle: 'Guardar o compartir archivo',
      });
      return;
    } catch (e) {
      if (!/cancel/i.test(String(e?.message || ''))) toast('No se pudo compartir: ' + e.message, 'error');
      return;
    }
  }
  const blob = new Blob(['\uFEFF' + content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Archivo descargado ✔');
}

const PDF_STYLES = `
  .pdf-sheet {
    font-family: 'Segoe UI', -apple-system, Arial, sans-serif;
    color: #1F2D24;
    background: #FFFFFF;
    width: 100%;
    max-width: 794px;
    margin: 0 auto;
    padding: 20px 22px;
    font-size: 11.5px;
    line-height: 1.44;
    box-shadow: 0 8px 30px rgba(31, 53, 39, 0.14);
    border-radius: 10px;
  }
  .pdf-sheet * { box-sizing: border-box; }
  .pdf-head {
    background: linear-gradient(135deg, #1F3527 0%, #2F4B38 60%, #4A6B53 100%);
    color: #FFFFFF;
    padding: 16px 20px;
    border-radius: 9px;
    border-bottom: 4px solid #B6863A;
    margin-bottom: 14px;
  }
  .pdf-head .kicker {
    display: inline-block;
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: #F5E6C8;
    background: rgba(255,255,255,0.14);
    border: 1px solid rgba(245,230,200,0.45);
    padding: 2px 9px;
    border-radius: 999px;
    margin-bottom: 6px;
    font-weight: 700;
  }
  .pdf-head h1 { margin: 0 0 4px; font-size: 18px; letter-spacing: 0.6px; color: #FFFFFF; }
  .pdf-head .sub { color: #F5E6C8; font-size: 12px; margin: 0; }
  .pdf-head .verse { margin-top: 6px; font-style: italic; font-size: 11px; color: #E8F1EA; }
  .pdf-kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }
  .pdf-kpi {
    background: #F7F4EE;
    border: 1px solid #DFE6DF;
    border-top: 3px solid #4A6B53;
    border-radius: 7px;
    padding: 8px 10px;
  }
  .pdf-kpi span { display: block; font-size: 9.5px; text-transform: uppercase; color: #55665B; font-weight: 700; }
  .pdf-kpi strong { display: block; font-size: 14.5px; color: #1F3527; margin-top: 2px; }
  .pdf-sheet h2 {
    font-size: 13px;
    color: #2F4B38;
    border-bottom: 1.5px solid #D5E2D7;
    padding-bottom: 4px;
    margin: 14px 0 8px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .pdf-sheet table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
  .pdf-sheet th, .pdf-sheet td { border: 1px solid #D5E2D7; padding: 5.5px 7px; text-align: left; vertical-align: top; }
  .pdf-sheet th { background: #E9F0EA; color: #1F3527; font-weight: 700; }
  .pdf-sheet tr:nth-child(even) td { background: #FCFBF8; }
  .pdf-sheet .right { text-align: right; }
  .pdf-tag {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 999px;
    font-size: 9.5px;
    font-weight: 700;
    background: #E9F0EA;
    color: #2F4B38;
  }
  .pdf-tag-verse { background: #FDF6E4; color: #7D581B; border: 1px solid #E6D0A3; }
  .pdf-tag-ok    { background: #E8F5EE; color: #226B41; }
  .pdf-tag-warn  { background: #FEF3E2; color: #A66316; }
  .pdf-tag-err   { background: #FDECEC; color: #B42318; }
  .pdf-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .pdf-box {
    border: 1px solid #C8D6CB;
    border-radius: 8px;
    padding: 10px 12px;
    background: #FCFBF8;
    page-break-inside: avoid;
  }
  .pdf-box h3 {
    margin: 0 0 7px;
    font-size: 12px;
    color: #2F4B38;
    border-bottom: 1px solid #E4ECE5;
    padding-bottom: 4px;
    text-transform: uppercase;
  }
  .pdf-box ul { margin: 0; padding-left: 15px; list-style: disc; }
  .pdf-box li { margin-bottom: 4px; }
  .pdf-check-list { list-style: none !important; padding-left: 0 !important; }
  .pdf-check-list li { display: flex; gap: 6px; align-items: flex-start; margin-bottom: 5px; }
  .pdf-chk { color: #2F4B38; font-weight: 700; flex-shrink: 0; }
  .pdf-photos { display: grid; grid-template-columns: 1.45fr 0.55fr; gap: 8px; margin-top: 8px; }
  .pdf-photo { border: 1px solid #C8D6CB; border-radius: 6px; padding: 4px; background: #FFF; text-align: center; }
  .pdf-photo img { width: 100%; height: 118px; object-fit: cover; object-position: center top; border-radius: 4px; }
  .pdf-photo small { display: block; margin-top: 3px; font-size: 9px; font-weight: 700; color: #2F4B38; text-transform: uppercase; }
  .pdf-swatches { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
  .pdf-sw { display: inline-flex; align-items: center; gap: 4px; font-size: 9.5px; font-weight: 600; background: #F7F4EE; border: 1px solid #E2D9C5; padding: 2px 7px; border-radius: 999px; }
  .pdf-sw i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; border: 1px solid rgba(0,0,0,0.2); }
  .pdf-callout {
    margin-top: 10px;
    padding: 9px 12px;
    border-radius: 7px;
    background: linear-gradient(135deg, #E9F0EA 0%, #F7EFE0 100%);
    border-left: 4px solid #2F4B38;
    font-size: 11px;
  }
  .pdf-done { text-decoration: line-through; color: #6B7B70; }
  .pdf-foot {
    margin-top: 14px;
    padding-top: 7px;
    border-top: 1.5px solid #DFE6DF;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #55665B;
  }
  @media (max-width: 640px) {
    .pdf-sheet { padding: 14px 12px; font-size: 11px; }
    .pdf-kpis { grid-template-columns: repeat(2, 1fr); }
    .pdf-grid-2 { grid-template-columns: 1fr; }
  }
`;

function openInAppPdfViewer({ title, subtitle, kicker, verse, bodyHtml, fileBase }) {
  const today = fmtDate(new Date().toISOString());
  const filename = slugFile(fileBase || title, 'pdf');

  // Asegurar estilos del documento una sola vez
  if (!document.getElementById('pdf-doc-styles')) {
    const st = document.createElement('style');
    st.id = 'pdf-doc-styles';
    st.textContent = PDF_STYLES;
    document.head.appendChild(st);
  }

  const viewer = document.createElement('div');
  viewer.className = 'pdf-viewer-overlay';
  viewer.innerHTML = `
    <header class="pdf-viewer-bar">
      <button type="button" class="btn btn-light pdf-back-btn" id="pdf-btn-back">← Volver</button>
      <div class="pdf-bar-title">${esc(title)}</div>
      <div class="btn-row">
        <button type="button" class="btn btn-gold" id="pdf-btn-download">⬇️ Descargar PDF</button>
        ${!window.Capacitor ? `<button type="button" class="btn btn-light pdf-print-desk" id="pdf-btn-print">🖨️ Imprimir</button>` : ''}
      </div>
    </header>
    <div class="pdf-viewer-scroll">
      <article class="pdf-sheet" id="pdf-render-target">
        <header class="pdf-head">
          ${kicker ? `<span class="kicker">${esc(kicker)}</span>` : ''}
          <h1>${esc(title)}</h1>
          <p class="sub">${esc(subtitle)}</p>
          ${verse ? `<div class="verse">${esc(verse)}</div>` : ''}
        </header>
        ${bodyHtml}
        <footer class="pdf-foot">
          <span>Boda Freddy &amp; Priscila · “Hagan todo para la gloria de Dios” (1 Cor. 10:31)</span>
          <span>Actualizado: ${esc(today)}</span>
        </footer>
      </article>
    </div>`;

  document.body.appendChild(viewer);
  requestAnimationFrame(() => viewer.classList.add('open'));

  let closed = false;
  const doClose = (fromPop = false) => {
    if (closed) return;
    closed = true;
    window.removeEventListener('popstate', onPop);
    document.removeEventListener('keydown', onKey);
    viewer.classList.remove('open');
    setTimeout(() => viewer.remove(), 220);
    if (!fromPop && history.state?.pdfViewer) history.back();
  };
  const onPop = () => doClose(true);
  const onKey = (e) => { if (e.key === 'Escape') doClose(false); };

  try { history.pushState({ pdfViewer: true }, ''); } catch { /* noop */ }
  window.addEventListener('popstate', onPop);
  document.addEventListener('keydown', onKey);

  viewer.querySelector('#pdf-btn-back').addEventListener('click', () => doClose(false));

  // Imprimir en escritorio
  viewer.querySelector('#pdf-btn-print')?.addEventListener('click', () => {
    const content = viewer.querySelector('#pdf-render-target').outerHTML;
    const w = window.open('', '_blank');
    if (!w) { window.print(); return; }
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>@page{size:A4 portrait;margin:10mm;}body{margin:0;padding:0;background:#fff;}${PDF_STYLES}.pdf-sheet{box-shadow:none;max-width:none;padding:0;}</style></head><body>${content}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  });

  // Descargar / Compartir PDF real (.pdf)
  viewer.querySelector('#pdf-btn-download').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const prev = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = '⏳ Generando PDF…';
    try {
      const h2p = await loadHtml2Pdf();
      const target = viewer.querySelector('#pdf-render-target');
      // Clonar con ancho fijo A4 para que el PDF siempre salga nítido y bien maquetado aunque se genere desde un celular
      const cloneWrap = document.createElement('div');
      cloneWrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;z-index:-1;';
      const clone = target.cloneNode(true);
      clone.style.boxShadow = 'none';
      clone.style.borderRadius = '0';
      clone.style.maxWidth = '794px';
      clone.style.width = '794px';
      cloneWrap.appendChild(clone);
      document.body.appendChild(cloneWrap);

      const opt = {
        margin: [8, 8, 8, 8],
        filename,
        image: { type: 'jpeg', quality: 0.94 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true, width: 794, windowWidth: 794 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };

      const cap = window.Capacitor;
      if (cap?.Plugins?.Filesystem && cap?.Plugins?.Share) {
        const dataUri = await h2p().set(opt).from(clone).outputPdf('datauristring');
        cloneWrap.remove();
        const base64 = dataUri.split(',')[1];
        const saved = await cap.Plugins.Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: 'CACHE',
        });
        await cap.Plugins.Share.share({
          title,
          text: `${title} — Boda Freddy & Priscila`,
          url: saved.uri,
          dialogTitle: 'Guardar o compartir PDF',
        });
        toast('PDF listo para guardar o compartir ✔');
      } else {
        await h2p().set(opt).from(clone).save();
        cloneWrap.remove();
        toast(`PDF descargado: ${filename} ✔`);
      }
    } catch (err) {
      console.error(err);
      toast('Error al generar PDF: ' + (err.message || err), 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = prev;
    }
  });
}

/* =====================================================================
   Exportadores sincronizados en tiempo real con la base de datos
   ===================================================================== */

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
      <thead><tr><th style="width:26px;">✓</th><th>Tarea y detalles</th><th style="width:105px;">Responsable</th><th style="width:86px;">Principio</th><th style="width:78px;">Fecha</th></tr></thead>
      <tbody>
        ${list.map((t) => {
          const p = pById[t.principle_id];
          const sym = t.status === 'hecho' ? '☑' : t.status === 'en_progreso' ? '◐' : '☐';
          return `<tr>
            <td style="text-align:center;font-size:13px;">${sym}</td>
            <td class="${t.status === 'hecho' ? 'pdf-done' : ''}"><strong>${esc(t.title)}</strong>${t.description ? `<br><small>${esc(t.description)}</small>` : ''}</td>
            <td>${esc(t.assignee || '—')}</td>
            <td>${p ? `<span class="pdf-tag pdf-tag-verse">${esc(p.scripture)}</span>` : '—'}</td>
            <td>${t.due_date ? esc(fmtDate(t.due_date, { day: 'numeric', month: 'short', year: '2-digit' })) : '—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  }).join('');

  openInAppPdfViewer({
    kicker: '📋 Checklist Oficial de Organización',
    title: `Tareas de la Boda — ${wedding.couple_names || 'Freddy & Priscila'}`,
    subtitle: `Fecha: ${wedding.wedding_date ? fmtDate(wedding.wedding_date) : '26 de febrero de 2027'} · Avance: ${pct}%`,
    verse: '“Háganlo todo de forma digna y ordenada” — 1 Corintios 14:40',
    fileBase: 'Checklist_Tareas_Boda_Freddy_Priscila',
    bodyHtml: `
      <div class="pdf-kpis">
        <div class="pdf-kpi"><span>Total tareas</span><strong>${tasks.length}</strong></div>
        <div class="pdf-kpi"><span>Completadas</span><strong>${done}</strong></div>
        <div class="pdf-kpi"><span>En progreso</span><strong>${inProg}</strong></div>
        <div class="pdf-kpi"><span>Avance</span><strong>${pct}%</strong></div>
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

  const rsvpBadge = (r) => r === 'si' ? '<span class="pdf-tag pdf-tag-ok">Confirmado</span>'
    : r === 'no' ? '<span class="pdf-tag pdf-tag-err">No asiste</span>'
    : '<span class="pdf-tag pdf-tag-warn">Pendiente</span>';

  openInAppPdfViewer({
    kicker: '👥 Control Oficial de Invitados · Prov. 22:3',
    title: `Lista de Invitados — ${wedding.couple_names || 'Freddy & Priscila'}`,
    subtitle: `Meta de aforo: ${wedding.guest_target || 150} personas · ${guests.length} invitaciones registradas`,
    verse: '“Sigan la senda de la hospitalidad” — Romanos 12:13',
    fileBase: 'Lista_Invitados_Boda_Freddy_Priscila',
    bodyHtml: `
      <div class="pdf-kpis">
        <div class="pdf-kpi"><span>Total en lista</span><strong>${totalP} / ${wedding.guest_target || 150}</strong></div>
        <div class="pdf-kpi"><span>Confirmados (Sí)</span><strong>${confP}</strong></div>
        <div class="pdf-kpi"><span>Pendientes</span><strong>${pendP}</strong></div>
        <div class="pdf-kpi"><span>No asisten</span><strong>${noP}</strong></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Invitado / Familia</th><th>Grupo</th><th>Cupos</th><th>RSVP</th><th>Mesa</th><th>Teléfono / Notas</th></tr></thead>
        <tbody>
          ${guests.length ? guests.map((g, i) => `<tr>
            <td>${i + 1}</td>
            <td><strong>${esc(g.full_name)}</strong>${g.is_witness === false ? ' <span class="pdf-tag pdf-tag-warn">No Testigo</span>' : ''}${g.diet ? `<br><small>Dieta: ${esc(g.diet)}</small>` : ''}</td>
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

export function exportSeatingPdf({ wedding, tables, guests }) {
  const seatsOf = (g) => g.rsvp === 'no' ? 0 : 1 + (g.rsvp === 'si' ? (g.companions_confirmed ?? g.companions ?? 0) : (g.companions || 0));
  const active = guests.filter((g) => g.rsvp !== 'no');
  const tableById = Object.fromEntries(tables.map((t) => [String(t.id), t.name]));
  const sorted = [...active].sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'));
  const totalSeats = active.reduce((n, g) => n + seatsOf(g), 0);

  openInAppPdfViewer({
    kicker: '🪑 Plano de Mesas para Acomodadores · 1 Cor. 14:40',
    title: `Distribución de Mesas — ${wedding.couple_names || 'Freddy & Priscila'}`,
    subtitle: `${tables.length} mesas configuradas · ${totalSeats} personas activas (Meta: ${wedding.guest_target || 150})`,
    verse: '“Sigan la senda de la hospitalidad” — Romanos 12:13 · “Háganlo todo de forma digna y ordenada” — 1 Cor. 14:40',
    fileBase: 'Plano_Mesas_Acomodadores_Freddy_Priscila',
    bodyHtml: `
      <h2>1. Lista Alfabética para la Entrada</h2>
      <table>
        <thead><tr><th>Invitado</th><th>Personas</th><th>Mesa asignada</th><th>Estado</th><th>Notas / Dieta</th></tr></thead>
        <tbody>
          ${sorted.length ? sorted.map((g) => `<tr>
            <td><strong>${esc(g.full_name)}</strong></td>
            <td>${seatsOf(g)}</td>
            <td><strong>${esc(tableById[String(g.table_id)] || 'Sin asignar')}</strong></td>
            <td>${g.rsvp === 'si' ? '<span class="pdf-tag pdf-tag-ok">Confirmado</span>' : '<span class="pdf-tag pdf-tag-warn">Pendiente</span>'}</td>
            <td>${esc([g.diet, g.notes].filter(Boolean).join(' · ') || '—')}</td>
          </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;">Aún no hay invitados registrados.</td></tr>'}
        </tbody>
      </table>
      <h2>2. Distribución Mesa por Mesa</h2>
      <div class="pdf-grid-2">
        ${tables.map((t) => {
          const ms = active.filter((g) => String(g.table_id) === String(t.id));
          const used = ms.reduce((n, g) => n + seatsOf(g), 0);
          return `<div class="pdf-box">
            <h3>${esc(t.name)} (${used}/${t.capacity} sillas)</h3>
            <ul>${ms.length ? ms.map((g) => `<li><strong>${esc(g.full_name)}</strong> (${seatsOf(g)} p.)</li>`).join('') : '<li><em>Sin invitados asignados todavía</em></li>'}</ul>
          </div>`;
        }).join('')}
      </div>`,
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

  openInAppPdfViewer({
    kicker: '💰 Planificación Financiera · Cero Deudas',
    title: `Presupuesto y Pagos (USD) — ${wedding.couple_names || 'Freddy & Priscila'}`,
    subtitle: `Sencillez, equilibrio y paz económica · Moneda: USD`,
    verse: 'Principio de modestia y presupuesto realista — 1 Juan 2:15-17 · Lucas 14:28',
    fileBase: 'Presupuesto_Boda_Freddy_Priscila',
    bodyHtml: `
      <div class="pdf-kpis">
        <div class="pdf-kpi"><span>Meta</span><strong>${fmtMoney(target || totalEst)}</strong></div>
        <div class="pdf-kpi"><span>Proyectado / Real</span><strong>${fmtMoney(totalReal)}</strong></div>
        <div class="pdf-kpi"><span>Total abonado</span><strong>${fmtMoney(totalPaid)}</strong></div>
        <div class="pdf-kpi"><span>Saldo pendiente</span><strong>${fmtMoney(balance)}</strong></div>
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

  openInAppPdfViewer({
    kicker: '📦 Proveedores y Cotizaciones · Prov. 21:5',
    title: `Directorio de Proveedores — ${wedding.couple_names || 'Freddy & Priscila'}`,
    subtitle: `${vendors.length} proveedores · ${confirmed.length} reservados/pagados (${fmtMoney(sum)})`,
    verse: '“Los planes del que es diligente sin duda dan buenos resultados” — Proverbios 21:5',
    fileBase: 'Proveedores_Boda_Freddy_Priscila',
    bodyHtml: `
      <table>
        <thead><tr><th>Categoría</th><th>Proveedor</th><th>Contacto y Teléfono</th><th>Estado</th><th class="right">Cotización</th><th>Notas</th></tr></thead>
        <tbody>
          ${vendors.length ? vendors.map((v) => `<tr>
            <td>${esc(v.category || '—')}</td>
            <td><strong>${esc(v.name)}</strong></td>
            <td>${esc([v.contact, v.phone, v.email].filter(Boolean).join(' · ') || '—')}</td>
            <td><span class="pdf-tag">${esc(statusMap[v.status] || v.status)}</span></td>
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
  const dirName = wedding.banquet_director || staff.find((r) => /director/i.test(r.role))?.person || 'Por definir';
  const spkName = wedding.speaker || staff.find((r) => /orador/i.test(r.role))?.person || 'Por definir';
  const pendingTasks = tasks.filter((t) => t.status !== 'hecho').slice(0, 12);

  openInAppPdfViewer({
    kicker: '💍 Resumen Ejecutivo de la Boda',
    title: `Plan General — ${wedding.couple_names || 'Freddy & Priscila'}`,
    subtitle: `${wedding.wedding_date ? fmtDate(wedding.wedding_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Viernes 26 de febrero de 2027'} · ${wedding.city || 'Azogues, Cañar'}`,
    verse: '“Ya sea que coman o beban o hagan cualquier otra cosa, háganlo todo para la gloria de Dios” — 1 Corintios 10:31',
    fileBase: 'Resumen_General_Boda_Freddy_Priscila',
    bodyHtml: `
      <div class="pdf-kpis">
        <div class="pdf-kpi"><span>Avance tareas</span><strong>${done}/${tasks.length} (${pct}%)</strong></div>
        <div class="pdf-kpi"><span>Invitados</span><strong>${confP} sí / ${totalP} lista</strong></div>
        <div class="pdf-kpi"><span>Presupuesto</span><strong>${fmtMoney(totalReal)}</strong></div>
        <div class="pdf-kpi"><span>Total abonado</span><strong>${fmtMoney(totalPaid)}</strong></div>
      </div>
      <div class="pdf-grid-2">
        <div class="pdf-box">
          <h3>Datos Clave de la Boda</h3>
          <ul>
            <li><strong>Aforo previsto:</strong> ${wedding.guest_target || 150} invitados</li>
            <li><strong>Salón del Reino:</strong> ${esc(wedding.kingdom_hall || 'Por definir')}</li>
            <li><strong>Orador del discurso:</strong> ${esc(spkName)}</li>
            <li><strong>Boda civil:</strong> ${esc(wedding.civil_date ? fmtDate(wedding.civil_date) : 'Por definir')} ${wedding.civil_place ? `(${esc(wedding.civil_place)})` : ''}</li>
            <li><strong>Local de recepción:</strong> ${esc(wedding.reception_venue || 'Por definir')}</li>
            <li><strong>Director del Banquete:</strong> ${esc(dirName)}</li>
            <li><strong>Código de vestimenta:</strong> ${esc(wedding.dress_colors || 'Verde salvia y beige')}</li>
          </ul>
        </div>
        <div class="pdf-box">
          <h3>Equipo y Mix de Baile</h3>
          <ul>
            ${couples.map((c, i) => `<li><strong>Pareja ${i + 1}:</strong> ${esc(c.partner || '')} &amp; ${esc(c.person || '')}</li>`).join('')}
            ${staff.map((r) => `<li><strong>${esc(r.role)}:</strong> ${esc(r.person || 'Por definir')}</li>`).join('')}
          </ul>
          ${songs.length ? `<p style="margin:6px 0 0;font-size:10.5px;"><strong>Mix (~8 min):</strong> ${songs.map((s) => esc(s.title)).join(' · ')}</p>` : ''}
        </div>
      </div>
      <h2>Próximas Tareas Pendientes (${pendingTasks.length})</h2>
      <table>
        <thead><tr><th style="width:26px;">☐</th><th>Tarea</th><th>Responsable</th><th>Fecha límite</th></tr></thead>
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

/**
 * Genera el PDF elegante por Rol (sincronizado en vivo con los nombres reales, parejas, tareas y canciones).
 * Acepta 'damas' | 'director' | 'audio' | 'acomodadores' | un objeto role individual.
 */
export function exportRoleGuidePdf(kindOrRole, { wedding, couples, staff, songs, guests, tables, tasks = [] }) {
  const dateTxt = wedding.wedding_date
    ? fmtDate(wedding.wedding_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Viernes 26 de febrero de 2027';

  const findRole = (re) => staff.find((r) => re.test(r.role));
  const tasksFor = (person) => {
    if (!person) return [];
    const low = person.toLowerCase();
    return tasks.filter((t) => (t.assignee || '').toLowerCase().includes(low));
  };

  if (kindOrRole === 'damas') {
    const imgGroup = './assets/ref_vestimenta_damas_caballeros.jpg';
    const imgGroom = './assets/ref_traje_novio.jpg';
    return openInAppPdfViewer({
      kicker: '🌿 Guía de Organización · Damas y Caballeros',
      title: 'GUÍA PARA CABALLEROS Y DAMAS',
      subtitle: `${wedding.couple_names || 'Freddy & Priscila'} · ${dateTxt}`,
      verse: '“Que se adornen con ropa apropiada, con modestia y buen juicio” — 1 Timoteo 2:9',
      fileBase: 'Guia_Caballeros_y_Damas_Freddy_Priscila',
      bodyHtml: `
        <div class="pdf-grid-2">
          <div class="pdf-box">
            <h3>1. Principios Bíblicos que Nos Guían</h3>
            <ul class="pdf-check-list">
              <li><span class="pdf-chk">☐</span><div><strong>Honrar a Jehová:</strong> Que cada detalle refleje gratitud a Jehová, el Creador del matrimonio. <span class="pdf-tag pdf-tag-verse">Sal. 116:12</span></div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Espíritu alegre y edificante:</strong> Su cariño, apacibilidad y gozo contribuyen a un ambiente feliz. <span class="pdf-tag pdf-tag-verse">Gál. 5:22, 23</span></div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Modestia sin ostentar:</strong> Arreglo decente y apropiado, sin atraer atención indebida. <span class="pdf-tag pdf-tag-verse">1 Tim. 2:9</span></div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Evitar costumbres supersticiosas:</strong> No se arroja arroz, confeti ni pétalos, ni se lanza ramo o liga. <span class="pdf-tag pdf-tag-verse">2 Cor. 6:14-17</span></div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Reverencia en el Salón del Reino:</strong> Postura digna durante el discurso bíblico y oraciones. <span class="pdf-tag pdf-tag-verse">Ecl. 5:1</span></div></li>
            </ul>
          </div>
          <div class="pdf-box">
            <h3>2. Compromisos y Parejas (${couples.length})</h3>
            <ul class="pdf-check-list">
              <li><span class="pdf-chk">☐</span><div><strong>Ensayos en casa de Prisci:</strong> Viernes o sábado según convenga a todos. <span class="pdf-tag pdf-tag-verse">1 Cor. 14:40</span></div></li>
              <li><span class="pdf-chk">☐</span><div><strong>${esc(dateTxt)}:</strong> Llegar al Salón del Reino <strong>1 hora antes</strong> ya cambiados y listos.</div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Apoyo en fotos y recepción:</strong> Seguir las indicaciones del Director del Banquete (${esc(wedding.banquet_director || findRole(/director/i)?.person || 'por confirmar')}). <span class="pdf-tag pdf-tag-verse">Juan 2:8</span></div></li>
            </ul>
            <table style="margin-top:6px;">
              <thead><tr><th>#</th><th>Dama</th><th>Caballero</th></tr></thead>
              <tbody>
                ${couples.map((c, i) => `<tr><td>${i + 1}</td><td><strong>${esc(c.partner || '—')}</strong></td><td><strong>${esc(c.person || '—')}</strong></td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="pdf-box" style="margin-bottom:10px;">
          <h3>3. Código de Vestimenta (Verde Salvia &amp; Beige) · 1 Ped. 3:3, 4</h3>
          <ul class="pdf-check-list">
            <li><span class="pdf-chk">☐</span><div><strong>Damas:</strong> Vestido largo en tono <strong>verde salvia satinado</strong>, con mangas y corte recatado (sin escotes pronunciados, espaldas descubiertas ni aberturas altas).</div></li>
            <li><span class="pdf-chk">☐</span><div><strong>Caballeros:</strong> Camisa blanca manga larga, <strong>corbatín (moño) y fajín verde salvia</strong>, prendedor floral, <strong>pantalón beige claro</strong> y <strong>zapatos cafés</strong>. (Novio: traje de 3 piezas verde salvia).</div></li>
          </ul>
          <div class="pdf-swatches">
            <span class="pdf-sw"><i style="background:#688B70"></i>Verde Salvia</span>
            <span class="pdf-sw"><i style="background:#E3D6C1"></i>Beige Claro</span>
            <span class="pdf-sw"><i style="background:#FFFFFF"></i>Blanco</span>
            <span class="pdf-sw"><i style="background:#8B5226"></i>Café Miel</span>
          </div>
          <div class="pdf-photos">
            <div class="pdf-photo"><img src="${imgGroup}" alt="Damas y Caballeros"><small>Guía Damas y Caballeros</small></div>
            <div class="pdf-photo"><img src="${imgGroom}" alt="Traje del Novio"><small>Traje del Novio</small></div>
          </div>
        </div>

        <div class="pdf-box">
          <h3>4. Mix de Baile de las Parejas (~8 Minutos · Filip. 4:8)</h3>
          <table>
            <thead><tr><th>#</th><th>Canción</th><th>Artista</th><th>Enlace YouTube</th></tr></thead>
            <tbody>
              ${songs.map((s, i) => `<tr><td>${i + 1}</td><td><strong>${esc(s.title)}</strong></td><td>${esc(s.artist || '—')}</td><td>${esc(s.url || '—')}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="pdf-callout">
          <strong>💐 ¡Muchas gracias por acompañarnos!</strong> Valoramos de corazón su tiempo en los ensayos en casa de Prisci, su puntualidad (1 hora antes) y su hermoso ejemplo para que nuestra boda honre a Jehová.
        </div>`,
    });
  }

  if (kindOrRole === 'director') {
    const dirRole = findRole(/director/i);
    const dirName = dirRole?.person || wedding.banquet_director || 'Por confirmar';
    const assigned = tasksFor(dirName);
    return openInAppPdfViewer({
      kicker: '🛡️ Guía Oficial · Supervisión de la Recepción',
      title: 'ROL DEL DIRECTOR DEL BANQUETE',
      subtitle: `Encargado: ${dirName}${dirRole?.phone ? ` (${dirRole.phone})` : ''} · ${wedding.couple_names || 'Freddy & Priscila'} · ${dateTxt}`,
      verse: '“Sírvanle un poco al director del banquete” — Juan 2:8 · “Háganlo todo de forma digna y ordenada” — 1 Cor. 14:40',
      fileBase: `Guia_Director_del_Banquete_${dirName}`,
      bodyHtml: `
        <div class="pdf-grid-2">
          <div class="pdf-box">
            <h3>1. Misión Espiritual y Tranquilidad</h3>
            <ul class="pdf-check-list">
              <li><span class="pdf-chk">☐</span><div><strong>Supervisión de confianza:</strong> Velar con calma y buen juicio para que todo en la recepción marche según lo planeado por Freddy y Priscila. <span class="pdf-tag pdf-tag-verse">Juan 2:8</span></div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Resolver imprevistos con tacto:</strong> Atender discretamente cualquier detalle logístico para que los novios disfruten en paz. <span class="pdf-tag pdf-tag-verse">Col. 4:6</span></div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Aforo y orden:</strong> Coordinar con acomodadores el ingreso ordenado de los <strong>${wedding.guest_target || 150} invitados</strong> a sus ${tables.length} mesas. <span class="pdf-tag pdf-tag-verse">Prov. 22:3</span></div></li>
            </ul>
          </div>
          <div class="pdf-box">
            <h3>2. Principios Clave en la Celebración</h3>
            <ul class="pdf-check-list">
              <li><span class="pdf-chk">☐</span><div><strong>Moderación con bebidas alcohólicas:</strong> Supervisar las medidas acordadas para que nadie beba de más ni haya descontrol. <span class="pdf-tag pdf-tag-verse">Rom. 13:13</span></div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Música sana y volumen moderado:</strong> Confirmar con Audio (${esc(findRole(/audio|música/i)?.person || 'por confirmar')}) que la lista sea aprobada y permita conversar. <span class="pdf-tag pdf-tag-verse">Filip. 4:8</span></div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Palabras y videos edificantes:</strong> Asegurar que toda intervención o video sea limpio, sin bromas inapropiadas. <span class="pdf-tag pdf-tag-verse">Efes. 5:3</span></div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Cierre puntual:</strong> Cumplir el horario acordado y cerrar con agradecimiento sin extenderse hasta altas horas.</div></li>
            </ul>
          </div>
        </div>
        <div class="pdf-box">
          <h3>3. Equipo que Coordina Contigo</h3>
          <table>
            <thead><tr><th>Rol</th><th>Encargado</th><th>Teléfono / Notas</th></tr></thead>
            <tbody>
              ${staff.map((r) => `<tr><td><strong>${esc(r.role)}</strong></td><td>${esc(r.person || 'Por definir')}</td><td>${esc([r.phone, r.notes].filter(Boolean).join(' · ') || '—')}</td></tr>`).join('')}
            </tbody>
          </table>
          ${assigned.length ? `<h3 style="margin-top:8px;">Tareas Delegadas a ${esc(dirName)}</h3><ul class="pdf-check-list">${assigned.map((t) => `<li><span class="pdf-chk">${t.status === 'hecho' ? '☑' : '☐'}</span><div>${esc(t.title)}</div></li>`).join('')}</ul>` : ''}
        </div>
        <div class="pdf-callout">
          <strong>💡 Regla de Oro (Filip. 4:8):</strong> Ante cualquier decisión o imprevisto durante la recepción: “¿Es digno? ¿Edifica? ¿Honra a Jehová ante los invitados?” ¡Gracias de corazón, ${esc(dirName)}!
        </div>`,
    });
  }

  if (kindOrRole === 'audio') {
    const audioRole = findRole(/audio|música/i);
    const photoRole = findRole(/foto|video/i);
    return openInAppPdfViewer({
      kicker: '🎶 Guía Oficial · Equipo Audiovisual',
      title: 'ROL DE AUDIO, MÚSICA, FOTOGRAFÍA Y VIDEO',
      subtitle: `Audio: ${audioRole?.person || 'Por confirmar'} · Foto/Video: ${photoRole?.person || 'Por confirmar'} · ${dateTxt}`,
      verse: '“Todo lo que sea digno, puro y amable… sigan considerando estas cosas” — Filipenses 4:8',
      fileBase: 'Guia_Audio_Musica_y_Fotografia',
      bodyHtml: `
        <div class="pdf-grid-2">
          <div class="pdf-box">
            <h3>1. Reverencia en el Salón del Reino</h3>
            <ul class="pdf-check-list">
              <li><span class="pdf-chk">☐</span><div><strong>Respeto durante el discurso y oraciones:</strong> No caminar por los pasillos, no distraer con flashes ni subir a la plataforma. <span class="pdf-tag pdf-tag-verse">Ecl. 5:1</span></div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Fotos oficiales al terminar:</strong> Organizar las fotos grupales ágilmente tras la oración final para no retrasar a los invitados. <span class="pdf-tag pdf-tag-verse">1 Cor. 14:40</span></div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Cánticos del Reino:</strong> Probar sonido y pistas antes de la llegada de los invitados.</div></li>
            </ul>
          </div>
          <div class="pdf-box">
            <h3>2. Sonido y Música en la Recepción</h3>
            <ul class="pdf-check-list">
              <li><span class="pdf-chk">☐</span><div><strong>Lista revisada y sin internet:</strong> Tener todas las canciones aprobadas descargadas offline en respaldo doble. <span class="pdf-tag pdf-tag-verse">Filip. 4:8</span></div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Volumen equilibrado:</strong> Mantener un volumen agradable que permita conversar cómodamente durante la cena.</div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Coordinación con el Director del Banquete:</strong> Seguir las señales de ${esc(findRole(/director/i)?.person || 'el Director')} para entrada, micrófonos y mix de baile. <span class="pdf-tag pdf-tag-verse">Juan 2:8</span></div></li>
            </ul>
          </div>
        </div>
        <div class="pdf-box">
          <h3>3. Lista Musical Aprobada / Mix de Baile (${songs.length} canciones)</h3>
          <table>
            <thead><tr><th>#</th><th>Título</th><th>Artista</th><th>Momento</th><th>Enlace</th></tr></thead>
            <tbody>
              ${songs.map((s, i) => `<tr><td>${i + 1}</td><td><strong>${esc(s.title)}</strong></td><td>${esc(s.artist || '—')}</td><td>${esc(s.purpose || 'Mix')}</td><td>${esc(s.url || '—')}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>`,
    });
  }

  if (kindOrRole === 'acomodadores') {
    const acomRole = findRole(/acomodador/i);
    return openInAppPdfViewer({
      kicker: '🪑 Guía Oficial · Hospitalidad y Logística',
      title: 'ROL DE ACOMODADORES Y RECEPCIÓN',
      subtitle: `Encargados: ${acomRole?.person || 'Por confirmar'} · Aforo: ${wedding.guest_target || 150} invitados · ${tables.length} mesas`,
      verse: '“Sigan la senda de la hospitalidad” — Romanos 12:13 · “Recíbanse unos a otros con gusto” — Romanos 15:7',
      fileBase: 'Guia_Acomodadores_y_Logistica',
      bodyHtml: `
        <div class="pdf-grid-2">
          <div class="pdf-box">
            <h3>1. En el Salón del Reino</h3>
            <ul class="pdf-check-list">
              <li><span class="pdf-chk">☐</span><div><strong>Bienvenida cálida:</strong> Recibir a cada asistente con una sonrisa y ubicar a las familias con orden. <span class="pdf-tag pdf-tag-verse">Rom. 15:7</span></div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Asientos reservados:</strong> Cuidar las primeras filas para los padres, testigos y las ${couples.length} parejas de damas y caballeros.</div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Atención especial:</strong> Ayudar con cariño a personas mayores y a familiares no Testigos para que se sientan muy bienvenidos. <span class="pdf-tag pdf-tag-verse">Col. 4:6</span></div></li>
            </ul>
          </div>
          <div class="pdf-box">
            <h3>2. En el Local de Recepción (${wedding.guest_target || 150} Invitados)</h3>
            <ul class="pdf-check-list">
              <li><span class="pdf-chk">☐</span><div><strong>Control de entrada prudente:</strong> Usar la lista alfabética y el plano de las ${tables.length} mesas para evitar aglomeraciones o personas no invitadas. <span class="pdf-tag pdf-tag-verse">Prov. 22:3</span></div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Pasillos y fluidez:</strong> Verificar pasillos despejados para los meseros y las fotos mesa por mesa.</div></li>
              <li><span class="pdf-chk">☐</span><div><strong>Coordinación general:</strong> Trabajar en equipo con el Director del Banquete (${esc(findRole(/director/i)?.person || 'por confirmar')}). <span class="pdf-tag pdf-tag-verse">1 Cor. 14:40</span></div></li>
            </ul>
          </div>
        </div>
        <div class="pdf-callout">
          <strong>📊 Resumen en vivo:</strong> Actualmente hay <strong>${guests.length} invitaciones</strong> registradas en el sistema y <strong>${tables.length} mesas</strong> configuradas. Puedes descargar también el PDF detallado del plano en el módulo <strong>Mesas → Lista para acomodadores</strong>.
        </div>`,
    });
  }

  // Guía PDF personalizada para CUALQUIER rol / persona individual (ej. Orador del discurso: Luis Carangui, Fotografía: Jose Lucero, etc.)
  const roleObj = typeof kindOrRole === 'object' ? kindOrRole : { role: String(kindOrRole), person: '' };
  const personName = roleObj.person || 'Por confirmar';
  const assigned = tasksFor(personName);
  const isSpeaker = /orador|discurs/i.test(roleObj.role);

  return openInAppPdfViewer({
    kicker: `🤝 Guía Personalizada · ${roleObj.role}`,
    title: `${roleObj.role.toUpperCase()} — ${personName}`,
    subtitle: `${wedding.couple_names || 'Freddy & Priscila'} · ${dateTxt}`,
    verse: isSpeaker
      ? '“Lo que Dios ha unido bajo un mismo yugo, que no lo separe ningún hombre” — Mateo 19:6'
      : '“Ya sea que coman o beban o hagan cualquier otra cosa, háganlo todo para la gloria de Dios” — 1 Corintios 10:31',
    fileBase: `Guia_${roleObj.role}_${personName}`,
    bodyHtml: `
      <div class="pdf-grid-2">
        <div class="pdf-box">
          <h3>Datos de tu Asignación</h3>
          <ul>
            <li><strong>Rol:</strong> ${esc(roleObj.role)}</li>
            <li><strong>Encargado/a:</strong> ${esc(personName)}</li>
            ${roleObj.phone ? `<li><strong>Teléfono:</strong> ${esc(roleObj.phone)}</li>` : ''}
            ${roleObj.notes ? `<li><strong>Indicaciones:</strong> ${esc(roleObj.notes)}</li>` : ''}
            <li><strong>Fecha de la boda:</strong> ${esc(dateTxt)}</li>
            <li><strong>Salón del Reino:</strong> ${esc(wedding.kingdom_hall || 'Por confirmar')}</li>
            <li><strong>Local de recepción:</strong> ${esc(wedding.reception_venue || 'Por confirmar')}</li>
          </ul>
        </div>
        <div class="pdf-box">
          <h3>Principios Bíblicos Base (La Atalaya 12/2025)</h3>
          <ul class="pdf-check-list">
            <li><span class="pdf-chk">☐</span><div><strong>Honrar a Jehová en todo:</strong> Nuestro objetivo principal es dar gloria a nuestro Padre celestial. <span class="pdf-tag pdf-tag-verse">Sal. 116:12</span></div></li>
            <li><span class="pdf-chk">☐</span><div><strong>Dignidad y orden:</strong> Puntualidad y buena coordinación con los novios y el Director del Banquete (${esc(findRole(/director/i)?.person || 'por confirmar')}). <span class="pdf-tag pdf-tag-verse">1 Cor. 14:40</span></div></li>
            <li><span class="pdf-chk">☐</span><div><strong>Espíritu bondadoso y apacible:</strong> Tratar con cariño a los ${wedding.guest_target || 150} invitados, incluyendo familiares no Testigos. <span class="pdf-tag pdf-tag-verse">Col. 4:6</span></div></li>
          </ul>
        </div>
      </div>
      ${assigned.length ? `<div class="pdf-box">
        <h3>Tareas Específicas Delegadas a ${esc(personName)} (${assigned.length})</h3>
        <ul class="pdf-check-list">
          ${assigned.map((t) => `<li><span class="pdf-chk">${t.status === 'hecho' ? '☑' : '☐'}</span><div><strong>${esc(t.title)}</strong>${t.description ? ` — ${esc(t.description)}` : ''}</div></li>`).join('')}
        </ul>
      </div>` : ''}
      <div class="pdf-callout">
        <strong>💐 ¡Muchas gracias, ${esc(personName)}!</strong> Apreciamos muchísimo tu valioso apoyo y cariño para que nuestra boda honre a Jehová. — <em>Freddy &amp; Priscila</em>
      </div>`,
  });
}
