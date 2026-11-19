// Módulo "Mi boda": panel principal con cuenta regresiva y progreso.
import * as db from '../db.js';
import { esc, toast, openModal, fmtMoney, fmtDate, fmtTime, toLocalInput, fromLocalInput, todayISO } from '../ui.js';
import { icon } from '../icons.js';
import { STAGES, CATEGORIES, VERSES, ARTICLE_URL } from '../data/seed.js';
import { exportFullWeddingPdf } from '../pdf.js';

const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

function ring(pct, size = 64) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>
    <text x="50%" y="50%" dy=".35em" text-anchor="middle">${Math.round(pct)}%</text></svg>`;
}

const missing = (v) => !v || /por definir/i.test(String(v));

function verseOfDay() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const day = Math.floor((Date.now() - start) / 86400000);
  return VERSES[day % VERSES.length];
}

export async function renderPanel(el, ctx) {
  const [wedding, tasks, principles, guests, team, budget, payments, songs] = await Promise.all([
    db.getWedding(),
    db.list('tasks', { order: 'sort' }),
    db.list('principles', { order: 'sort' }),
    db.list('guests'),
    db.list('team_roles', { order: 'sort' }),
    db.list('budget_items'),
    db.list('payments'),
    db.list('songs', { order: 'sort' }),
  ]);

  const today = todayISO();
  const done = tasks.filter((t) => t.status === 'hecho').length;
  const taskPct = tasks.length ? (done / tasks.length) * 100 : 0;
  const overdue = tasks.filter((t) => t.status !== 'hecho' && t.due_date && t.due_date < today).length;

  const invited = guests.reduce((n, g) => n + 1 + (g.companions || 0), 0);
  const confirmed = guests.filter((g) => g.rsvp === 'si').reduce((n, g) => n + 1 + (g.companions_confirmed || 0), 0);
  const target = wedding.guest_target || 100;

  const spent = payments.reduce((n, p) => n + Number(p.amount || 0), 0);
  const estimated = budget.reduce((n, b) => n + Number(b.estimated || 0), 0);
  const budgetTarget = Number(wedding.budget_target) || estimated;
  const budgetPct = budgetTarget ? (spent / budgetTarget) * 100 : 0;

  const assigned = team.filter((r) => !missing(r.person)).length;

  const next = tasks
    .filter((t) => t.status !== 'hecho')
    .sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || (a.sort ?? 0) - (b.sort ?? 0))
    .slice(0, 6);

  const principleById = Object.fromEntries(principles.map((p) => [p.id, p]));
  const verse = verseOfDay();

  const keyData = [
    ['book', 'Salón del Reino', wedding.kingdom_hall],
    ['sparkle', 'Orador del discurso', wedding.speaker],
    ['clipboard', 'Boda civil', wedding.civil_date ? `${fmtDate(wedding.civil_date)}${wedding.civil_place ? ' · ' + wedding.civil_place : ''}` : wedding.civil_place],
    ['pin', 'Local de recepción', wedding.reception_venue],
    ['star', 'Director del Banquete', wedding.banquet_director],
    ['shirt', 'Código de vestimenta', wedding.dress_colors],
  ];
  const pendingKeys = keyData.filter(([, , v]) => missing(v)).length;

  const couples = team.filter((r) => /damas/i.test(r.role));
  const otherRoles = team.filter((r) => !/damas/i.test(r.role));

  const dateLabel = wedding.wedding_date
    ? fmtDate(wedding.wedding_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Fecha por definir';

  el.innerHTML = `
  <section class="hero">
    <div class="hero-deco" aria-hidden="true">${icon('leaf', 220)}</div>
    <div class="hero-main">
      <span class="eyebrow">${icon('heart', 14)} Nuestra boda</span>
      <h1 class="hero-title">${esc(wedding.couple_names || 'Freddy & Priscila')}</h1>
      <p class="hero-date">${icon('calendar', 16)} <span class="cap">${esc(dateLabel)}</span>
        ${wedding.wedding_date ? `· ${icon('clock', 16)} ${fmtTime(wedding.wedding_date)} ${wedding.time_confirmed ? '' : '<em class="tbd">(hora por confirmar)</em>'}` : ''}</p>
      ${wedding.city ? `<p class="hero-date">${icon('pin', 16)} ${esc(wedding.city)}</p>` : ''}
      <blockquote class="hero-quote">“Háganlo todo de forma digna y ordenada” <cite>— 1 Corintios 14:40</cite></blockquote>
    </div>
    <div class="hero-side">
      <div class="countdown" id="countdown" data-date="${esc(wedding.wedding_date || '')}">
        ${['días', 'horas', 'min', 'seg'].map((l, i) => `<div class="cd-box"><span class="cd-num" data-i="${i}">--</span><span class="cd-label">${l}</span></div>`).join('')}
      </div>
      <div class="btn-row">
        <button class="btn btn-light" id="btn-export-summary">${icon('printer', 16)} Exportar resumen PDF</button>
        ${ctx.isAdmin ? `<button class="btn btn-light" id="btn-edit-wedding">${icon('edit', 16)} Editar datos</button>` : ''}
      </div>
    </div>
  </section>

  <section class="stats">
    <a class="stat" href="#/tareas">
      ${ring(taskPct)}
      <div><span class="stat-label">Tareas</span><strong class="stat-value">${done} / ${tasks.length}</strong>
      <span class="stat-hint ${overdue ? 'warn' : ''}">${overdue ? `${overdue} atrasada${overdue > 1 ? 's' : ''}` : 'completadas'}</span></div>
    </a>
    <a class="stat" href="#/invitados">
      ${ring(target ? (confirmed / target) * 100 : 0)}
      <div><span class="stat-label">Invitados</span><strong class="stat-value">${confirmed} / ${target}</strong>
      <span class="stat-hint">${guests.length ? `${invited} invitados en lista` : 'confirmados · lista pendiente'}</span></div>
    </a>
    <a class="stat" href="#/presupuesto">
      ${ring(budgetPct)}
      <div><span class="stat-label">Presupuesto</span><strong class="stat-value">${fmtMoney(spent)}</strong>
      <span class="stat-hint">${budgetTarget ? `de ${fmtMoney(budgetTarget)}` : 'Define tu presupuesto'}</span></div>
    </a>
    <a class="stat" href="#/equipo">
      ${ring(team.length ? (assigned / team.length) * 100 : 0)}
      <div><span class="stat-label">Equipo</span><strong class="stat-value">${assigned} / ${team.length}</strong>
      <span class="stat-hint">roles asignados</span></div>
    </a>
  </section>

  <div class="grid-2">
    <div class="col">
      <section class="card">
        <header class="card-head">
          <h2>${icon('clipboard', 18)} Próximas tareas</h2>
          <a class="link" href="#/tareas">Ver todas ${icon('arrow', 14)}</a>
        </header>
        <ul class="task-list">
          ${next.length ? next.map((t) => {
            const st = STAGES.find((s) => s.key === t.stage);
            const p = principleById[t.principle_id];
            const late = t.due_date && t.due_date < today;
            return `<li class="task">
              <label class="check">
                <input type="checkbox" data-task="${esc(t.id)}" ${t.status === 'hecho' ? 'checked' : ''}>
                <span class="check-box">${icon('check', 14)}</span>
              </label>
              <div class="task-body">
                <span class="task-title">${esc(t.title)}</span>
                <span class="task-meta">
                  <span class="pill pill-stage">${esc(st?.label || '')}</span>
                  ${t.category ? `<span class="pill">${CATEGORIES[t.category]?.emoji || ''} ${esc(CATEGORIES[t.category]?.label || t.category)}</span>` : ''}
                  ${p ? `<a class="pill pill-verse" href="${esc(p.scripture_url)}" target="_blank" rel="noopener">${esc(p.scripture)}</a>` : ''}
                  ${t.due_date ? `<span class="due ${late ? 'late' : ''}">${icon('calendar', 12)} ${fmtDate(t.due_date, { day: 'numeric', month: 'short' })}</span>` : ''}
                </span>
              </div>
            </li>`;
          }).join('') : `<li class="empty">${icon('check', 18)} ¡Todas las tareas están completas!</li>`}
        </ul>
      </section>

      <section class="card">
        <header class="card-head"><h2>${icon('calendar', 18)} Progreso por etapa</h2></header>
        <div class="stages">
          ${STAGES.map((s) => {
            const ts = tasks.filter((t) => t.stage === s.key);
            const d = ts.filter((t) => t.status === 'hecho').length;
            const pct = ts.length ? Math.round((d / ts.length) * 100) : 0;
            return `<div class="stage">
              <div class="stage-top"><strong>${esc(s.label)}</strong><span>${d}/${ts.length}</span></div>
              <div class="bar"><span style="width:${pct}%"></span></div>
              <small>${esc(s.hint)}</small>
            </div>`;
          }).join('')}
        </div>
      </section>
    </div>

    <div class="col">
      <section class="card card-verse">
        <span class="eyebrow">${icon('book', 14)} Texto para meditar hoy</span>
        <p class="verse-text">${esc(verse.text)}</p>
        <a class="verse-ref" href="${esc(verse.url)}" target="_blank" rel="noopener">${esc(verse.ref)} ${icon('external', 13)}</a>
      </section>

      <section class="card">
        <header class="card-head">
          <h2>${icon('pin', 18)} Datos clave</h2>
          ${pendingKeys ? `<span class="pill pill-warn">${pendingKeys} por definir</span>` : `<span class="pill pill-ok">Completo</span>`}
        </header>
        <ul class="kv">
          ${keyData.map(([ic, label, v]) => `<li>
            <span class="kv-ico">${icon(ic, 16)}</span>
            <span class="kv-label">${esc(label)}</span>
            ${missing(v) ? '<span class="kv-val tbd-pill">Por definir</span>' : `<span class="kv-val">${esc(v)}</span>`}
          </li>`).join('')}
        </ul>
      </section>

      <section class="card">
        <header class="card-head">
          <h2>${icon('star', 18)} Equipo</h2>
          <a class="link" href="#/equipo">Gestionar ${icon('arrow', 14)}</a>
        </header>
        <p class="sub">Damas y caballeros</p>
        <div class="couples">
          ${couples.map((c, i) => `<div class="couple"><span class="couple-n">${i + 1}</span>${esc(c.partner || '')} &amp; ${esc(c.person || '')}</div>`).join('')}
        </div>
        <ul class="roles">
          ${otherRoles.map((r) => `<li><span>${esc(r.role)}</span>${missing(r.person) ? '<span class="tbd-pill">Por definir</span>' : `<strong>${esc(r.person)}</strong>`}</li>`).join('')}
        </ul>
        ${songs.length ? `<p class="sub">${icon('music', 14)} Mix de baile (~8 min)</p>
        <ol class="songs">${songs.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a> <small>${esc(s.artist || '')}</small></li>`).join('')}</ol>` : ''}
      </section>
    </div>
  </div>

  <section class="card">
    <header class="card-head">
      <h2>${icon('leaf', 18)} Principios que nos guían</h2>
      <a class="link" href="#/principios">Ver principios ${icon('arrow', 14)}</a>
    </header>
    <div class="principle-chips">
      ${principles.map((p) => `<a class="principle-chip" href="#/principios">
        <span>${CATEGORIES[p.category]?.emoji || '🕊️'}</span><strong>${esc(p.title)}</strong><small>${esc(p.scripture)}</small></a>`).join('')}
    </div>
    <p class="source">Basado en <a href="${ARTICLE_URL}" target="_blank" rel="noopener">“Cómo planear una boda que honre a Jehová” · La Atalaya (estudio), diciembre de 2025 ${icon('external', 12)}</a></p>
  </section>`;

  // ---- Cuenta regresiva ----
  const cd = el.querySelector('#countdown');
  const nums = cd.querySelectorAll('.cd-num');
  const target_ms = cd.dataset.date ? new Date(cd.dataset.date).getTime() : null;
  const tick = () => {
    if (!target_ms) return;
    let diff = Math.max(0, target_ms - Date.now());
    if (diff === 0) { cd.innerHTML = '<p class="cd-done">¡Ya somos esposos! 💍</p>'; return; }
    const parts = [86400000, 3600000, 60000, 1000].map((u) => { const v = Math.floor(diff / u); diff -= v * u; return v; });
    nums.forEach((n, i) => { n.textContent = i === 0 ? parts[i] : String(parts[i]).padStart(2, '0'); });
  };
  tick();
  const timer = setInterval(tick, 1000);

  // ---- Marcar tareas ----
  el.querySelectorAll('input[data-task]').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const li = cb.closest('.task');
      li.classList.toggle('is-done', cb.checked);
      try {
        await db.update('tasks', cb.dataset.task, { status: cb.checked ? 'hecho' : 'pendiente' });
        toast(cb.checked ? '¡Tarea completada! 🎉' : 'Tarea marcada como pendiente');
      } catch (e) {
        cb.checked = !cb.checked;
        li.classList.toggle('is-done', cb.checked);
        toast(e.message, 'error');
      }
    });
  });

  // ---- Editar datos y Exportar PDF ----
  el.querySelector('#btn-edit-wedding')?.addEventListener('click', () => editWedding(wedding));
  el.querySelector('#btn-export-summary')?.addEventListener('click', () =>
    exportFullWeddingPdf({ wedding, tasks, guests, team, budget, payments, songs }));

  return () => clearInterval(timer);
}

function field(name, label, value, type = 'text', extra = '') {
  return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value ?? '')}" ${extra}></label>`;
}

function editWedding(w) {
  openModal({
    title: 'Datos de la boda',
    wide: true,
    submitLabel: 'Guardar cambios',
    body: `
      <div class="form-grid">
        ${field('couple_names', 'Nombre para mostrar', w.couple_names, 'text', 'required')}
        ${field('city', 'Ciudad', w.city)}
        ${field('wedding_date', 'Fecha y hora del discurso', toLocalInput(w.wedding_date), 'datetime-local', 'required')}
        <label class="field field-check"><input type="checkbox" name="time_confirmed" ${w.time_confirmed ? 'checked' : ''}><span>La hora ya está confirmada</span></label>
        ${field('kingdom_hall', 'Salón del Reino', w.kingdom_hall)}
        ${field('kingdom_hall_address', 'Dirección del Salón', w.kingdom_hall_address)}
        ${field('speaker', 'Orador del discurso', w.speaker)}
        ${field('banquet_director', 'Director del Banquete', w.banquet_director)}
        ${field('reception_venue', 'Local de recepción', w.reception_venue)}
        ${field('reception_address', 'Dirección del local', w.reception_address)}
        ${field('civil_date', 'Fecha de la boda civil', w.civil_date, 'date')}
        ${field('civil_place', 'Lugar de la boda civil', w.civil_place)}
        ${field('guest_target', 'Número de invitados', w.guest_target, 'number', 'min="1"')}
        ${field('budget_target', 'Presupuesto total (USD)', w.budget_target, 'number', 'min="0" step="1"')}
        ${field('dress_colors', 'Código de vestimenta', w.dress_colors)}
      </div>`,
    onSubmit: async (fd) => {
      const s = (k) => (fd.get(k) || '').toString().trim() || null;
      if (!s('couple_names') || !s('wedding_date')) throw new Error('El nombre y la fecha son obligatorios.');
      await db.updateWedding({
        couple_names: s('couple_names'),
        city: s('city'),
        wedding_date: fromLocalInput(s('wedding_date')),
        time_confirmed: fd.get('time_confirmed') === 'on',
        kingdom_hall: s('kingdom_hall'),
        kingdom_hall_address: s('kingdom_hall_address'),
        speaker: s('speaker'),
        banquet_director: s('banquet_director'),
        reception_venue: s('reception_venue'),
        reception_address: s('reception_address'),
        civil_date: s('civil_date'),
        civil_place: s('civil_place'),
        guest_target: Number(s('guest_target')) || 100,
        budget_target: Number(s('budget_target')) || 0,
        dress_colors: s('dress_colors'),
      });
      toast('Datos de la boda actualizados ✔');
    },
  });
}
