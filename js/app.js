// Punto de entrada: arranque, autenticación, estructura de la app y enrutador.
import * as db from './db.js';
import { esc, toast, openModal } from './ui.js';
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
  if (db.getMode() === 'demo') return startApp(await db.auth.member());

  db.auth.onChange((evt) => {
    if (evt === 'PASSWORD_RECOVERY') promptNewPassword();
    if (evt === 'SIGNED_OUT') renderLogin();
  });
  const session = await db.auth.session();
  if (!session) return renderLogin();
  await afterLogin();
}

async function afterLogin() {
  const session = await db.auth.session();
  const member = await db.auth.member();
  if (!member) return renderNoAccess(session?.user?.email || '');
  startApp(member);
}

/* =================== Login =================== */
function renderLogin(errorMsg = '') {
  teardown();
  let tab = 'in';
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
        <h2 id="auth-title">Bienvenidos</h2>
        <p class="muted" id="auth-sub">Inicia sesión para organizar nuestra boda.</p>
        <div class="tabs" role="tablist">
          <button type="button" class="tab active" data-tab="in">Iniciar sesión</button>
          <button type="button" class="tab" data-tab="up">Crear cuenta</button>
        </div>
        <form id="auth-form" novalidate>
          <label class="field" id="f-name" hidden><span>Tu nombre</span><input name="name" autocomplete="name" placeholder="Ej. Priscila"></label>
          <label class="field"><span>Correo electrónico</span><input name="email" type="email" autocomplete="email" required placeholder="tucorreo@gmail.com"></label>
          <label class="field"><span>Contraseña</span><input name="password" type="password" autocomplete="current-password" required minlength="6" placeholder="Mínimo 6 caracteres"></label>
          <p class="form-error" id="auth-error" ${errorMsg ? '' : 'hidden'}>${esc(errorMsg)}</p>
          <p class="form-ok" id="auth-ok" hidden></p>
          <button class="btn btn-primary btn-block" type="submit" id="auth-submit">${icon('lock', 16)} Entrar</button>
          <button class="link-btn" type="button" id="btn-forgot">¿Olvidaste tu contraseña?</button>
        </form>
        <div class="divider"><span>o</span></div>
        <button class="btn btn-outline btn-block" id="btn-demo">${icon('device', 16)} Explorar en modo demo</button>
        <p class="fine">Solo las personas autorizadas por Freddy y Priscila pueden ver los datos reales. El modo demo guarda los datos solo en este dispositivo.</p>
      </div>
    </section>
  </div>`;

  const form = root.querySelector('#auth-form');
  const errEl = root.querySelector('#auth-error');
  const okEl = root.querySelector('#auth-ok');
  const submit = root.querySelector('#auth-submit');
  const showErr = (m) => { errEl.textContent = m; errEl.hidden = !m; okEl.hidden = true; };
  const showOk = (m) => { okEl.textContent = m; okEl.hidden = false; errEl.hidden = true; };

  root.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    root.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
    root.querySelector('#f-name').hidden = tab !== 'up';
    root.querySelector('#auth-title').textContent = tab === 'up' ? 'Crear cuenta' : 'Bienvenidos';
    root.querySelector('#auth-sub').textContent = tab === 'up'
      ? 'Usa el correo que Freddy o Priscila autorizaron.'
      : 'Inicia sesión para organizar nuestra boda.';
    submit.innerHTML = tab === 'up' ? `${icon('plus', 16)} Crear cuenta` : `${icon('lock', 16)} Entrar`;
    form.password.autocomplete = tab === 'up' ? 'new-password' : 'current-password';
    showErr('');
  }));

  async function ensureCloud() {
    if (db.getMode() !== 'cloud') {
      db.setPreferredMode('cloud');
      await db.initDb('cloud');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return showErr('Escribe tu correo y contraseña.');
    if (password.length < 6) return showErr('La contraseña debe tener al menos 6 caracteres.');
    submit.disabled = true;
    try {
      await ensureCloud();
      if (tab === 'up') {
        const data = await db.auth.signUp(email, password, form.name.value.trim());
        if (data.session) await afterLogin();
        else showOk('¡Cuenta creada! Revisa tu correo y confirma tu cuenta para poder entrar.');
      } else {
        await db.auth.signIn(email, password);
        await afterLogin();
      }
    } catch (err) {
      showErr(err.message);
    } finally {
      submit.disabled = false;
    }
  });

  root.querySelector('#btn-forgot').addEventListener('click', async () => {
    const email = form.email.value.trim();
    if (!email) return showErr('Escribe tu correo arriba y vuelve a pulsar “¿Olvidaste tu contraseña?”.');
    try {
      await ensureCloud();
      await db.auth.resetPassword(email);
      showOk('Te enviamos un enlace para restablecer tu contraseña.');
    } catch (err) { showErr(err.message); }
  });

  root.querySelector('#btn-demo').addEventListener('click', async () => {
    db.setPreferredMode('demo');
    await db.initDb('demo');
    startApp(await db.auth.member());
  });
}

function renderNoAccess(email = '') {
  teardown();
  root.innerHTML = `
  <div class="center-screen">
    <div class="auth-card">
      <span class="auth-logo warn">${icon('lock', 30)}</span>
      <h2>Tu cuenta aún no tiene acceso</h2>
      ${email ? `<p class="muted" style="margin-bottom:8px;">Sesión iniciada como: <strong>${esc(email)}</strong></p>` : ''}
      <p class="muted">Pide a Freddy o a Priscila que autoricen este correo. Cuando lo hagan, pulsa reintentar.</p>
      <button class="btn btn-primary btn-block" id="btn-retry" style="margin-top:14px;">${icon('refresh', 16)} Ya me autorizaron, reintentar</button>
      <button class="btn btn-ghost btn-block" id="btn-out">${icon('logout', 16)} Cerrar sesión</button>
    </div>
  </div>`;
  root.querySelector('#btn-retry').addEventListener('click', afterLogin);
  root.querySelector('#btn-out').addEventListener('click', async () => { await db.auth.signOut(); renderLogin(); });
}

function promptNewPassword() {
  openModal({
    title: 'Nueva contraseña',
    submitLabel: 'Actualizar',
    body: `<label class="field"><span>Escribe tu nueva contraseña</span><input type="password" name="password" minlength="6" required autocomplete="new-password"></label>`,
    onSubmit: async (fd) => {
      const pw = String(fd.get('password') || '');
      if (pw.length < 6) throw new Error('Mínimo 6 caracteres.');
      await db.auth.updatePassword(pw);
      toast('Contraseña actualizada ✔');
    },
  });
}

/* =================== App =================== */
function startApp(member) {
  teardown();
  const mode = db.getMode();
  ctx = { member, isAdmin: member?.role === 'admin', mode };
  const name = member?.display_name || member?.email || 'Usuario';

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
        <button class="icon-btn" id="btn-logout" title="${mode === 'demo' ? 'Salir del modo demo' : 'Cerrar sesión'}">${icon('logout', 18)}</button>
      </div>
    </header>
    <nav class="modnav" aria-label="Módulos">
      <div class="modnav-inner">
        ${ROUTES.map((r) => `<a class="modnav-item" href="#/${r.key}" data-key="${r.key}">
          ${icon(r.icon, 24)}<span>${esc(r.label)}</span>${r.phase ? '<i class="soon-dot" title="Próximamente"></i>' : ''}</a>`).join('')}
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
    if (mode === 'demo') {
      db.setPreferredMode('cloud');
      renderLogin();
    } else {
      await db.auth.signOut();
      renderLogin();
    }
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
      <p class="muted">Si es la primera vez, revisa que hayas ejecutado <code>supabase/schema.sql</code> y <code>supabase/seed.sql</code>.</p></div></div>`;
  }
}

function teardown() {
  if (cleanup) { cleanup(); cleanup = null; }
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  window.removeEventListener('hashchange', onHash);
  currentKey = null;
}

boot();
