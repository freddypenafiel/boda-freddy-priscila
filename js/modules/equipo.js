// Módulo "Equipo": roles de colaboradores (con lógica dinámica según rol), mix de baile,
// guías PDF descargables/compartibles en tiempo real y accesos con aprobación en 1 clic.
import * as db from '../db.js';
import { esc, toast, openModal, celebrate } from '../ui.js';
import { icon } from '../icons.js';
import { exportRoleGuidePdf } from '../pdf.js';

const ROLE_PRESETS = [
  'Damas y caballeros', 'Director del Banquete', 'Orador del discurso',
  'Audio y música', 'Fotografía y video', 'Acomodadores',
  'Coordinador de catering', 'Mesa de regalos y torta', 'Otro rol',
];

const isCoupleRole = (role) => /damas|caballeros|pareja/i.test(String(role || ''));

export async function renderEquipo(el, ctx) {
  const [wedding, roles, songs, guests, tables, tasks, allowed] = await Promise.all([
    db.getWedding(),
    db.list('team_roles', { order: 'sort' }),
    db.list('songs', { order: 'sort' }),
    db.list('guests'),
    db.list('seating_tables', { order: 'sort' }),
    db.list('tasks', { order: 'sort' }),
    ctx.isAdmin ? db.list('allowed_phones', { order: 'display_name' }).catch(() => []) : Promise.resolve([]),
  ]);

  const couples = roles.filter((r) => isCoupleRole(r.role));
  const staff = roles.filter((r) => !isCoupleRole(r.role));
  const pendingReqs = allowed.filter(db.isPendingAccess);
  const approvedPhones = allowed.filter((x) => !db.isPendingAccess(x));
  const online = db.presence.getOnline();
  const onlineSet = new Set(online.map((o) => o.phone));

  const pdfPayload = { wedding, couples, staff, songs, guests, tables, tasks };
  const dirName = staff.find((r) => /director/i.test(r.role))?.person || wedding.banquet_director || 'Por asignar';
  const audioName = staff.find((r) => /audio|música/i.test(r.role))?.person || 'Por asignar';

  el.innerHTML = `
  <header class="page-head">
    <div>
      <span class="eyebrow">${icon('star', 14)} Colaboradores y orden · Juan 2:8</span>
      <h1>Equipo, Roles y Guías PDF</h1>
      <p>Organiza a quienes les ayudarán en la boda, descarga o comparte sus guías PDF sincronizadas en tiempo real y gestiona los accesos.</p>
    </div>
    ${ctx.isAdmin ? `<button class="btn btn-primary" id="btn-new-role">${icon('plus', 16)} Agregar rol / pareja</button>` : ''}
  </header>

  <section class="card">
    <header class="card-head">
      <h2>${icon('printer', 18)} Guías Oficiales PDF por Rol (en tiempo real)</h2>
      <span class="pill pill-stage">Verde Salvia &amp; Beige</span>
    </header>
    <p class="muted" style="margin-bottom:14px;">Cada guía se genera al instante con los nombres, parejas, canciones y datos actuales de la base de datos. Puedes visualizarla, descargar el archivo <strong>.pdf</strong> o compartirlo directo por WhatsApp.</p>
    <div class="pdf-grid">
      <button class="pdf-card" data-pdf="damas">
        <strong>1. Caballeros y Damas</strong>
        <small>${couples.length} parejas · Fotos de vestimenta verde salvia · Mix de ${songs.length} canciones</small>
        <span class="link">${icon('download', 14)} Ver / Descargar PDF</span>
      </button>
      <button class="pdf-card" data-pdf="director">
        <strong>2. Director del Banquete</strong>
        <small>Encargado: <b>${esc(dirName)}</b> · Supervisión y orden (Juan 2:8)</small>
        <span class="link">${icon('download', 14)} Ver / Descargar PDF</span>
      </button>
      <button class="pdf-card" data-pdf="audio">
        <strong>3. Audio, Música y Foto</strong>
        <small>Audio: <b>${esc(audioName)}</b> · Reverencia en el Salón y lista musical</small>
        <span class="link">${icon('download', 14)} Ver / Descargar PDF</span>
      </button>
      <button class="pdf-card" data-pdf="acomodadores">
        <strong>4. Acomodadores y Logística</strong>
        <small>${wedding.guest_target || 150} invitados · ${tables.length} mesas · Hospitalidad (Rom. 12:13)</small>
        <span class="link">${icon('download', 14)} Ver / Descargar PDF</span>
      </button>
    </div>
  </section>

  <div class="grid-2">
    <div class="col">
      <section class="card">
        <header class="card-head">
          <h2>${icon('users', 18)} Damas y Caballeros (${couples.length})</h2>
          ${ctx.isAdmin ? `<button class="chip-btn" id="btn-add-couple">${icon('plus', 13)} Pareja</button>` : ''}
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
          <h2>${icon('star', 18)} Roles y Colaboradores (${staff.length})</h2>
        </header>
        <ul class="team-list">
          ${staff.map((r) => `<li class="team-row">
            <div class="team-info">
              <strong>${esc(r.role)}</strong>
              <span>${r.person ? esc(r.person) : '<span class="tbd-pill">Por definir</span>'}</span>
              ${r.notes || r.phone ? `<small class="muted">${esc([r.notes, r.phone].filter(Boolean).join(' · '))}</small>` : ''}
            </div>
            <div class="btn-row">
              <button class="chip-btn" data-role-pdf="${esc(r.id)}" title="Generar guía PDF para ${esc(r.person || r.role)}">${icon('printer', 13)} PDF</button>
              ${ctx.isAdmin ? `<button class="icon-btn" data-edit-role="${esc(r.id)}" title="Editar">${icon('edit', 14)}</button>
                <button class="icon-btn icon-danger" data-del-role="${esc(r.id)}" title="Eliminar">${icon('trash', 14)}</button>` : ''}
            </div>
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
  el.querySelector('#btn-new-role')?.addEventListener('click', () => openRoleModal(null, roles.length, ''));
  el.querySelector('#btn-add-couple')?.addEventListener('click', () => openRoleModal(null, roles.length, 'Damas y caballeros'));
  el.querySelectorAll('[data-edit-role]').forEach((b) => b.addEventListener('click', () => {
    const r = roles.find((x) => String(x.id) === String(b.dataset.editRole));
    if (r) openRoleModal(r, roles.length);
  }));
  el.querySelectorAll('[data-del-role]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Eliminar este rol?')) return;
    try { await db.remove('team_roles', b.dataset.delRole); toast('Rol eliminado'); }
    catch (e) { toast(e.message, 'error'); }
  }));

  // PDF por tarjeta superior y PDF individual por colaborador
  el.querySelectorAll('[data-pdf]').forEach((b) => b.addEventListener('click', () => {
    exportRoleGuidePdf(b.dataset.pdf, pdfPayload);
  }));
  el.querySelectorAll('[data-role-pdf]').forEach((b) => b.addEventListener('click', () => {
    const r = staff.find((x) => String(x.id) === String(b.dataset.rolePdf));
    if (!r) return;
    if (/director/i.test(r.role)) exportRoleGuidePdf('director', pdfPayload);
    else if (/audio|música|foto|video/i.test(r.role)) exportRoleGuidePdf('audio', pdfPayload);
    else if (/acomodador/i.test(r.role)) exportRoleGuidePdf('acomodadores', pdfPayload);
    else exportRoleGuidePdf(r, pdfPayload);
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
      celebrate();
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
}

function openRoleModal(r, count, presetRole = '') {
  const isEdit = Boolean(r);
  const initialRole = r?.role || presetRole || 'Director del Banquete';
  const showCouple = isCoupleRole(initialRole);

  const { form } = openModal({
    title: isEdit ? 'Editar rol' : 'Agregar rol / colaborador',
    submitLabel: isEdit ? 'Guardar cambios' : 'Agregar',
    body: `
      <label class="field"><span>Rol en la boda *</span>
        <input name="role" id="m-role-input" list="role-presets" required value="${esc(initialRole)}" placeholder="Ej. Director del Banquete">
        <datalist id="role-presets">${ROLE_PRESETS.map((p) => `<option value="${p}">`).join('')}</datalist>
      </label>
      <div class="form-grid" id="m-person-grid">
        <label class="field"><span id="m-person-lbl">${showCouple ? 'Caballero *' : 'Hermano / Persona encargada *'}</span>
          <input name="person" required value="${esc(r?.person || '')}" placeholder="${showCouple ? 'Ej. Manuel' : 'Ej. Alfonso Carangui'}">
        </label>
        <label class="field" id="m-partner-wrap" ${showCouple ? '' : 'hidden'}><span>Dama (pareja) *</span>
          <input name="partner" value="${esc(showCouple ? (r?.partner || '') : '')}" placeholder="Ej. Nancy">
        </label>
      </div>
      <div class="form-grid">
        <label class="field"><span>Teléfono / WhatsApp</span>
          <input name="phone" type="tel" value="${esc(r?.phone || '')}" placeholder="0991234567">
        </label>
        <label class="field"><span>Orden en lista</span>
          <input name="sort" type="number" min="1" value="${esc(r?.sort ?? count + 1)}">
        </label>
      </div>
      <label class="field"><span>Notas / indicaciones</span>
        <input name="notes" value="${esc(r?.notes || '')}" placeholder="Ej. Supervisión general, equipo de sonido…">
      </label>`,
    onSubmit: async (fd) => {
      const s = (k) => String(fd.get(k) || '').trim() || null;
      const role = s('role');
      const person = s('person');
      if (!role) throw new Error('Escribe el nombre del rol.');
      if (!person) throw new Error('Escribe el nombre de la persona encargada.');
      const couple = isCoupleRole(role);
      const partner = couple ? s('partner') : null;
      if (couple && !partner) throw new Error('Escribe el nombre de la dama para esta pareja.');

      const payload = {
        role,
        person,
        partner,
        phone: s('phone'),
        notes: s('notes'),
        sort: Number(fd.get('sort')) || count + 1,
      };
      if (isEdit) { await db.update('team_roles', r.id, payload); toast('Rol actualizado y sincronizado ✔'); }
      else { await db.insert('team_roles', payload); toast('Rol agregado y sincronizado ✔'); }
    },
  });

  // Lógica dinámica: el campo de Dama/Pareja SOLO aparece cuando el rol es "Damas y caballeros"
  const roleInp = form.querySelector('#m-role-input');
  const partnerWrap = form.querySelector('#m-partner-wrap');
  const personLbl = form.querySelector('#m-person-lbl');
  const personInp = form.querySelector('input[name="person"]');
  const syncFields = () => {
    const couple = isCoupleRole(roleInp.value);
    partnerWrap.hidden = !couple;
    personLbl.textContent = couple ? 'Caballero *' : 'Hermano / Persona encargada *';
    personInp.placeholder = couple ? 'Ej. Manuel' : 'Ej. Alfonso Carangui';
  };
  roleInp.addEventListener('input', syncFields);
  roleInp.addEventListener('change', syncFields);
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
