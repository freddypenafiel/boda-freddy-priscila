// Módulo "Principios": principios bíblicos del artículo y su relación con las tareas.
import * as db from '../db.js';
import { esc } from '../ui.js';
import { icon } from '../icons.js';
import { CATEGORIES, ARTICLE_URL } from '../data/seed.js';

export async function renderPrincipios(el) {
  const [principles, tasks] = await Promise.all([
    db.list('principles', { order: 'sort' }),
    db.list('tasks', { order: 'sort' }),
  ]);

  el.innerHTML = `
  <header class="page-head">
    <div>
      <span class="eyebrow">${icon('book', 14)} Base espiritual</span>
      <h1>Principios que nos guían</h1>
      <p>La Biblia no da una lista de reglas para las bodas, pero sus principios nos ayudan a tomar decisiones que honren a Jehová.
      Cada principio está enlazado a las tareas del checklist.</p>
    </div>
    <a class="btn btn-outline" href="${ARTICLE_URL}" target="_blank" rel="noopener">${icon('external', 16)} Leer el artículo en jw.org</a>
  </header>

  <div class="principles-grid">
    ${principles.map((p, i) => {
      const related = tasks.filter((t) => t.principle_id === p.id);
      const done = related.filter((t) => t.status === 'hecho').length;
      return `<article class="principle-card">
        <div class="principle-top">
          <span class="principle-n">${i + 1}</span>
          <span class="pill">${CATEGORIES[p.category]?.emoji || '🕊️'} ${esc(CATEGORIES[p.category]?.label || '')}</span>
        </div>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.summary)}</p>
        <div class="principle-foot">
          <a class="pill pill-verse" href="${esc(p.scripture_url)}" target="_blank" rel="noopener">${icon('book', 12)} ${esc(p.scripture)}</a>
          ${related.length ? `<span class="principle-tasks">${done}/${related.length} tareas</span>` : ''}
        </div>
        ${related.length ? `<div class="bar bar-sm"><span style="width:${Math.round((done / related.length) * 100)}%"></span></div>` : ''}
      </article>`;
    }).join('')}
  </div>

  <aside class="golden-rule">
    ${icon('sparkle', 22)}
    <div><strong>Regla de oro (Filip. 4:8):</strong> ante cualquier detalle, preguntémonos:
    “¿Es digno? ¿Edifica? ¿Honra a Jehová ante los invitados?”</div>
  </aside>`;
}
