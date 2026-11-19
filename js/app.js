// Punto de entrada: arranque, acceso en vivo (Nombre + Teléfono), presencia online,
// aprobación de solicitudes en 1 clic, navegación nativa móvil y enrutador.
import * as db from './db.js';
import { esc, toast, celebrate } from './ui.js';
import { icon } from './icons.js';
import { ROUTES, renderComingSoon } from './modules/registry.js';

const root = document.getElementById('app');
let ctx = null;
let cleanup = null;
let unsubscribe = null;
let unsubPresence = null;
let unsubWait = null;
let currentKey = null;
let deferredInstall = null;
let pendingList = [];
let knownPendingPhones = new Set();

window.addEventListener('beforeinstallprompt', (e) => {
  if (window.Capacitor) return;
  e.preventDefault();
  deferredInstall = e;
  const b = document.getElementById('btn-install');
  if (b) b.hidden = false;
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

/* =================== Pantalla de Bienvenida Animada =================== */
function showWelcomeIntro() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'welcome-screen';
    overlay.innerHTML = `
      <div class="welcome-particles" aria-hidden="true">
        <i></i><i></i><i></i><i></i><i></i><i></i><i></i>
      </div>
      <div class="welcome-emblem">
        <span class="welcome-halo"></span>
        <span class="welcome-orbit"></span>
        <span class="welcome-badge">${icon('rings', 48)}</span>
      </div>
      <div class="welcome-kicker">Bienvenidos a nuestra boda</div>
      <h1 class="welcome-names">Freddy <span>&amp;</span> Priscila</h1>
      <p class="welcome-date">26 · Febrero · 2027</p>
      <p class="welcome-verse">“Una boda que honra a Jehová” · 1 Cor. 14:40</p>
      <div class="welcome-bar"><span></span></div>
      <p class="welcome-tap">Toca para entrar</p>`;
    document.body.appendChild(overlay);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      overlay.classList.add('leaving');
      setTimeout(() => { overlay.remove(); resolve(); }, 460);
    };
    overlay.addEventListener('click', finish);
    setTimeout(finish, 2100);
  });
}

/* =================== Arranque =================== */
async function boot() {
  const introPromise = showWelcomeIntro();
  let initErr = null;
  let member = null;

  try {
    await db.initDb();
    if (db.getMode() === 'demo') member = db.auth.saved();
    else member = await db.auth.verifySaved();
  } catch (e) {
    initErr = e.message;
  }

  await introPromise;
  if (initErr) return renderLogin(initErr);
  if (!member) return renderLogin();
  startApp(member);
}

/* =================== Acceso (Solo Nombre + Teléfono) =================== */
function renderLogin(errorMsg = '') {
  teardown();
  root.innerHTML = `
  <div class="auth fade-in">
    <section class="auth-hero">
      <div class="auth-deco" aria-hidden="true">${icon('leaf', 260)}</div>
      <span class="eyebrow light">${icon('heart', 14)} Organizador de boda</span>
      <h1>Freddy <span>&amp;</span> Priscila</h1>
      <p class="auth-date">Viernes 26 · Febrero · 2027</p>
      <blockquote>“Háganlo todo de forma digna y ordenada”<cite>— 1 Corintios 14:40</cite></blockquote>
      <ul class="auth-feats">
        <li>${icon('book', 18)} Organización basada en principios bíblicos</li>
        <li>${icon('clipboard', 18)} Tareas, 150 invitados, mesas y presupuesto</li>
        <li>${icon('cloud', 18)} Sincronizado en tiempo real entre los dos</li>
      </ul>
    </section>
    <section class="auth-panel">
      <div class="auth-card">
        <span class="auth-logo">${icon('rings', 30)}</span>
        <h2>Bienvenidos</h2>
        <p class="muted" style="margin-bottom:18px;">Ingresa solo con tu nombre y teléfono (sin correo ni contraseña).</p>
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
        <p class="fine">Si aún no estás autorizado, tu solicitud llegará al instante a Freddy para aprobarte con un toque.</p>
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
      const res = await db.auth.login(name, phone);
      if (res.status === 'ok') {
        toast(`¡Bienvenid@, ${res.member.display_name}! 💍`);
        startApp(res.member);
      } else {
        renderPendingWait(res.name, res.phone);
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

/* =================== Espera en vivo hasta aprobación 1-clic =================== */
function renderPendingWait(name, phone) {
  teardown();
  const prettyPhone = db.formatPhone(phone);
  root.innerHTML = `
  <div class="center-screen fade-in">
    <div class="auth-card wait-card">
      <div class="wait-pulse">
        <span class="wait-ring"></span>
        <span class="auth-logo">${icon('clock', 30)}</span>
      </div>
      <h2>Solicitud enviada en vivo</h2>
      <p class="wait-who"><strong>${esc(name)}</strong> · ${esc(prettyPhone)}</p>
      <p class="muted">Acabamos de avisar a Freddy en su pantalla. En cuanto toque <strong>“Aprobar”</strong>, entrarás automáticamente aquí sin tener que hacer nada más.</p>
      <div class="wait-live-pill"><span class="live-dot"></span> Escuchando aprobación en tiempo real…</div>
      <button class="btn btn-outline btn-block" id="btn-check-now" style="margin-top:16px;">${icon('refresh', 15)} Comprobar ahora</button>
      <button class="btn btn-ghost btn-block" id="btn-back">${icon('arrow', 15)} Cambiar número</button>
    </div>
  </div>`;

  unsubWait = db.auth.watchApproval(phone, {
    onApproved: (member) => {
      toast(`¡Acceso aprobado! Bienvenid@, ${member.display_name} 💍`);
      startApp(member);
    },
    onRejected: () => {
      renderLogin('Tu solicitud no fue aprobada. Si fue un error, vuelve a intentarlo.');
    },
  });

  root.querySelector('#btn-check-now').addEventListener('click', async () => {
    try {
      const res = await db.auth.login(name, phone);
      if (res.status === 'ok') {
        toast(`¡Acceso aprobado! Bienvenid@, ${res.member.display_name} 💍`);
        startApp(res.member);
      } else {
        toast('Aún esperando aprobación de Freddy…');
      }
    } catch (e) { toast(e.message, 'error'); }
  });

  root.querySelector('#btn-back').addEventListener('click', () => renderLogin());
}

/* =================== App Principal =================== */
function startApp(member) {
  teardown();
  const mode = db.getMode();
  ctx = { member, isAdmin: member?.role === 'admin', mode };
  const name = member?.display_name || db.formatPhone(member?.phone) || 'Usuario';

  const PRIMARY_MOBILE = ['panel', 'tareas', 'invitados', 'mesas'];
  const MORE_MOBILE = ROUTES.filter((r) => !PRIMARY_MOBILE.includes(r.key));

  root.innerHTML = `
  <div class="app">
    <header class="topbar">
      <a class="brand" href="#/panel">
        <span class="brand-mark">${icon('rings', 22)}</span>
        <span class="brand-text"><strong>Freddy &amp; Priscila</strong><small>Una boda que honra a Jehová</small></span>
      </a>
      <div class="topbar-right">
        <button class="live-pill" id="btn-live-center" title="Ver conectados ahora y solicitudes de acceso">
          <span class="live-dot"></span>
          <span id="live-count">1</span><span class="live-txt"> en línea</span>
        </button>
        ${ctx.isAdmin ? `<button class="icon-btn bell-btn" id="btn-bell" title="Solicitudes de acceso">
          ${icon('bell', 18)}
          <span class="bell-badge" id="bell-badge" hidden>0</span>
        </button>` : ''}
        <button class="chip-btn" id="btn-install" ${deferredInstall ? '' : 'hidden'} title="Instalar app">${icon('install', 14)} Instalar</button>
        <span class="mode-badge mode-${mode}" title="${mode === 'cloud' ? 'Sincronizado en tiempo real con Supabase' : 'Modo demo local'}">
          ${icon(mode === 'cloud' ? 'cloud' : 'device', 14)} <span>${mode === 'cloud' ? 'En la nube' : 'Demo'}</span>
        </span>
        ${mode === 'demo' ? `<button class="icon-btn" id="btn-reset" title="Reiniciar datos demo">${icon('refresh', 18)}</button>` : ''}
        <div class="user-chip">
          <span class="avatar">${esc(name.trim().charAt(0).toUpperCase())}</span>
          <span class="user-meta"><strong>${esc(name)}</strong><small>${ctx.isAdmin ? 'Admin' : 'Ayudante'}</small></span>
        </div>
        <button class="icon-btn" id="btn-logout" title="Salir">${icon('logout', 18)}</button>
      </div>
    </header>

    <div id="live-request-bar" class="request-banner-wrap"></div>

    <nav class="modnav" aria-label="Módulos">
      <div class="modnav-inner">
        ${ROUTES.map((r) => `<a class="modnav-item" href="#/${r.key}" data-key="${r.key}">
          ${icon(r.icon, 23)}<span>${esc(r.label)}</span></a>`).join('')}
      </div>
    </nav>

    <main id="view" class="view" tabindex="-1"></main>

    <footer class="app-foot">“Ya sea que coman o beban o hagan cualquier otra cosa, háganlo todo para la gloria de Dios.” — 1 Corintios 10:31</footer>

    <!-- Barra inferior nativa para celulares / APK Android -->
    <nav class="bottom-nav" aria-label="Navegación móvil">
      ${PRIMARY_MOBILE.map((k) => {
        const r = ROUTES.find((x) => x.key === k);
        return `<a class="bnav-item" href="#/${r.key}" data-key="${r.key}">${icon(r.icon, 21)}<span>${esc(r.label)}</span></a>`;
      }).join('')}
      <button type="button" class="bnav-item" id="btn-more-sheet">${icon('grid', 21)}<span>Más</span></button>
    </nav>

    <div class="sheet-backdrop" id="more-sheet" hidden>
      <div class="sheet">
        <div class="sheet-handle"></div>
        <header class="sheet-head">
          <h3>Más módulos</h3>
          <button type="button" class="icon-btn" id="btn-close-sheet">${icon('x', 18)}</button>
        </header>
        <div class="sheet-grid">
          ${MORE_MOBILE.map((r) => `<a class="sheet-tile" href="#/${r.key}" data-key="${r.key}">
            <span class="sheet-ico">${icon(r.icon, 22)}</span>
            <strong>${esc(r.label)}</strong>
          </a>`).join('')}
        </div>
      </div>
    </div>
  </div>`;

  // Presencia en tiempo real
  db.presence.start(member, 'Mi boda');
  unsubPresence = db.presence.onChange(updateLiveUi);
  updateLiveUi(db.presence.getOnline());

  // Revisar solicitudes pendientes al iniciar (solo Admin)
  if (ctx.isAdmin) refreshPendingRequests(true);

  // Abrir Centro de Conectados y Solicitudes
  root.querySelector('#btn-live-center').addEventListener('click', () => openLiveCenterModal());
  root.querySelector('#btn-bell')?.addEventListener('click', () => openLiveCenterModal('pending'));

  // Bottom sheet móvil
  const sheet = root.querySelector('#more-sheet');
  const openSheet = () => { sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add('open')); };
  const closeSheet = () => { sheet.classList.remove('open'); setTimeout(() => { sheet.hidden = true; }, 220); };
  root.querySelector('#btn-more-sheet').addEventListener('click', openSheet);
  root.querySelector('#btn-close-sheet').addEventListener('click', closeSheet);
  sheet.addEventListener('click', (e) => { if (e.target === sheet || e.target.closest('.sheet-tile')) closeSheet(); });

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
    if (confirm('¿Reiniciar los datos de demostración?')) {
      db.resetDemo();
      toast('Datos demo reiniciados');
    }
  });

  let pendingTimer = null;
  unsubscribe = db.subscribe((table) => {
    if (ctx.isAdmin && (table === 'allowed_phones' || table === '*')) {
      refreshPendingRequests(false);
    }
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      if (!document.querySelector('.modal-backdrop')) renderRoute(true);
    }, 250);
  });

  window.addEventListener('hashchange', onHash);
  renderRoute();
}

function updateLiveUi(online) {
  const lbl = document.getElementById('live-count');
  if (lbl) lbl.textContent = String(Math.max(1, online.length));
}

async function refreshPendingRequests(isInitial) {
  try {
    const all = await db.list('allowed_phones');
    pendingList = all.filter(db.isPendingAccess);
    const badge = document.getElementById('bell-badge');
    if (badge) {
      badge.textContent = String(pendingList.length);
      badge.hidden = pendingList.length === 0;
    }
    if (!isInitial) {
      pendingList.forEach((p) => {
        if (!knownPendingPhones.has(p.phone)) {
          toast(`🔔 ${p.display_name} (${db.formatPhone(p.phone)}) solicita acceso`);
        }
      });
    }
    knownPendingPhones = new Set(pendingList.map((p) => p.phone));
    paintPendingBanner();
  } catch { /* noop */ }
}

function paintPendingBanner() {
  const wrap = document.getElementById('live-request-bar');
  if (!wrap || !ctx?.isAdmin) return;
  if (!pendingList.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = pendingList.map((p) => `
    <div class="request-banner fade-in">
      <div class="req-info">
        <span class="req-pulse">${icon('bell', 16)}</span>
        <div>
          <strong>${esc(p.display_name)}</strong> (${esc(db.formatPhone(p.phone))}) está esperando aprobación para entrar ahora mismo.
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary btn-xs" data-quick-approve="${esc(p.phone)}" data-name="${esc(p.display_name)}" data-role="admin">✔ Aprobar Admin</button>
        <button class="btn btn-outline btn-xs" data-quick-approve="${esc(p.phone)}" data-name="${esc(p.display_name)}" data-role="helper">✔ Ayudante</button>
        <button class="icon-btn icon-danger" data-quick-reject="${esc(p.phone)}" title="Rechazar">${icon('x', 16)}</button>
      </div>
    </div>`).join('');

  wrap.querySelectorAll('[data-quick-approve]').forEach((b) => {
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await db.approvePendingPhone(b.dataset.quickApprove, b.dataset.name, b.dataset.role);
        celebrate();
        toast(`¡${b.dataset.name} aprobada como ${b.dataset.role === 'admin' ? 'Admin' : 'Ayudante'}! 🎉`);
        await refreshPendingRequests(true);
      } catch (e) { toast(e.message, 'error'); b.disabled = false; }
    });
  });

  wrap.querySelectorAll('[data-quick-reject]').forEach((b) => {
    b.addEventListener('click', async () => {
      try {
        await db.removeAllowedPhone(b.dataset.quickReject);
        toast('Solicitud rechazada');
        await refreshPendingRequests(true);
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

async function openLiveCenterModal() {
  const all = await db.list('allowed_phones', { order: 'display_name' }).catch(() => []);
  const pending = all.filter(db.isPendingAccess);
  const authorized = all.filter((x) => !db.isPendingAccess(x));
  const online = db.presence.getOnline();
  const onlinePhones = new Set(online.map((o) => o.phone));

  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
  <div class="modal modal-wide">
    <header class="modal-head">
      <h3>${icon('users', 18)} Conectados en Vivo y Accesos</h3>
      <button type="button" class="icon-btn" data-close>${icon('x', 18)}</button>
    </header>
    <div class="modal-body live-modal-body">
      ${ctx.isAdmin && pending.length ? `
      <div class="live-section">
        <h4 class="live-sec-title warn">${icon('bell', 15)} Solicitudes pendientes (${pending.length})</h4>
        <ul class="team-list">
          ${pending.map((p) => `<li class="team-row req-row">
            <div class="team-info">
              <strong>${esc(p.display_name)}</strong>
              <small class="muted">${esc(db.formatPhone(p.phone))} · Esperando aprobación en vivo</small>
            </div>
            <div class="btn-row">
              <button class="btn btn-primary btn-xs" data-m-app="${esc(p.phone)}" data-name="${esc(p.display_name)}" data-role="admin">✔ Admin</button>
              <button class="btn btn-outline btn-xs" data-m-app="${esc(p.phone)}" data-name="${esc(p.display_name)}" data-role="helper">✔ Ayudante</button>
              <button class="icon-btn icon-danger" data-m-rej="${esc(p.phone)}" title="Rechazar">${icon('trash', 14)}</button>
            </div>
          </li>`).join('')}
        </ul>
      </div>` : ''}

      <div class="live-section">
        <h4 class="live-sec-title"><span class="live-dot"></span> Conectados ahora (${online.length})</h4>
        <ul class="team-list">
          ${online.map((o) => `<li class="team-row">
            <span class="avatar sm">${esc(o.name.charAt(0).toUpperCase())}</span>
            <div class="team-info">
              <strong>${esc(o.name)} ${o.phone === ctx.member?.phone ? '<small class="muted">(Tú)</small>' : ''}</strong>
              <small class="muted">${o.device === 'Celular' ? '📱 Celular' : '💻 PC'} · Viendo: <strong>${esc(o.route || 'Mi boda')}</strong></small>
            </div>
            <span class="pill ${o.role === 'admin' ? 'pill-stage' : 'pill-verse'}">${o.role === 'admin' ? 'Admin' : 'Ayudante'}</span>
          </li>`).join('')}
        </ul>
      </div>

      <div class="live-section">
        <h4 class="live-sec-title">${icon('shield', 15)} Todos los autorizados (${authorized.length})</h4>
        <ul class="team-list">
          ${authorized.map((a) => `<li class="team-row">
            <span class="status-dot ${onlinePhones.has(a.phone) ? 'is-on' : ''}"></span>
            <div class="team-info">
              <strong>${esc(a.display_name)}</strong>
              <small class="muted">${esc(db.formatPhone(a.phone))}${a.area ? ` · ${esc(a.area)}` : ''}</small>
            </div>
            <span class="pill ${a.role === 'admin' ? 'pill-stage' : 'pill-verse'}">${a.role === 'admin' ? 'Admin' : 'Ayudante'}</span>
          </li>`).join('')}
        </ul>
      </div>
    </div>
    <footer class="modal-foot">
      <a href="#/equipo" class="btn btn-outline" data-close>Gestionar en Equipo</a>
      <button type="button" class="btn btn-primary" data-close>Cerrar</button>
    </footer>
  </div>`;

  document.body.appendChild(back);
  const close = () => { back.classList.remove('open'); setTimeout(() => back.remove(), 200); };
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });

  back.querySelectorAll('[data-m-app]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await db.approvePendingPhone(b.dataset.mApp, b.dataset.name, b.dataset.role);
      toast(`¡${b.dataset.name} aprobada como ${b.dataset.role === 'admin' ? 'Admin' : 'Ayudante'}! 🎉`);
      await refreshPendingRequests(true);
      close();
    } catch (e) { toast(e.message, 'error'); }
  }));

  back.querySelectorAll('[data-m-rej]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await db.removeAllowedPhone(b.dataset.mRej);
      toast('Solicitud eliminada');
      await refreshPendingRequests(true);
      close();
    } catch (e) { toast(e.message, 'error'); }
  }));

  requestAnimationFrame(() => back.classList.add('open'));
}

function onHash() { renderRoute(); }

async function renderRoute(isRefresh = false) {
  const view = document.getElementById('view');
  if (!view) return;
  const key = (location.hash.replace(/^#\/?/, '') || 'panel').split(/[?/]/)[0];
  const route = ROUTES.find((r) => r.key === key) || ROUTES[0];

  document.querySelectorAll('.modnav-item, .bnav-item[data-key], .sheet-tile').forEach((a) =>
    a.classList.toggle('active', a.dataset.key === route.key));
  document.title = `${route.label} · Boda Freddy & Priscila`;
  db.presence.setRoute(route.label);

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
    view.innerHTML = `<div class="error-box">${icon('alert', 22)}<div><strong>No se pudieron cargar los datos.</strong><p>${esc(e.message)}</p></div></div>`;
  }
}

function teardown() {
  if (cleanup) { cleanup(); cleanup = null; }
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (unsubPresence) { unsubPresence(); unsubPresence = null; }
  if (unsubWait) { unsubWait(); unsubWait = null; }
  db.presence.stop();
  window.removeEventListener('hashchange', onHash);
  currentKey = null;
}

boot();
