// Módulo "Web de boda": gestión y vista previa de la página pública para los invitados.
import * as db from '../db.js';
import { PUBLIC_SITE_URL } from '../config.js';
import { esc, toast, fmtDate } from '../ui.js';
import { icon } from '../icons.js';

export async function renderWebBoda(el) {
  const [wedding, guests] = await Promise.all([
    db.getWedding(),
    db.list('guests', { order: 'full_name' }),
  ]);

  const demoParam = db.getMode() === 'demo' ? '?demo=1' : '';
  const isLocalApp = Boolean(window.Capacitor) || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const baseBoda = (db.getMode() === 'cloud' && isLocalApp)
    ? `${PUBLIC_SITE_URL}boda/`
    : new URL('boda/', location.href).href;
  const publicUrl = `${baseBoda}${demoParam}`;
  const sampleGuest = guests[0];
  const sampleUrl = sampleGuest
    ? `${baseBoda}?code=${encodeURIComponent(sampleGuest.rsvp_code)}${db.getMode() === 'demo' ? '&demo=1' : ''}`
    : publicUrl;

  const missingInfo = [];
  if (!wedding.kingdom_hall) missingInfo.push('Salón del Reino');
  if (!wedding.reception_venue) missingInfo.push('Local de recepción');
  if (!wedding.time_confirmed) missingInfo.push('Confirmación de hora');

  el.innerHTML = `
  <header class="page-head">
    <div>
      <span class="eyebrow">${icon('globe', 14)} Invitación digital y RSVP</span>
      <h1>Web Pública de la Boda</h1>
      <p>Esta es la página elegante que verán tus <strong>${wedding.guest_target || 150} invitados</strong> en su celular para conocer los detalles y confirmar su asistencia con su código personal.</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-outline" id="btn-copy-pub">${icon('copy', 16)} Copiar enlace general</button>
      <a class="btn btn-primary" href="${esc(sampleUrl)}" target="_blank" rel="noopener">${icon('external', 16)} Abrir web pública</a>
    </div>
  </header>

  ${missingInfo.length ? `<div class="notice-banner">
    ${icon('alert', 18)}
    <div><strong>Datos por completar antes de enviar invitaciones:</strong> ${esc(missingInfo.join(', '))}.
    Puedes actualizarlos en <a href="#/panel" class="link">Mi boda → Editar datos de la boda</a>.</div>
  </div>` : ''}

  <div class="grid-2">
    <section class="card">
      <header class="card-head">
        <h2>${icon('link', 18)} Enlaces para compartir</h2>
      </header>
      <div class="link-box">
        <label class="field"><span>Enlace general de la boda</span>
          <div class="input-copy">
            <input readonly value="${esc(publicUrl)}" id="inp-pub-url">
            <button class="btn btn-outline" id="btn-copy-1">${icon('copy', 15)} Copiar</button>
          </div>
        </label>
        ${sampleGuest ? `<label class="field"><span>Ejemplo con código personal (${esc(sampleGuest.full_name)})</span>
          <div class="input-copy">
            <input readonly value="${esc(sampleUrl)}" id="inp-sample-url">
            <button class="btn btn-outline" id="btn-copy-2">${icon('copy', 15)} Copiar</button>
          </div>
        </label>` : ''}
      </div>
      <div class="info-list">
        <p><strong>¿Cómo funciona la confirmación (RSVP)?</strong></p>
        <ul>
          <li>${icon('check', 15)} Cada invitado en el módulo <a class="link" href="#/invitados">Invitados</a> tiene un código único automático.</li>
          <li>${icon('check', 15)} Al enviarle su invitación por WhatsApp, recibe su enlace personal que ya lo saluda por su nombre y muestra sus cupos exactos.</li>
          <li>${icon('check', 15)} Su respuesta se guarda al instante y se actualiza en tu panel sin exponer la lista de otros invitados.</li>
        </ul>
      </div>
    </section>

    <section class="card">
      <header class="card-head">
        <h2>${icon('device', 18)} Vista rápida de portada</h2>
        <span class="pill pill-stage">Verde Salvia &amp; Beige</span>
      </header>
      <div class="mini-invite">
        <span class="mini-tag">Nos casamos · 1 Cor. 14:40</span>
        <h3>${esc(wedding.couple_names || 'Freddy & Priscila')}</h3>
        <p class="mini-date">${wedding.wedding_date ? fmtDate(wedding.wedding_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '26 de febrero de 2027'}</p>
        <div class="mini-rows">
          <div><strong>Salón del Reino:</strong> ${esc(wedding.kingdom_hall || 'Por confirmar')}</div>
          <div><strong>Recepción:</strong> ${esc(wedding.reception_venue || 'Por confirmar')}</div>
          <div><strong>Vestimenta:</strong> ${esc(wedding.dress_colors || 'Verde salvia y beige')}</div>
        </div>
        <a class="btn btn-primary btn-block" href="${esc(sampleUrl)}" target="_blank" rel="noopener">${icon('external', 15)} Probar vista completa y RSVP</a>
      </div>
    </section>
  </div>`;

  const copy = async (txt) => {
    try { await navigator.clipboard.writeText(txt); toast('Enlace copiado ✔'); }
    catch { prompt('Copia el enlace:', txt); }
  };
  el.querySelector('#btn-copy-pub').addEventListener('click', () => copy(publicUrl));
  el.querySelector('#btn-copy-1').addEventListener('click', () => copy(publicUrl));
  el.querySelector('#btn-copy-2')?.addEventListener('click', () => copy(sampleUrl));
}
