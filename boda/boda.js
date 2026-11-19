// Web pública de la boda para los invitados (con RSVP seguro por código).
import * as db from '../js/db.js';
import { esc, fmtDate, fmtTime } from '../js/ui.js';

const root = document.getElementById('invite-app');
const params = new URLSearchParams(location.search);
let currentCode = (params.get('code') || '').trim();

async function init() {
  root.innerHTML = `<div style="padding:60px;text-align:center;color:#4A6B53;">Cargando invitación…</div>`;
  try {
    const forceDemo = params.get('demo') === '1';
    await db.initDb(forceDemo ? 'demo' : 'cloud');
  } catch {
    await db.initDb('demo');
  }
  const wedding = await db.publicGetWedding();
  const inv = currentCode ? await db.publicGetInvitation(currentCode) : null;
  render(wedding, inv);
}

function mapsLink(q) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function render(w, inv) {
  const dateTxt = w.wedding_date
    ? fmtDate(w.wedding_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Viernes 26 de febrero de 2027';
  const timeTxt = w.wedding_date ? `${fmtTime(w.wedding_date)} hrs${w.time_confirmed ? '' : ' (por confirmar)'}` : 'Por confirmar';

  root.innerHTML = `
  <header class="pub-hero">
    <span class="pub-eyebrow">🌿 Nos casamos</span>
    <h1>${esc(w.couple_names || 'Freddy & Priscila')}</h1>
    <p class="pub-date">${esc(dateTxt)} · ${esc(timeTxt)}</p>
    <blockquote class="pub-quote">
      “Ya sea que coman o beban o hagan cualquier otra cosa, háganlo todo para la gloria de Dios.”
      <cite>— 1 Corintios 10:31</cite>
    </blockquote>
    <div class="pub-cd" id="pub-cd" data-date="${esc(w.wedding_date || '2027-02-26T15:00:00-05:00')}">
      <div><strong data-i="0">--</strong><span>Días</span></div>
      <div><strong data-i="1">--</strong><span>Horas</span></div>
      <div><strong data-i="2">--</strong><span>Min</span></div>
      <div><strong data-i="3">--</strong><span>Seg</span></div>
    </div>
  </header>

  <main class="pub-wrap">
    <div class="pub-grid">
      <section class="pub-card">
        <h2>🏛️ Discurso de Boda</h2>
        <p><strong>${esc(w.kingdom_hall || 'Salón del Reino (por confirmar)')}</strong></p>
        <p>${esc(w.kingdom_hall_address || w.city || 'Azogues, Cañar')}</p>
        <p>Hora prevista: <strong>${esc(timeTxt)}</strong>. Agradecemos llegar unos minutos antes con puntualidad.</p>
        ${w.kingdom_hall_address ? `<a class="map-btn" href="${mapsLink(w.kingdom_hall_address)}" target="_blank" rel="noopener">Ver ubicación en Google Maps →</a>` : ''}
      </section>

      <section class="pub-card">
        <h2>🍽️ Recepción</h2>
        <p><strong>${esc(w.reception_venue || 'Local de recepción (por confirmar)')}</strong></p>
        <p>${esc(w.reception_address || w.city || 'Azogues, Cañar')}</p>
        <p>Al terminar el discurso nos reuniremos para compartir una cena alegre, ordenada y edificante.</p>
        ${w.reception_address ? `<a class="map-btn" href="${mapsLink(w.reception_address)}" target="_blank" rel="noopener">Ver ubicación en Google Maps →</a>` : ''}
      </section>
    </div>

    <div class="pub-grid">
      <section class="pub-card">
        <h2>👗 Código de Vestimenta</h2>
        <p>Elegante, digno y modesto (<em>1 Timoteo 2:9</em>). Nuestra paleta de la boda es <strong>${esc(w.dress_colors || 'Verde salvia y beige')}</strong>.</p>
        <div class="swatches">
          <span class="sw"><i style="background:#5E7E65"></i>Verde salvia</span>
          <span class="sw"><i style="background:#E6DEC8"></i>Beige / Arena</span>
          <span class="sw"><i style="background:#FFFFFF"></i>Blanco (reservado para la novia)</span>
        </div>
      </section>

      <section class="pub-card">
        <h2>🕊️ Una Boda que Honra a Jehová</h2>
        <p>Para nosotros es muy importante que este día refleje paz, orden y gratitud a Dios. Por respeto a los principios bíblicos, no arrojamos arroz ni confeti a la salida ni realizamos lanzamiento de ramo o liga.</p>
        <p>¡Tu presencia y tu cariño son el mejor regalo para nosotros!</p>
      </section>
    </div>

    <section class="pub-card rsvp-card" id="rsvp-box">
      <h2>💌 Confirma tu Asistencia (RSVP)</h2>
      <div id="rsvp-inner"></div>
    </section>
  </main>

  <footer class="pub-foot">
    Con todo nuestro cariño · ${esc(w.couple_names || 'Freddy & Priscila')} · “Háganlo todo de forma digna y ordenada” (1 Cor. 14:40)
  </footer>`;

  startCountdown();
  paintRsvp(inv, w);
}

function paintRsvp(inv, w) {
  const box = document.getElementById('rsvp-inner');
  if (!inv) {
    box.innerHTML = `
      <p>Si recibiste un enlace o código personal en tu invitación de WhatsApp, escríbelo aquí para confirmar tu asistencia:</p>
      <div id="code-msg"></div>
      <form id="code-form" class="code-row">
        <input name="code" required placeholder="Ej. MANUEL0003" value="${esc(currentCode)}">
        <button class="pub-btn" type="submit">Buscar invitación</button>
      </form>`;
    box.querySelector('#code-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      currentCode = e.target.code.value.trim();
      const found = await db.publicGetInvitation(currentCode);
      if (!found) {
        box.querySelector('#code-msg').innerHTML = `<div class="pub-msg err">No encontramos ese código. Verifica el enlace que te enviamos por WhatsApp.</div>`;
      } else {
        paintRsvp(found, w);
      }
    });
    return;
  }

  const maxComp = inv.companions || 0;
  const already = inv.rsvp === 'si' ? 'Ya habías confirmado que ¡sí asistes!' : inv.rsvp === 'no' ? 'Habías indicado que no podrás asistir.' : 'Aún no has confirmado.';

  box.innerHTML = `
    <div class="rsvp-hello">
      <strong>¡Hola, ${esc(inv.full_name)}!</strong><br>
      Hemos reservado <strong>${1 + maxComp} cupo${maxComp ? 's' : ''}</strong> para ti${maxComp ? ` (tú + hasta ${maxComp} acompañante${maxComp > 1 ? 's' : ''})` : ''}.
      <small style="display:block;margin-top:4px;color:#4A6B53;">Estado actual: ${already}</small>
    </div>
    <div id="rsvp-msg"></div>
    <form id="rsvp-form">
      <div class="rsvp-choices">
        <label class="rsvp-opt"><input type="radio" name="response" value="si" ${inv.rsvp !== 'no' ? 'checked' : ''}> ✔ Sí, asistiré con gusto</label>
        <label class="rsvp-opt"><input type="radio" name="response" value="no" ${inv.rsvp === 'no' ? 'checked' : ''}> ✕ No podré asistir</label>
      </div>
      ${maxComp > 0 ? `<label class="pub-field" id="comp-wrap">
        <span>¿Cuántos acompañantes irán contigo? (máximo ${maxComp})</span>
        <select name="companions">
          ${Array.from({ length: maxComp + 1 }, (_, i) => `<option value="${i}" ${(inv.companions_confirmed ?? maxComp) === i ? 'selected' : ''}>${i === 0 ? 'Solo yo (0 acompañantes)' : `${i} acompañante${i > 1 ? 's' : ''} (${i + 1} en total)`}</option>`).join('')}
        </select>
      </label>` : ''}
      <label class="pub-field">
        <span>¿Alguna alergia o restricción alimentaria? (opcional)</span>
        <input name="diet" value="${esc(inv.diet || '')}" placeholder="Ej. Ninguna, vegetariano, sin lácteos…">
      </label>
      <label class="pub-field">
        <span>Mensaje para Freddy y Priscila (opcional)</span>
        <textarea name="message" rows="2" placeholder="Un saludo o deseo bonito para los novios…">${esc(inv.rsvp_message || '')}</textarea>
      </label>
      <button class="pub-btn" type="submit">Guardar mi confirmación</button>
    </form>`;

  const form = box.querySelector('#rsvp-form');
  const compWrap = box.querySelector('#comp-wrap');
  form.querySelectorAll('input[name="response"]').forEach((r) => {
    r.addEventListener('change', () => { if (compWrap) compWrap.style.display = form.response.value === 'si' ? 'flex' : 'none'; });
  });
  if (compWrap && form.response.value === 'no') compWrap.style.display = 'none';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const ok = await db.publicSubmitRsvp({
        code: currentCode,
        response: form.response.value,
        companions: form.companions ? Number(form.companions.value) : 0,
        diet: form.diet.value.trim(),
        message: form.message.value.trim(),
      });
      const msgBox = box.querySelector('#rsvp-msg');
      if (ok) {
        msgBox.innerHTML = `<div class="pub-msg ok">¡Gracias, ${esc(inv.full_name)}! Tu confirmación fue registrada correctamente. 💐</div>`;
      } else {
        msgBox.innerHTML = `<div class="pub-msg err">No se pudo guardar la respuesta. Intenta de nuevo.</div>`;
      }
    } catch (err) {
      box.querySelector('#rsvp-msg').innerHTML = `<div class="pub-msg err">${esc(err.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
  });
}

function startCountdown() {
  const el = document.getElementById('pub-cd');
  if (!el) return;
  const target = new Date(el.dataset.date).getTime();
  const nums = el.querySelectorAll('strong');
  const tick = () => {
    let diff = Math.max(0, target - Date.now());
    const vals = [86400000, 3600000, 60000, 1000].map((u) => { const v = Math.floor(diff / u); diff -= v * u; return v; });
    nums.forEach((n, i) => { n.textContent = i === 0 ? vals[i] : String(vals[i]).padStart(2, '0'); });
  };
  tick();
  setInterval(tick, 1000);
}

init();
