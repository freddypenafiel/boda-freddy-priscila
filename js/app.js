// Punto de entrada: arranque, acceso sencillo (Nombre + Teléfono), estructura y enrutador.
import * as db from './db.js';
import { esc, toast } from './ui.js';
import { icon } from './icons.js';
import { ROUTES, renderComingSoon } from './modules/registry.js';

const root = document.getElementById('app');
let ctx = null;
let cleanup = null;
let unsubscribe = null;
let currentKey = null;
let deferredInstall = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  const b = document.getElementById('btn-install');
  if (b) b.hidden = false;
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

/* =================== Arranque =================== */
async function boot() {
  root.innerHTML = `<div class="splash">${icon('rings', 46)}<p>Cargando nuestra boda…</p></div>`;
  try {
    await db.initDb();
  } catch (e) {
    return renderLogin(e.message);
  }
  if (db.getMode() === 'demo') return startApp(db.auth.saved());

  const member = await db.auth.verifySaved();
  if (!member) return renderLogin();
  startApp(member);
}

/* =================== Acceso (Solo Nombre + Teléfono) =================== */
function renderLogin(errorMsg = '') {
  teardown();
  root.innerHTML = `
  <div class="auth">
    <section class="auth-hero">
      <div class="auth-deco" aria-hidden="true">${icon('leaf', 260)}</div>
      <span class="eyebrow light">${icon('heart', 14)} Organizador de boda</span>
      <h1>Freddy <span>&amp;</span> Priscila</h1>
      <p class="auth-date">Viernes 26 · Febrero · 2027</p>
      <blockquote>“Háganlo todo de forma digna y ordenada”<cite>— 1 Corintios 14:40</cite></blockquote>
      <ul class="auth-feats">
        <li>${icon('book', 18)} Organización basada en principios bíblicos</li>
        <li>${icon('clipboard', 18)} Tareas, invitados, mesas y presupuesto</li>
        <li>${icon('cloud', 18)} Sincronizado en tiempo real entre los dos</li>
      </ul>
    </section>
    <section class="auth-panel">
      <div class="auth-card">
        <span class="auth-logo">${icon('rings', 30)}</span>
        <h2>Bienvenidos</h2>
        <p class="muted" style="margin-bottom:18px;">Ingresa solo con tu nombre y tu número de teléfono (sin correo ni contraseña).</p>
        <form id="auth-form" novalidate>
          <label class="field">
            <span>Tu nombre</span>
            <input name="name" autocomplete="name" required placeholder="Ej. Freddy o Priscila">
          </label>
          <label class="field">
            <span>Número de teléfono</span>
            <input name="phone" type="tel" autocomplete="tel" required placeholder="Ej. 0991234567">
          </label>
          <p class="form-error" id="auth-error" ${errorMsg ? '' : 'hidden'}>${esc(errorMsg)}</p>
          <button class="btn btn-primary btn-block" type="submit" id="auth-submit">${icon('arrow', 16)} Entrar al organizador</button>
        </form>
        <div class="divider"><span>o</span></div>
        <button class="btn btn-outline btn-block" id="btn-demo">${icon('device', 16)} Explorar en modo demo</button>
        <p class="fine">Solo los teléfonos autorizados por Freddy y Priscila pueden ver los datos reales en la nube.</p>
      </div>
    </section>
  </div>`;

  const form = root.querySelector('#auth-form');
  const errEl = root.querySelector('#auth-error');
  const submit = root.querySelector('#auth-submit');
  const showErr = (m) => { errEl.textContent = m; errEl.hidden = !m; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    if (!name) return showErr('Escribe tu nombre.');
    if (!phone) return showErr('Escribe tu número de teléfono.');
    submit.disabled = true;
    showErr('');
    try {
      if (db.getMode() !== 'cloud') {
        db.setPreferredMode('cloud');
        await db.initDb('cloud');
      }
      const member = await db.auth.login(name, phone);
      if (!member) {
        renderNoAccess(name, db.formatPhone(phone));
      } else {
        startApp(member);
      }
    } catch (err) {
      showErr(err.message);
    } finally {
      submit.disabled = false;
    }
  });

  root.querySelector('#btn-demo').addEventListener('click', async () => {
    db.setPreferredMode('demo');
    await db.initDb('demo');
    startApp(db.auth.saved());
  });
}

function renderNoAccess(name = '', phoneLabel = '') {
  teardown();
  root.innerHTML = `
  <div class="center-screen">
    <div class="auth-card">
      <span class="auth-logo warn">${icon('lock', 30)}</span>
      <h2>Número aún no autorizado</h2>
      <p class="muted" style="margin-bottom:8px;"><strong>${esc(name)}</strong> · ${esc(phoneLabel)}</p>
      <p class="muted">Pide a Freddy o a Priscila que agreguen tu número en <strong>Equipo → Accesos al Sistema</strong> y luego vuelve a intentar.</p>
      <button class="btn btn-primary btn-block" id="btn-retry" style="margin-top:14px;">${icon('refresh', 16)} Ya me autorizaron, entrar</button>
      <button class="btn btn-ghost btn-block" id="btn-back">${icon('arrow', 16)} Cambiar número</button>
    </div>
  </div>`;
  root.querySelector('#btn-retry').addEventListener('click', async () => {
    try {
      const m = await db.auth.login(name, phoneLabel);
      if (m) startApp(m);
      else toast('Ese número todavía no está autorizado.', 'error');
    } catch (e) { toast(e.message, 'error'); }
  });
  root.querySelector('#btn-back').addEventListener('click', () => renderLogin());
}

/* =================== App =================== */
function startApp(member) {
  teardown();
  const mode = db.getMode();
  ctx = { member, isAdmin: member?.role === 'admin', mode };
  const name = member?.display_name || db.formatPhone(member?.phone) || 'Usuario';

  root.innerHTML = `
  <div class="app">
    <header class="topbar">
      <a class="brand" href="#/panel">
        <span class="brand-mark">${icon('rings', 22)}</span>
        <span class="brand-text"><strong>Freddy &amp; Priscila</strong><small>Una boda que honra a Jehová</small></span>
      </a>
      <div class="topbar-right">
        <button class="chip-btn" id="btn-install" ${deferredInstall ? '' : 'hidden'} title="Instalar app en tu celular o PC">${icon('install', 14)} Instalar</button>
        <span class="mode-badge mode-${mode}" title="${mode === 'cloud' ? 'Datos sincronizados con Supabase' : 'Datos guardados solo en este dispositivo'}">
          ${icon(mode === 'cloud' ? 'cloud' : 'device', 14)} <span>${mode === 'cloud' ? 'En la nube' : 'Modo demo'}</span></span>
        ${mode === 'demo' ? `<button class="icon-btn" id="btn-reset" title="Reiniciar datos demo">${icon('refresh', 18)}</button>` : ''}
        <div class="user-chip">
          <span class="avatar">${esc(name.trim().charAt(0).toUpperCase())}</span>
          <span class="user-meta"><strong>${esc(name)}</strong><small>${ctx.isAdmin ? 'Administrador' : 'Ayudante'}</small></span>
        </div>
        <button class="icon-btn" id="btn-logout" title="Salir">${icon('logout', 18)}</button>
      </div>
    </header>
    <nav class="modnav" aria-label="Módulos">
      <div class="modnav-inner">
        ${ROUTES.map((r) => `<a class="modnav-item" href="#/${r.key}" data-key="${r.key}">
          ${icon(r.icon, 24)}<span>${esc(r.label)}</span></a>`).join('')}
      </div>
    </nav>
    <main id="view" class="view" tabindex="-1"></main>
    <footer class="app-foot">“Ya sea que coman o beban o hagan cualquier otra cosa, háganlo todo para la gloria de Dios.” — 1 Corintios 10:31</footer>
  </div>`;

  root.querySelector('#btn-install')?.addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    if (outcome === 'accepted') toast('¡App instalada! 📱');
    deferredInstall = null;
    const b = document.getElementById('btn-install');
    if (b) b.hidden = true;
  });

  root.querySelector('#btn-logout').addEventListener('click', async () => {
    await db.auth.signOut();
    if (mode === 'demo') db.setPreferredMode('cloud');
    renderLogin();
  });
  root.querySelector('#btn-reset')?.addEventListener('click', () => {
    if (confirm('¿Reiniciar los datos de demostración? Se perderán los cambios hechos en modo demo.')) {
      db.resetDemo();
      toast('Datos demo reiniciados');
    }
  });

  let pending = null;
  unsubscribe = db.subscribe(() => {
    clearTimeout(pending);
    pending = setTimeout(() => { if (!document.querySelector('.modal-backdrop')) renderRoute(true); }, 250);
  });

  window.addEventListener('hashchange', onHash);
  renderRoute();
}

function onHash() { renderRoute(); }

async function renderRoute(isRefresh = false) {
  const view = document.getElementById('view');
  if (!view) return;
  const key = (location.hash.replace(/^#\/?/, '') || 'panel').split(/[?/]/)[0];
  const route = ROUTES.find((r) => r.key === key) || ROUTES[0];

  document.querySelectorAll('.modnav-item').forEach((a) => a.classList.toggle('active', a.dataset.key === route.key));
  document.title = `${route.label} · Boda Freddy & Priscila`;

  if (cleanup) { cleanup(); cleanup = null; }
  if (!isRefresh || currentKey !== route.key) {
    view.innerHTML = `<div class="loading">${icon('rings', 30)}<span>Cargando…</span></div>`;
    window.scrollTo({ top: 0 });
  }
  currentKey = route.key;
  try {
    if (route.render) {
      const scrollY = window.scrollY;
      const c = await route.render(view, ctx);
      if (typeof c === 'function') cleanup = c;
      if (isRefresh) window.scrollTo({ top: scrollY });
    } else {
      renderComingSoon(view, route);
    }
    view.classList.remove('fade-in'); void view.offsetWidth; if (!isRefresh) view.classList.add('fade-in');
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="error-box">${icon('alert', 22)}<div><strong>No se pudieron cargar los datos.</strong><p>${esc(e.message)}</p>
      <p class="muted">Revisa haber ejecutado <code>supabase/update_simple_phone.sql</code> en Supabase.</p></div></div>`;
  }
}

function teardown() {
  if (cleanup) { cleanup(); cleanup = null; }
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  window.removeEventListener('hashchange', onHash);
  currentKey = null;
}

boot();
