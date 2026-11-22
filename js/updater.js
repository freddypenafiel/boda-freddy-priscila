// Comprobador de actualizaciones automáticas (OTA) para APK Android y Web/PWA.
// Solo notifica cuando existe una versión más reciente publicada en version.json.
import { APP_VERSION, APP_VERSION_CODE, UPDATE_CHECK_URL, APK_DOWNLOAD_URL } from './config.js';
import { esc, toast } from './ui.js';
import { icon } from './icons.js';

let cachedRemote = null;

function isNewer(remote) {
  if (!remote) return false;
  const rCode = Number(remote.versionCode || 0);
  if (rCode > 0) return rCode > APP_VERSION_CODE;
  const toNums = (v) => String(v || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const a = toNums(APP_VERSION);
  const b = toNums(remote.version);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((b[i] || 0) !== (a[i] || 0)) return (b[i] || 0) > (a[i] || 0);
  }
  return false;
}

export function getCachedUpdate() {
  return cachedRemote && isNewer(cachedRemote) ? cachedRemote : null;
}

/**
 * Consulta version.json en GitHub Pages sin caché.
 * - silent: true  → al iniciar la app; no molesta si ya está actualizada o sin internet.
 * - silent: false → cuando el usuario toca "Buscar actualizaciones" manualmente.
 */
export async function checkForAppUpdate({ silent = true } = {}) {
  try {
    const res = await fetch(`${UPDATE_CHECK_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remote = await res.json();
    cachedRemote = remote;

    if (isNewer(remote)) {
      const dismissKey = `fp_dismiss_upd_${remote.versionCode || remote.version}`;
      if (!silent) {
        sessionStorage.removeItem(dismissKey);
        paintUpdateBanner(remote);
        openUpdateModal(remote);
      } else if (!sessionStorage.getItem(dismissKey)) {
        paintUpdateBanner(remote);
      }
      return { hasUpdate: true, remote };
    }

    clearUpdateBanner();
    if (!silent) toast(`✔ Ya tienes la última versión instalada (v${APP_VERSION})`);
    return { hasUpdate: false, remote };
  } catch (e) {
    if (!silent) toast('No se pudo comprobar actualizaciones. Revisa tu conexión.', 'error');
    return { hasUpdate: false, error: e.message };
  }
}

function clearUpdateBanner() {
  const wrap = document.getElementById('update-banner-wrap');
  if (wrap) wrap.innerHTML = '';
}

export function paintUpdateBanner(remote) {
  const wrap = document.getElementById('update-banner-wrap');
  if (!wrap || !remote) return;
  const isApk = Boolean(window.Capacitor);
  const dismissKey = `fp_dismiss_upd_${remote.versionCode || remote.version}`;
  const downloadUrl = remote.apkUrl || APK_DOWNLOAD_URL;

  wrap.innerHTML = `
    <div class="update-banner fade-in">
      <div class="upd-info">
        <span class="upd-badge">${icon('sparkle', 16)}</span>
        <div>
          <strong>Nueva versión disponible (v${esc(remote.version)})</strong>
          <small>${esc(remote.title || 'Mejoras y novedades listas para tu app')}</small>
        </div>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-outline btn-xs" id="btn-upd-details">Ver novedades</button>
        ${isApk
          ? `<a class="btn btn-primary btn-xs" href="${esc(downloadUrl)}" target="_blank" rel="noopener">${icon('download', 13)} Actualizar</a>`
          : `<button type="button" class="btn btn-primary btn-xs" id="btn-upd-web">${icon('refresh', 13)} Actualizar</button>`}
        <button type="button" class="icon-btn" id="btn-upd-dismiss" title="Más tarde">${icon('x', 15)}</button>
      </div>
    </div>`;

  wrap.querySelector('#btn-upd-details')?.addEventListener('click', () => openUpdateModal(remote));
  wrap.querySelector('#btn-upd-web')?.addEventListener('click', () => applyWebUpdate());
  wrap.querySelector('#btn-upd-dismiss')?.addEventListener('click', () => {
    sessionStorage.setItem(dismissKey, '1');
    clearUpdateBanner();
  });
}

export function openUpdateModal(remote) {
  const isApk = Boolean(window.Capacitor);
  const downloadUrl = remote.apkUrl || APK_DOWNLOAD_URL;
  const notes = Array.isArray(remote.notes) ? remote.notes : [];

  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal">
      <header class="modal-head">
        <h3>${icon('sparkle', 18)} Actualización disponible · v${esc(remote.version)}</h3>
        <button type="button" class="icon-btn" data-close>${icon('x', 18)}</button>
      </header>
      <div class="modal-body">
        <div class="upd-modal-hero">
          <span class="pill pill-stage">Tu versión: v${esc(APP_VERSION)}</span>
          <span class="muted">→</span>
          <span class="pill pill-ok">Nueva: v${esc(remote.version)}</span>
        </div>
        ${remote.title ? `<p style="font-weight:700;color:var(--sage-900);margin:10px 0 8px;">${esc(remote.title)}</p>` : ''}
        ${notes.length ? `<ul class="upd-notes">
          ${notes.map((n) => `<li>${icon('check', 14)}<span>${esc(n)}</span></li>`).join('')}
        </ul>` : ''}
        <p class="fine" style="text-align:left;margin-top:12px;">
          ${isApk
            ? 'Al tocar “Descargar actualización” se descargará el nuevo APK en tu navegador. Cuando termine, tócalo y elige <strong>Actualizar</strong>. Todos tus datos están seguros en la nube.'
            : 'Al tocar “Actualizar ahora” se refrescará la aplicación con las últimas mejoras sin perder ningún dato.'}
        </p>
      </div>
      <footer class="modal-foot">
        <button type="button" class="btn btn-ghost" data-close>Más tarde</button>
        ${isApk
          ? `<a class="btn btn-primary" href="${esc(downloadUrl)}" target="_blank" rel="noopener">${icon('download', 15)} Descargar actualización</a>`
          : `<button type="button" class="btn btn-primary" id="btn-modal-web-upd">${icon('refresh', 15)} Actualizar ahora</button>`}
      </footer>
    </div>`;

  document.body.appendChild(back);
  const close = () => { back.classList.remove('open'); setTimeout(() => back.remove(), 200); };
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
  back.querySelector('#btn-modal-web-upd')?.addEventListener('click', () => applyWebUpdate());
  requestAnimationFrame(() => back.classList.add('open'));
}

async function applyWebUpdate() {
  toast('Actualizando aplicación…');
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => {})));
    }
  } catch { /* noop */ }
  location.reload();
}
