// Módulo "Equipo": roles de colaboradores, mix de baile, guías PDF imprimibles y accesos de ayudantes.
import * as db from '../db.js';
import { esc, toast, openModal, fmtDate } from '../ui.js';
import { icon } from '../icons.js';

const ROLE_PRESETS = [
  'Damas y caballeros', 'Director del Banquete', 'Orador del discurso',
  'Audio y música', 'Fotografía y video', 'Acomodadores',
  'Coordinador de catering', 'Mesa de regalos y torta', 'Otro rol',
];

export async function renderEquipo(el, ctx) {
  const [wedding, roles, songs, guests, tables, allowed] = await Promise.all([
    db.getWedding(),
    db.list('team_roles', { order: 'sort' }),
    db.list('songs', { order: 'sort' }),
    db.list('guests'),
    db.list('seating_tables', { order: 'sort' }),
    ctx.isAdmin ? db.list('allowed_phones', { order: 'display_name' }).catch(() => []) : Promise.resolve([]),
  ]);

  const couples = roles.filter((r) => /damas/i.test(r.role));
  const staff = roles.filter((r) => !/damas/i.test(r.role));
  const pendingReqs = allowed.filter(db.isPendingAccess);
  const approvedPhones = allowed.filter((x) => !db.isPendingAccess(x));
  const online = db.presence.getOnline();
  const onlineSet = new Set(online.map((o) => o.phone));

  el.innerHTML = `
  <header class="page-head">
    <div>
      <span class="eyebrow">${icon('star', 14)} Colaboradores y orden · Juan 2:8</span>
      <h1>Equipo, Roles y Guías PDF</h1>
      <p>Organiza a quienes les ayudarán en la boda, genera las guías imprimibles en PDF con sus datos reales y gestiona los accesos de ayudantes.</p>
    </div>
    ${ctx.isAdmin ? `<button class="btn btn-primary" id="btn-new-role">${icon('plus', 16)} Agregar rol / pareja</button>` : ''}
  </header>

  <section class="card">
    <header class="card-head">
      <h2>${icon('printer', 18)} Generar Guías PDF por Rol (con tus datos actuales)</h2>
      <span class="pill pill-stage">Verde Salvia &amp; Beige</span>
    </header>
    <p class="muted" style="margin-bottom:14px;">Cada botón abre una hoja limpia de 1 página lista para guardar como PDF (<em>Imprimir → Guardar como PDF</em>) y compartir por WhatsApp.</p>
    <div class="pdf-grid">
      <button class="pdf-card" data-pdf="damas">
        <strong>1. Caballeros y Damas</strong>
        <small>${couples.length} parejas · Código verde salvia y beige · Mix de ${songs.length} canciones</small>
        <span class="link">${icon('printer', 14)} Abrir / Guardar PDF</span>
      </button>
      <button class="pdf-card" data-pdf="director">
        <strong>2. Director del Banquete</strong>
        <small>Supervisión, moderación, horario y tranquilidad de los novios (Juan 2:8)</small>
        <span class="link">${icon('printer', 14)} Abrir / Guardar PDF</span>
      </button>
      <button class="pdf-card" data-pdf="audio">
        <strong>3. Audio, Música y Fotografía</strong>
        <small>Reverencia en el Salón del Reino, volumen y lista musical (Filip. 4:8)</small>
        <span class="link">${icon('printer', 14)} Abrir / Guardar PDF</span>
      </button>
      <button class="pdf-card" data-pdf="acomodadores">
        <strong>4. Acomodadores y Logística</strong>
        <small>${wedding.guest_target || 100} invitados · ${tables.length} mesas · Hospitalidad (Rom. 12:13)</small>
        <span class="link">${icon('printer', 14)} Abrir / Guardar PDF</span>
      </button>
    </div>
  </section>

  <div class="grid-2">
    <div class="col">
      <section class="card">
        <header class="card-head">
          <h2>${icon('users', 18)} Damas y Caballeros (${couples.length})</h2>
        </header>
        <ul class="team-list">
          ${couples.map((r, i) => `<li class="team-row">
            <span class="couple-n">${i + 1}</span>
            <div class="team-info">
              <strong>${esc(r.partner || 'Dama por definir')} &amp; ${esc(r.person || 'Caballero por definir')}</strong>
              <small class="muted">${esc([r.notes, r.phone].filter(Boolean).join(' · ') || 'Pareja asignada')}</small>
            </div>
            ${ctx.isAdmin ? `<div class="btn-row">
              <button class="icon-btn" data-edit-role="${esc(r.id)}" title="Editar">${icon('edit', 14)}</button>
              <button class="icon-btn icon-danger" data-del-role="${esc(r.id)}" title="Eliminar">${icon('trash', 14)}</button>
            </div>` : ''}
          </li>`).join('')}
        </ul>
      </section>

      <section class="card">
        <header class="card-head">
          <h2>${icon('star', 18)} Otros Roles Clave</h2>
        </header>
        <ul class="team-list">
          ${staff.map((r) => `<li class="team-row">
            <div class="team-info">
              <strong>${esc(r.role)}</strong>
              <span>${r.person ? esc(r.person) : '<span class="tbd-pill">Por definir</span>'}${r.partner ? ` y ${esc(r.partner)}` : ''}</span>
              ${r.notes || r.phone ? `<small class="muted">${esc([r.notes, r.phone].filter(Boolean).join(' · '))}</small>` : ''}
            </div>
            ${ctx.isAdmin ? `<div class="btn-row">
              <button class="icon-btn" data-edit-role="${esc(r.id)}" title="Editar">${icon('edit', 14)}</button>
              <button class="icon-btn icon-danger" data-del-role="${esc(r.id)}" title="Eliminar">${icon('trash', 14)}</button>
            </div>` : ''}
          </li>`).join('')}
        </ul>
      </section>
    </div>

    <div class="col">
      <section class="card">
        <header class="card-head">
          <h2>${icon('music', 18)} Música y Mix de Baile</h2>
          ${ctx.isAdmin ? `<button class="chip-btn" id="btn-new-song">${icon('plus', 13)} Canción</button>` : ''}
        </header>
        <ul class="team-list">
          ${songs.map((s, i) => `<li class="team-row">
            <span class="couple-n">${i + 1}</span>
            <div class="team-info">
              <strong>${esc(s.title)}</strong>
              <small class="muted">${esc([s.artist, s.purpose].filter(Boolean).join(' · '))}</small>
              ${s.url ? `<a class="link" style="font-size:0.78rem;" href="${esc(s.url)}" target="_blank" rel="noopener">Escuchar en YouTube ${icon('external', 11)}</a>` : ''}
            </div>
            ${ctx.isAdmin ? `<div class="btn-row">
              <button class="icon-btn" data-edit-song="${esc(s.id)}" title="Editar">${icon('edit', 14)}</button>
              <button class="icon-btn icon-danger" data-del-song="${esc(s.id)}" title="Eliminar">${icon('trash', 14)}</button>
            </div>` : ''}
          </li>`).join('')}
        </ul>
      </section>

      ${ctx.isAdmin ? `<section class="card">
        <header class="card-head">
          <h2>${icon('shield', 18)} Accesos, Solicitudes y Conectados</h2>
          <button class="chip-btn" id="btn-new-access">${icon('userPlus', 13)} Autorizar teléfono</button>
        </header>

        ${pendingReqs.length ? `
        <div class="sub" style="color:var(--warn);">${icon('bell', 14)} Solicitudes esperando aprobación (${pendingReqs.length})</div>
        <ul class="team-list" style="margin-bottom:14px;">
          ${pendingReqs.map((p) => `<li class="team-row req-row">
            <div class="team-info">
              <strong>${esc(p.display_name)}</strong>
              <small class="muted">${esc(db.formatPhone(p.phone))} · Quiere ingresar ahora</small>
            </div>
            <div class="btn-row">
              <button class="btn btn-primary btn-xs" data-app-phone="${esc(p.phone)}" data-name="${esc(p.display_name)}" data-role="admin">✔ Admin</button>
              <button class="btn btn-outline btn-xs" data-app-phone="${esc(p.phone)}" data-name="${esc(p.display_name)}" data-role="helper">✔ Ayudante</button>
              <button class="icon-btn icon-danger" data-del-access="${esc(p.phone)}" title="Rechazar">${icon('trash', 14)}</button>
            </div>
          </li>`).join('')}
        </ul>` : ''}

        <div class="sub"><span class="live-dot"></span> Conectados en vivo (${online.length})</div>
        <ul class="team-list" style="margin-bottom:14px;">
          ${online.map((o) => `<li class="team-row">
            <span class="avatar sm">${esc(o.name.charAt(0).toUpperCase())}</span>
            <div class="team-info">
              <strong>${esc(o.name)} ${o.phone === ctx.member?.phone ? '<small class="muted">(Tú)</small>' : ''}</strong>
              <small class="muted">${o.device === 'Celular' ? '📱 Celular' : '💻 PC'} · Viendo: ${esc(o.route || 'Mi boda')}</small>
            </div>
            <span class="pill ${o.role === 'admin' ? 'pill-stage' : 'pill-verse'}">${o.role === 'admin' ? 'Admin' : 'Ayudante'}</span>
          </li>`).join('')}
        </ul>

        <div class="sub">${icon('users', 14)} Personas autorizadas (${approvedPhones.length})</div>
        <ul class="team-list">
          ${approvedPhones.map((a) => `<li class="team-row">
            <span class="status-dot ${onlineSet.has(a.phone) ? 'is-on' : ''}" title="${onlineSet.has(a.phone) ? 'Conectado ahora' : 'Desconectado'}"></span>
            <div class="team-info">
              <strong>${esc(a.display_name || db.formatPhone(a.phone))}</strong>
              <small class="muted">${esc(db.formatPhone(a.phone))}${a.area ? ` · ${esc(a.area)}` : ''}</small>
            </div>
            <div class="btn-row">
              ${a.phone !== (ctx.member?.phone || '')
                ? `<select class="mini-select" data-ch-role="${esc(a.phone)}" data-name="${esc(a.display_name)}">
                    <option value="admin" ${a.role === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="helper" ${a.role === 'helper' ? 'selected' : ''}>Ayudante</option>
                  </select>
                  <button class="icon-btn icon-danger" data-del-access="${esc(a.phone)}" title="Quitar acceso">${icon('trash', 14)}</button>`
                : `<span class="pill pill-stage">Admin (Tú)</span>`}
            </div>
          </li>`).join('')}
        </ul>
      </section>` : ''}
    </div>
  </div>`;

  // Eventos Roles
  el.querySelector('#btn-new-role')?.addEventListener('click', () => openRoleModal(null, roles.length));
  el.querySelectorAll('[data-edit-role]').forEach((b) => b.addEventListener('click', () => {
    const r = roles.find((x) => String(x.id) === String(b.dataset.editRole));
    if (r) openRoleModal(r, roles.length);
  }));
  el.querySelectorAll('[data-del-role]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Eliminar este rol?')) return;
    try { await db.remove('team_roles', b.dataset.delRole); toast('Rol eliminado'); }
    catch (e) { toast(e.message, 'error'); }
  }));

  // Eventos Canciones
  el.querySelector('#btn-new-song')?.addEventListener('click', () => openSongModal(null, songs.length));
  el.querySelectorAll('[data-edit-song]').forEach((b) => b.addEventListener('click', () => {
    const s = songs.find((x) => String(x.id) === String(b.dataset.editSong));
    if (s) openSongModal(s, songs.length);
  }));
  el.querySelectorAll('[data-del-song]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Eliminar esta canción?')) return;
    try { await db.remove('songs', b.dataset.delSong); toast('Canción eliminada'); }
    catch (e) { toast(e.message, 'error'); }
  }));

  // Eventos Accesos y Aprobación 1-clic
  el.querySelector('#btn-new-access')?.addEventListener('click', openAccessModal);
  el.querySelectorAll('[data-app-phone]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await db.approvePendingPhone(b.dataset.appPhone, b.dataset.name, b.dataset.role);
      toast(`¡${b.dataset.name} aprobada como ${b.dataset.role === 'admin' ? 'Admin' : 'Ayudante'}! 🎉`);
    } catch (e) { toast(e.message, 'error'); }
  }));
  el.querySelectorAll('[data-ch-role]').forEach((sel) => sel.addEventListener('change', async () => {
    try {
      await db.approvePendingPhone(sel.dataset.chRole, sel.dataset.name, sel.value);
      toast(`Rol de ${sel.dataset.name} actualizado ✔`);
    } catch (e) { toast(e.message, 'error'); }
  }));
  el.querySelectorAll('[data-del-access]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(`¿Revocar el acceso de ${db.formatPhone(b.dataset.delAccess)}?`)) return;
    try { await db.removeAllowedPhone(b.dataset.delAccess); toast('Acceso eliminado'); }
    catch (e) { toast(e.message, 'error'); }
  }));

  // Generadores de PDF
  el.querySelectorAll('[data-pdf]').forEach((b) => b.addEventListener('click', () => {
    openRoleGuidePdf(b.dataset.pdf, { wedding, couples, staff, songs, guests, tables });
  }));
}

function openRoleModal(r, count) {
  const isEdit = Boolean(r);
  openModal({
    title: isEdit ? 'Editar rol' : 'Agregar rol / pareja',
    submitLabel: isEdit ? 'Guardar' : 'Agregar',
    body: `
      <label class="field"><span>Rol *</span>
        <input name="role" list="role-presets" required value="${esc(r?.role || '')}" placeholder="Ej. Director del Banquete">
        <datalist id="role-presets">${ROLE_PRESETS.map((p) => `<option value="${p}">`).join('')}</datalist>
      </label>
      <div class="form-grid">
        <label class="field"><span>Persona / Caballero</span>
          <input name="person" value="${esc(r?.person || '')}" placeholder="Ej. Manuel">
        </label>
        <label class="field"><span>Pareja / Dama (opcional)</span>
          <input name="partner" value="${esc(r?.partner || '')}" placeholder="Ej. Nancy">
        </label>
      </div>
      <div class="form-grid">
        <label class="field"><span>Teléfono</span>
          <input name="phone" value="${esc(r?.phone || '')}" placeholder="0991234567">
        </label>
        <label class="field"><span>Orden</span>
          <input name="sort" type="number" value="${esc(r?.sort ?? count + 1)}">
        </label>
      </div>
      <label class="field"><span>Notas</span>
        <input name="notes" value="${esc(r?.notes || '')}" placeholder="Ej. Pareja 1 · Ensayos en casa de Prisci">
      </label>`,
    onSubmit: async (fd) => {
      const s = (k) => String(fd.get(k) || '').trim() || null;
      const role = s('role');
      if (!role) throw new Error('Escribe el nombre del rol.');
      const payload = { role, person: s('person'), partner: s('partner'), phone: s('phone'), notes: s('notes'), sort: Number(fd.get('sort')) || count + 1 };
      if (isEdit) { await db.update('team_roles', r.id, payload); toast('Rol actualizado ✔'); }
      else { await db.insert('team_roles', payload); toast('Rol agregado ✔'); }
    },
  });
}

function openSongModal(song, count) {
  const isEdit = Boolean(song);
  openModal({
    title: isEdit ? 'Editar canción' : 'Nueva canción',
    submitLabel: isEdit ? 'Guardar' : 'Agregar',
    body: `
      <label class="field"><span>Título *</span><input name="title" required value="${esc(song?.title || '')}" placeholder="Ej. Bailando Bachata"></label>
      <div class="form-grid">
        <label class="field"><span>Artista</span><input name="artist" value="${esc(song?.artist || '')}" placeholder="Ej. Chayanne"></label>
        <label class="field"><span>Momento / uso</span><input name="purpose" value="${esc(song?.purpose || 'Mix de baile')}" placeholder="Mix de baile, Cántico, Cena…"></label>
      </div>
      <label class="field"><span>Enlace (YouTube / jw.org)</span><input name="url" type="url" value="${esc(song?.url || '')}" placeholder="https://youtu.be/..."></label>`,
    onSubmit: async (fd) => {
      const s = (k) => String(fd.get(k) || '').trim() || null;
      const title = s('title');
      if (!title) throw new Error('Escribe el título de la canción.');
      const payload = { title, artist: s('artist'), purpose: s('purpose'), url: s('url'), sort: song?.sort ?? count + 1 };
      if (isEdit) { await db.update('songs', song.id, payload); toast('Canción actualizada ✔'); }
      else { await db.insert('songs', payload); toast('Canción agregada ✔'); }
    },
  });
}

function openAccessModal() {
  openModal({
    title: 'Autorizar nuevo acceso (por teléfono)',
    submitLabel: 'Autorizar número',
    body: `
      <div class="form-grid">
        <label class="field"><span>Nombre *</span>
          <input name="display_name" required placeholder="Ej. Priscila o Katy">
        </label>
        <label class="field"><span>Teléfono *</span>
          <input name="phone" type="tel" required placeholder="Ej. 0991234567">
        </label>
      </div>
      <div class="form-grid">
        <label class="field"><span>Rol</span>
          <select name="role">
            <option value="helper">Ayudante (ve todo, marca tareas)</option>
            <option value="admin">Administrador (control total)</option>
          </select>
        </label>
        <label class="field"><span>Área asignada</span>
          <input name="area" placeholder="Ej. Novios, Director, Decoración…">
        </label>
      </div>`,
    onSubmit: async (fd) => {
      const s = (k) => String(fd.get(k) || '').trim() || null;
      const phone = s('phone');
      const display_name = s('display_name');
      if (!display_name) throw new Error('Escribe el nombre de la persona.');
      if (!phone || db.normalizePhone(phone).length < 7) throw new Error('Ingresa un número de teléfono válido.');
      await db.upsertAllowedPhone({
        phone,
        display_name,
        role: s('role') || 'helper',
        area: s('area'),
      });
      toast(`Acceso autorizado para ${display_name} (${db.formatPhone(phone)}) ✔`);
    },
  });
}

function openRoleGuidePdf(kind, { wedding, couples, staff, songs, guests, tables }) {
  const w = window.open('', '_blank');
  if (!w) return toast('Permite ventanas emergentes para abrir la guía PDF.', 'error');
  const dateTxt = wedding.wedding_date ? fmtDate(wedding.wedding_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Viernes 26 de febrero de 2027';

  const guides = {
    damas: {
      title: 'GUÍA PARA CABALLEROS Y DAMAS',
      verse: '“Que se adornen con ropa apropiada, con modestia y buen juicio” — 1 Timoteo 2:9',
      blocks: [
        ['1. Principios Bíblicos', [
          'Honrar a Jehová con alegría, modestia y buen ejemplo (Gál. 5:22, 23; 1 Cor. 10:31).',
          'Evitar costumbres supersticiosas: no arrojar arroz, confeti ni pétalos, ni lanzar ramo o liga (2 Cor. 6:14-17).',
          'Mantener reverencia durante el discurso bíblico y las oraciones en el Salón del Reino (Ecl. 5:1).',
        ]],
        ['2. Compromisos y Parejas', [
          `Fecha de la boda: ${dateTxt}. Llegar al Salón del Reino 1 hora antes ya cambiados y listos.`,
          'Ensayos en casa de Prisci el día que sea más cómodo para todos (viernes o sábado).',
          ...couples.map((c, i) => `Pareja ${i + 1}: ${c.partner || ''} y ${c.person || ''}`),
        ]],
        ['3. Código de Vestimenta (Verde Salvia y Beige)', [
          'Damas: vestido largo verde salvia satinado, elegante y modesto (con mangas, sin escotes pronunciados ni aberturas altas).',
          'Caballeros: camisa blanca manga larga, corbatín y fajín verde salvia, prendedor floral, pantalón beige claro y zapatos cafés.',
          'Novio: traje completo de 3 piezas en verde salvia.',
        ]],
        ['4. Mix de Baile (~8 minutos)', songs.map((s, i) => `${i + 1}. ${s.title}${s.artist ? ` — ${s.artist}` : ''}${s.url ? ` (${s.url})` : ''}`)],
      ],
    },
    director: {
      title: 'GUÍA DEL DIRECTOR DEL BANQUETE',
      verse: '“Sírvanle un poco al director del banquete” — Juan 2:8',
      blocks: [
        ['1. Misión Principal', [
          `Hermano asignado: ${wedding.banquet_director || staff.find((r) => /director/i.test(r.role))?.person || 'Por confirmar'}.`,
          'Velar con calma y buen juicio para que todo en la recepción marche de forma digna y ordenada (1 Cor. 14:40).',
          'Resolver cualquier imprevisto con discreción para que Freddy y Priscila disfruten tranquilos.',
        ]],
        ['2. Supervisión de Principios Clave', [
          'Moderación con bebidas alcohólicas: vigilar que nadie beba de más ni haya descontrol (Rom. 13:13).',
          'Música y volumen: confirmar que se use solo la lista aprobada y a un volumen que permita conversar (Filip. 4:8).',
          'Palabras y videos: verificar que todo mensaje o proyección sea limpio y edificante (Efes. 5:3).',
        ]],
        ['3. Coordinación con Otros Equipos', [
          'Coordinar con acomodadores el ingreso ordenado de los invitados a sus mesas.',
          'Avisar a cocina/catering, audio y fotógrafo los tiempos de entrada, comida, torta y cierre puntual.',
        ]],
      ],
    },
    audio: {
      title: 'GUÍA DE AUDIO, MÚSICA Y FOTOGRAFÍA',
      verse: '“Todo lo que sea digno, puro y amable… sigan considerando estas cosas” — Filipenses 4:8',
      blocks: [
        ['1. Reverencia en el Salón del Reino', [
          'No caminar por los pasillos durante el discurso bíblico ni las oraciones, ni subir a la plataforma (Ecl. 5:1).',
          'Evitar flashes molestos o distracciones; tomar las fotos grupales al concluir el discurso.',
        ]],
        ['2. Música y Sonido en la Recepción', [
          'Tener toda la lista musical revisada y descargada sin conexión a internet.',
          'Mantener un volumen agradable que permita a las familias conversar cómodamente.',
          ...songs.map((s, i) => `Mix #${i + 1}: ${s.title}${s.artist ? ` — ${s.artist}` : ''}`),
        ]],
      ],
    },
    acomodadores: {
      title: 'GUÍA DE ACOMODADORES Y LOGÍSTICA',
      verse: '“Sigan la senda de la hospitalidad” — Romanos 12:13',
      blocks: [
        ['1. En el Salón del Reino', [
          'Recibir a los asistentes con una sonrisa cálida y reservar las primeras filas para familiares y acompañantes.',
          'Ayudar con especial cariño a personas mayores y a familiares no Testigos (Col. 4:6).',
        ]],
        ['2. En el Local de Recepción', [
          `Aforo previsto: ${wedding.guest_target || 100} invitados distribuidos en ${tables.length} mesas (${guests.length} invitaciones registradas).`,
          'Recibir en la entrada con la lista alfabética y el plano de mesas para evitar aglomeraciones (Prov. 22:3).',
          'Coordinar el orden en la mesa de regalos y la salida puntual al finalizar.',
        ]],
      ],
    },
  };

  const g = guides[kind] || guides.damas;
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(g.title)} · ${esc(wedding.couple_names || 'Freddy & Priscila')}</title>
  <style>
    @page{size:A4 portrait;margin:12mm;}
    body{font-family:Segoe UI,Arial,sans-serif;color:#1F2D24;max-width:780px;margin:0 auto;padding:18px;}
    header{background:#2F4B38;color:#fff;padding:18px 22px;border-radius:10px;border-bottom:4px solid #B6863A;margin-bottom:16px;}
    header h1{margin:0 0 4px;font-size:20px;letter-spacing:0.6px;}
    header p{margin:0;color:#F5E6C8;font-size:13px;}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    .box{border:1px solid #C3D4C6;border-radius:8px;padding:12px 14px;background:#FCFBF8;}
    .box h2{margin:0 0 8px;font-size:13.5px;color:#2F4B38;border-bottom:1px solid #E2ECE4;padding-bottom:5px;}
    .box ul{margin:0;padding-left:16px;font-size:12.5px;line-height:1.48;}
    .box li{margin-bottom:5px;}
    footer{margin-top:14px;text-align:center;font-size:11.5px;color:#55665B;border-top:1px solid #DFE6DF;padding-top:8px;}
    @media print { .no-print{display:none;} }
  </style></head><body>
  <div class="no-print" style="margin-bottom:12px;text-align:right;">
    <button onclick="window.print()" style="padding:9px 16px;background:#2F4B38;color:#fff;border:none;border-radius:7px;font-weight:700;cursor:pointer;">🖨️ Imprimir / Guardar como PDF</button>
  </div>
  <header>
    <h1>${esc(g.title)}</h1>
    <p>${esc(wedding.couple_names || 'Freddy & Priscila')} · ${esc(dateTxt)} · ${esc(g.verse)}</p>
  </header>
  <div class="grid">
    ${g.blocks.map(([h, items]) => `<div class="box"><h2>${esc(h)}</h2><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}
  </div>
  <footer>Basado en principios bíblicos y La Atalaya (diciembre de 2025) · “Háganlo todo de forma digna y ordenada” (1 Cor. 14:40)</footer>
  </body></html>`);
  w.document.close();
}
