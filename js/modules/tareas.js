// Módulo "Tareas": checklist completo por etapas, filtros y vínculo con principios bíblicos.
import * as db from '../db.js';
import { esc, toast, openModal, fmtDate, todayISO, celebrate } from '../ui.js';
import { icon } from '../icons.js';
import { STAGES, CATEGORIES } from '../data/seed.js';
import { exportTasksPdf } from '../pdf.js';

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  hecho: 'Hecho',
};

const filterState = { stage: 'all', category: 'all', status: 'all', principle: 'all', q: '' };

export async function renderTareas(el, ctx) {
  const [wedding, tasks, principles] = await Promise.all([
    db.getWedding(),
    db.list('tasks', { order: 'sort' }),
    db.list('principles', { order: 'sort' }),
  ]);

  const today = todayISO();
  const principleById = Object.fromEntries(principles.map((p) => [p.id, p]));

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'hecho').length;
  const inProg = tasks.filter((t) => t.status === 'en_progreso').length;
  const overdue = tasks.filter((t) => t.status !== 'hecho' && t.due_date && t.due_date < today).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  el.innerHTML = `
  <header class="page-head">
    <div>
      <span class="eyebrow">${icon('clipboard', 14)} Planificación ordenada · 1 Cor. 14:40</span>
      <h1>Tareas y Checklist</h1>
      <p>Organiza cada paso por etapas. Cada tarea puede vincularse con un principio del artículo de <em>La Atalaya</em> y asignarse a un colaborador.</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-outline" id="btn-export-tasks-pdf">${icon('printer', 16)} Exportar PDF</button>
      ${ctx.isAdmin ? `<button class="btn btn-primary" id="btn-new-task">${icon('plus', 16)} Nueva tarea</button>` : ''}
    </div>
  </header>

  <section class="card progress-banner">
    <div class="progress-banner-top">
      <div>
        <strong>Progreso general: ${done} de ${total} tareas completadas (${pct}%)</strong>
        <span class="muted">· ${inProg} en progreso ${overdue ? `· <b class="txt-err">${overdue} atrasada${overdue > 1 ? 's' : ''}</b>` : '· ¡Al día!'}</span>
      </div>
      <span class="pill pill-stage">${pct}%</span>
    </div>
    <div class="bar"><span style="width:${pct}%"></span></div>
  </section>

  <section class="toolbar card">
    <div class="search-box">
      ${icon('search', 16)}
      <input id="f-q" type="search" placeholder="Buscar tarea o responsable…" value="${esc(filterState.q)}">
    </div>
    <select id="f-stage" aria-label="Filtrar por etapa">
      <option value="all">Todas las etapas</option>
      ${STAGES.map((s) => `<option value="${s.key}" ${filterState.stage === s.key ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
    </select>
    <select id="f-cat" aria-label="Filtrar por categoría">
      <option value="all">Todas las categorías</option>
      ${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${filterState.category === k ? 'selected' : ''}>${c.emoji} ${esc(c.label)}</option>`).join('')}
    </select>
    <select id="f-status" aria-label="Filtrar por estado">
      <option value="all">Todos los estados</option>
      <option value="pendiente" ${filterState.status === 'pendiente' ? 'selected' : ''}>Pendientes</option>
      <option value="en_progreso" ${filterState.status === 'en_progreso' ? 'selected' : ''}>En progreso</option>
      <option value="hecho" ${filterState.status === 'hecho' ? 'selected' : ''}>Completadas</option>
      <option value="atrasadas" ${filterState.status === 'atrasadas' ? 'selected' : ''}>Atrasadas</option>
    </select>
    <select id="f-prin" aria-label="Filtrar por principio">
      <option value="all">Todos los principios</option>
      ${principles.map((p) => `<option value="${p.id}" ${String(filterState.principle) === String(p.id) ? 'selected' : ''}>${esc(p.scripture)} · ${esc(p.title)}</option>`).join('')}
    </select>
  </section>

  <div id="tasks-mount" class="stages-stack"></div>`;

  const mount = el.querySelector('#tasks-mount');

  function paint() {
    const q = filterState.q.trim().toLowerCase();
    const filtered = tasks.filter((t) => {
      if (filterState.stage !== 'all' && t.stage !== filterState.stage) return false;
      if (filterState.category !== 'all' && t.category !== filterState.category) return false;
      if (filterState.principle !== 'all' && String(t.principle_id) !== String(filterState.principle)) return false;
      if (filterState.status === 'atrasadas') {
        if (t.status === 'hecho' || !t.due_date || t.due_date >= today) return false;
      } else if (filterState.status !== 'all' && t.status !== filterState.status) {
        return false;
      }
      if (q) {
        const hay = `${t.title} ${t.description || ''} ${t.assignee || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      mount.innerHTML = `<div class="card empty-state">${icon('search', 24)}<p>No hay tareas que coincidan con los filtros seleccionados.</p></div>`;
      return;
    }

    const activeStages = STAGES.filter((s) => filtered.some((t) => t.stage === s.key));
    mount.innerHTML = activeStages.map((s) => {
      const list = filtered.filter((t) => t.stage === s.key);
      const sDone = list.filter((t) => t.status === 'hecho').length;
      return `<section class="card">
        <header class="card-head">
          <div>
            <h2>${esc(s.label)}</h2>
            <small class="muted">${esc(s.hint)}</small>
          </div>
          <span class="pill pill-stage">${sDone}/${list.length}</span>
        </header>
        <ul class="task-list">
          ${list.map((t) => {
            const p = principleById[t.principle_id];
            const late = t.status !== 'hecho' && t.due_date && t.due_date < today;
            const cat = CATEGORIES[t.category];
            return `<li class="task ${t.status === 'hecho' ? 'is-done' : ''}" data-id="${esc(t.id)}">
              <label class="check" title="Marcar como completada">
                <input type="checkbox" data-toggle="${esc(t.id)}" ${t.status === 'hecho' ? 'checked' : ''}>
                <span class="check-box">${icon('check', 14)}</span>
              </label>
              <div class="task-body">
                <div class="task-row-top">
                  <span class="task-title">${esc(t.title)}</span>
                  <div class="task-actions">
                    <select class="mini-select status-${t.status}" data-status="${esc(t.id)}" aria-label="Estado">
                      ${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${v}</option>`).join('')}
                    </select>
                    ${ctx.isAdmin ? `<button class="icon-btn" data-edit="${esc(t.id)}" title="Editar">${icon('edit', 15)}</button>
                      <button class="icon-btn icon-danger" data-del="${esc(t.id)}" title="Eliminar">${icon('trash', 15)}</button>` : ''}
                  </div>
                </div>
                ${t.description ? `<p class="task-desc">${esc(t.description)}</p>` : ''}
                <div class="task-meta">
                  ${cat ? `<span class="pill">${cat.emoji} ${esc(cat.label)}</span>` : ''}
                  ${p ? `<a class="pill pill-verse" href="${esc(p.scripture_url)}" target="_blank" rel="noopener">${icon('book', 11)} ${esc(p.scripture)}</a>` : ''}
                  ${t.assignee ? `<span class="pill pill-stage">${icon('users', 11)} ${esc(t.assignee)}</span>` : ''}
                  ${t.due_date ? `<span class="due ${late ? 'late' : ''}">${icon('calendar', 12)} ${fmtDate(t.due_date, { day: 'numeric', month: 'short', year: 'numeric' })}${late ? ' · Atrasada' : ''}</span>` : ''}
                </div>
              </div>
            </li>`;
          }).join('')}
        </ul>
      </section>`;
    }).join('');

    // Listeners en cada tarea
    mount.querySelectorAll('[data-toggle]').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const nextStatus = cb.checked ? 'hecho' : 'pendiente';
        try {
          await db.update('tasks', cb.dataset.toggle, { status: nextStatus });
          if (cb.checked) celebrate();
          toast(cb.checked ? '¡Tarea completada! ✔' : 'Marcada como pendiente');
        } catch (e) { cb.checked = !cb.checked; toast(e.message, 'error'); }
      });
    });

    mount.querySelectorAll('[data-status]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        try {
          await db.update('tasks', sel.dataset.status, { status: sel.value });
          toast(`Estado: ${STATUS_LABELS[sel.value]}`);
        } catch (e) { toast(e.message, 'error'); }
      });
    });

    mount.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const task = tasks.find((x) => String(x.id) === String(btn.dataset.edit));
        if (task) openTaskModal(task, principles, tasks.length);
      });
    });

    mount.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar esta tarea?')) return;
        try {
          await db.remove('tasks', btn.dataset.del);
          toast('Tarea eliminada');
        } catch (e) { toast(e.message, 'error'); }
      });
    });
  }

  paint();

  el.querySelector('#f-q').addEventListener('input', (e) => { filterState.q = e.target.value; paint(); });
  el.querySelector('#f-stage').addEventListener('change', (e) => { filterState.stage = e.target.value; paint(); });
  el.querySelector('#f-cat').addEventListener('change', (e) => { filterState.category = e.target.value; paint(); });
  el.querySelector('#f-status').addEventListener('change', (e) => { filterState.status = e.target.value; paint(); });
  el.querySelector('#f-prin').addEventListener('change', (e) => { filterState.principle = e.target.value; paint(); });
  el.querySelector('#btn-export-tasks-pdf').addEventListener('click', () => exportTasksPdf({ wedding, tasks, principles }));
  el.querySelector('#btn-new-task')?.addEventListener('click', () => openTaskModal(null, principles, tasks.length));
}

function openTaskModal(task, principles, count) {
  const isEdit = Boolean(task);
  openModal({
    title: isEdit ? 'Editar tarea' : 'Nueva tarea',
    wide: true,
    submitLabel: isEdit ? 'Guardar cambios' : 'Crear tarea',
    body: `
      <label class="field"><span>Título de la tarea *</span>
        <input name="title" required value="${esc(task?.title || '')}" placeholder="Ej. Confirmar flores con Katy">
      </label>
      <label class="field"><span>Notas / descripción</span>
        <textarea name="description" rows="2" placeholder="Detalles importantes o pasos a seguir…">${esc(task?.description || '')}</textarea>
      </label>
      <div class="form-grid">
        <label class="field"><span>Etapa</span>
          <select name="stage">
            ${STAGES.map((s) => `<option value="${s.key}" ${(task?.stage || 's2') === s.key ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Categoría</span>
          <select name="category">
            ${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${(task?.category || 'espiritual') === k ? 'selected' : ''}>${c.emoji} ${esc(c.label)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Principio bíblico relacionado</span>
          <select name="principle_id">
            <option value="">Ninguno en particular</option>
            ${principles.map((p) => `<option value="${p.id}" ${String(task?.principle_id) === String(p.id) ? 'selected' : ''}>${esc(p.scripture)} · ${esc(p.title)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Responsable</span>
          <input name="assignee" value="${esc(task?.assignee || '')}" placeholder="Ej. Freddy, Priscila, Katy…">
        </label>
        <label class="field"><span>Fecha límite</span>
          <input name="due_date" type="date" value="${esc(task?.due_date || '')}">
        </label>
        <label class="field"><span>Estado</span>
          <select name="status">
            ${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${(task?.status || 'pendiente') === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </label>
      </div>`,
    onSubmit: async (fd) => {
      const s = (k) => String(fd.get(k) || '').trim() || null;
      const title = s('title');
      if (!title) throw new Error('El título de la tarea es obligatorio.');
      const payload = {
        title,
        description: s('description'),
        stage: s('stage') || 's2',
        category: s('category'),
        principle_id: s('principle_id') ? Number(s('principle_id')) : null,
        assignee: s('assignee'),
        due_date: s('due_date'),
        status: s('status') || 'pendiente',
      };
      if (isEdit) {
        await db.update('tasks', task.id, payload);
        toast('Tarea actualizada ✔');
      } else {
        await db.insert('tasks', { ...payload, sort: count + 1 });
        toast('Tarea creada ✔');
      }
    },
  });
}
