// Capa de datos: Supabase (nube + Realtime + Presence) y modo demo (localStorage).
// Acceso: Nombre + Teléfono con solicitudes de aprobación en vivo en 1 clic.
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_CDN } from './config.js';
import { buildSeed } from './data/seed.js';

const DEMO_KEY = 'fp_boda_demo_v5';
const MODE_KEY = 'fp_boda_mode';
const SESSION_KEY = 'fp_boda_phone_session';
export const PENDING_PREFIX = '__PENDING__|';
const REALTIME_TABLES = [
  'wedding', 'tasks', 'guests', 'guest_groups', 'team_roles',
  'songs', 'budget_items', 'payments', 'vendors', 'seating_tables', 'allowed_phones',
];

let mode = null;     // 'cloud' | 'demo'
let sb = null;       // cliente Supabase
let demo = null;     // datos demo en memoria
let channel = null;
let presenceCh = null;
let currentPresenceMeta = null;
let onlineUsers = [];
let syncState = { status: navigator.onLine === false ? 'offline' : 'idle', lastSyncAt: null, message: '' };
const listeners = new Set();
const presenceListeners = new Set();
const syncListeners = new Set();

function setSync(status, message = '') {
  syncState = {
    status,
    lastSyncAt: status === 'saved' ? new Date().toISOString() : syncState.lastSyncAt,
    message,
  };
  syncListeners.forEach((cb) => { try { cb(syncState); } catch (e) { console.error(e); } });
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => setSync('saved', 'Conexión restablecida'));
  window.addEventListener('offline', () => setSync('offline', 'Sin conexión a internet'));
}

export const sync = {
  getState: () => syncState,
  onChange(cb) {
    syncListeners.add(cb);
    return () => syncListeners.delete(cb);
  },
  async pingNow() {
    if (mode !== 'cloud' || !sb) {
      setSync('saved', 'Guardado local (demo)');
      emit('*');
      return true;
    }
    setSync('saving', 'Sincronizando…');
    try {
      const { error } = await sb.from('wedding').select('id, updated_at').eq('id', 1).maybeSingle();
      if (error) throw error;
      setSync('saved', 'Sincronizado con la nube');
      emit('*');
      return true;
    } catch (e) {
      setSync(navigator.onLine === false ? 'offline' : 'error', e.message || 'Error de conexión');
      return false;
    }
  },
};

export const uid = () =>
  globalThis.crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

const randCode = () => Math.random().toString(36).slice(2, 12).padEnd(10, '7');

/* ---------------- Utilidades de teléfono y solicitudes ---------------- */
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0') && d.length === 10) d = '593' + d.slice(1);
  return d;
}

export function formatPhone(raw) {
  const d = normalizePhone(raw);
  if (!d) return '';
  if (d.startsWith('593') && d.length === 12) return '0' + d.slice(3);
  return d;
}

export const isPendingAccess = (row) => Boolean(row && typeof row.area === 'string' && row.area.startsWith(PENDING_PREFIX));

export function pendingRequestedAt(row) {
  if (!isPendingAccess(row)) return null;
  const iso = row.area.slice(PENDING_PREFIX.length);
  return iso || row.created_at || null;
}

/* ---------------- Modo ---------------- */
export const getMode = () => mode;
export const isCloudConfigured = () => Boolean(SUPABASE_URL && SUPABASE_KEY);
export function setPreferredMode(m) { localStorage.setItem(MODE_KEY, m); }
export function preferredMode() {
  if (new URLSearchParams(location.search).get('demo') === '1') return 'demo';
  return localStorage.getItem(MODE_KEY) || (isCloudConfigured() ? 'cloud' : 'demo');
}

export async function initDb(m = preferredMode()) {
  if (m === 'cloud' && isCloudConfigured()) {
    if (!sb) {
      try {
        const { createClient } = await import(SUPABASE_CDN);
        sb = createClient(SUPABASE_URL, SUPABASE_KEY);
      } catch (e) {
        console.warn('No se pudo cargar Supabase:', e);
        throw new Error('No se pudo conectar con la nube. Revisa tu conexión a internet o explora en modo demo.');
      }
    }
    mode = 'cloud';
    return mode;
  }
  mode = 'demo';
  demo = loadDemo();
  return mode;
}

/* ---------------- Demo (localStorage) ---------------- */
function loadDemo() {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.wedding) return parsed;
    }
  } catch { /* datos corruptos: se regeneran */ }
  const s = buildSeed();
  for (const [k, rows] of Object.entries(s)) {
    if (Array.isArray(rows)) {
      rows.forEach((r, idx) => {
        if (r.id == null) r.id = k === 'seating_tables' ? idx + 1 : uid();
        if (k === 'guests' && !r.rsvp_code) r.rsvp_code = randCode();
      });
    }
  }
  s.allowed_phones = [
    { phone: '593999999999', display_name: 'Freddy (demo)', role: 'admin', area: 'Novios' },
    { phone: '593988888888', display_name: 'Priscila', role: 'helper', area: `${PENDING_PREFIX}${new Date().toISOString()}` },
  ];
  localStorage.setItem(DEMO_KEY, JSON.stringify(s));
  return s;
}
const saveDemo = () => localStorage.setItem(DEMO_KEY, JSON.stringify(demo));

export function resetDemo() {
  localStorage.removeItem(DEMO_KEY);
  demo = loadDemo();
  emit('*');
}

window.addEventListener('storage', (e) => {
  if (mode === 'demo' && e.key === DEMO_KEY) { demo = loadDemo(); emit('*'); }
});

/* ---------------- Sesión sencilla + Solicitudes de acceso en vivo ---------------- */
function readSavedSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(rec) {
  if (rec) localStorage.setItem(SESSION_KEY, JSON.stringify(rec));
  else localStorage.removeItem(SESSION_KEY);
}

export const auth = {
  saved() {
    if (mode === 'demo') return demo.allowed_phones.find((x) => !isPendingAccess(x)) || demo.allowed_phones[0];
    return readSavedSession();
  },
  /**
   * Intenta iniciar sesión con Nombre + Teléfono.
   * - Si es el primer usuario o ya está aprobado: devuelve { status: 'ok', member }.
   * - Si no está autorizado aún: registra automáticamente una solicitud pendiente
   *   para que Freddy pueda aprobarlo con 1 clic en tiempo real y devuelve { status: 'pending', name, phone }.
   */
  async login(name, phone) {
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 7) throw new Error('Ingresa un número de teléfono válido (al menos 7 dígitos).');
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('Escribe tu nombre.');

    if (mode === 'demo') {
      const rec = { phone: cleanPhone, display_name: cleanName, role: 'admin', area: 'Novios' };
      return { status: 'ok', member: rec };
    }

    const { data, error } = await sb.rpc('login_with_phone', { p_name: cleanName, p_phone: cleanPhone });
    if (error) {
      if (/login_with_phone/i.test(error.message)) {
        throw new Error('Falta ejecutar supabase/update_simple_phone.sql en Supabase.');
      }
      throw new Error(error.message);
    }
    const row = Array.isArray(data) ? data[0] : data;

    if (row && row.phone && !isPendingAccess(row)) {
      saveSession(row);
      return { status: 'ok', member: row };
    }

    // No autorizado todavía → registrar o refrescar solicitud pendiente en vivo
    const pendingRec = {
      phone: cleanPhone,
      display_name: cleanName,
      role: 'helper',
      area: `${PENDING_PREFIX}${new Date().toISOString()}`,
    };
    await sb.from('allowed_phones').upsert(pendingRec, { onConflict: 'phone' });
    saveSession(null);
    return { status: 'pending', name: cleanName, phone: cleanPhone };
  },
  async verifySaved() {
    if (mode === 'demo') return this.saved();
    const saved = readSavedSession();
    if (!saved?.phone) return null;
    try {
      const { data, error } = await sb.from('allowed_phones').select('*').eq('phone', saved.phone).maybeSingle();
      if (error || !data || isPendingAccess(data)) {
        saveSession(null);
        return null;
      }
      saveSession(data);
      return data;
    } catch {
      return saved;
    }
  },
  /** Escucha en tiempo real si Freddy aprueba o rechaza esta solicitud pendiente. */
  watchApproval(phone, { onApproved, onRejected }) {
    const cleanPhone = normalizePhone(phone);
    if (mode !== 'cloud' || !sb) return () => {};
    let stopped = false;

    const checkNow = async () => {
      if (stopped) return;
      const { data } = await sb.from('allowed_phones').select('*').eq('phone', cleanPhone).maybeSingle();
      if (!data) {
        onRejected?.();
      } else if (!isPendingAccess(data)) {
        saveSession(data);
        onApproved?.(data);
      }
    };

    const ch = sb.channel(`wait-${cleanPhone}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'allowed_phones', filter: `phone=eq.${cleanPhone}` }, checkNow)
      .subscribe();
    const poll = setInterval(checkNow, 4000);

    return () => {
      stopped = true;
      clearInterval(poll);
      sb.removeChannel(ch);
    };
  },
  async signOut() {
    presence.stop();
    saveSession(null);
  },
};

/* ---------------- Presencia en tiempo real ("Quiénes están conectados") ---------------- */
function emitPresence() {
  presenceListeners.forEach((cb) => { try { cb(onlineUsers); } catch (e) { console.error(e); } });
}

export const presence = {
  getOnline: () => onlineUsers,
  onChange(cb) {
    presenceListeners.add(cb);
    return () => presenceListeners.delete(cb);
  },
  start(member, routeLabel = 'Mi boda') {
    const device = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'Celular' : 'PC';
    currentPresenceMeta = {
      phone: member?.phone || 'demo',
      name: member?.display_name || formatPhone(member?.phone) || 'Usuario',
      role: member?.role || 'helper',
      area: member?.area || '',
      device,
      route: routeLabel,
      since: new Date().toISOString(),
    };

    if (mode !== 'cloud' || !sb) {
      onlineUsers = [currentPresenceMeta];
      emitPresence();
      return;
    }

    if (presenceCh) {
      sb.removeChannel(presenceCh);
      presenceCh = null;
    }

    presenceCh = sb.channel('boda-online-presence', {
      config: { presence: { key: currentPresenceMeta.phone } },
    });

    const syncOnline = () => {
      const state = presenceCh.presenceState();
      const list = [];
      for (const entries of Object.values(state)) {
        if (entries && entries.length) list.push(entries[entries.length - 1]);
      }
      list.sort((a, b) => (a.role === 'admin' ? -1 : 1) - (b.role === 'admin' ? -1 : 1) || a.name.localeCompare(b.name, 'es'));
      onlineUsers = list;
      emitPresence();
    };

    presenceCh
      .on('presence', { event: 'sync' }, syncOnline)
      .on('presence', { event: 'join' }, syncOnline)
      .on('presence', { event: 'leave' }, syncOnline)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && currentPresenceMeta) {
          await presenceCh.track(currentPresenceMeta);
        }
      });
  },
  async setRoute(routeLabel) {
    if (!currentPresenceMeta) return;
    currentPresenceMeta = { ...currentPresenceMeta, route: routeLabel };
    if (mode === 'cloud' && presenceCh) {
      try { await presenceCh.track(currentPresenceMeta); } catch { /* noop */ }
    } else {
      onlineUsers = [currentPresenceMeta];
      emitPresence();
    }
  },
  stop() {
    if (presenceCh && sb) {
      try { sb.removeChannel(presenceCh); } catch { /* noop */ }
    }
    presenceCh = null;
    currentPresenceMeta = null;
    onlineUsers = [];
    emitPresence();
  },
};

/* ---------------- CRUD genérico ---------------- */
const cmp = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'es');
};

export async function list(table, { order = null, ascending = true, select = '*' } = {}) {
  if (mode === 'demo') {
    const rows = (demo[table] || []).map((r) => ({ ...r }));
    if (order) rows.sort((a, b) => cmp(a[order], b[order]) * (ascending ? 1 : -1));
    return rows;
  }
  let q = sb.from(table).select(select);
  if (order) q = q.order(order, { ascending, nullsFirst: false });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

async function syncWeddingFromRole(role, person) {
  if (!role) return;
  const r = String(role).toLowerCase();
  if (/director/.test(r)) {
    await updateWeddingRaw({ banquet_director: person || null });
  } else if (/orador|discurs/.test(r)) {
    await updateWeddingRaw({ speaker: person || null });
  }
}

async function syncRolesFromWedding(patch) {
  if (!patch) return;
  const roles = await list('team_roles');
  if ('banquet_director' in patch) {
    const r = roles.find((x) => /director/i.test(x.role));
    if (r && r.person !== patch.banquet_director) {
      await updateRaw('team_roles', r.id, { person: patch.banquet_director || null });
    }
  }
  if ('speaker' in patch) {
    const r = roles.find((x) => /orador|discurs/i.test(x.role));
    if (r && r.person !== patch.speaker) {
      await updateRaw('team_roles', r.id, { person: patch.speaker || null });
    }
  }
}

async function updateRaw(table, id, patch) {
  if (mode === 'demo') {
    const rows = demo[table] || [];
    const i = rows.findIndex((r) => String(r.id) === String(id));
    if (i < 0) throw new Error('Registro no encontrado');
    rows[i] = { ...rows[i], ...patch, updated_at: new Date().toISOString() };
    saveDemo(); emit(table);
    return { ...rows[i] };
  }
  const { data, error } = await sb.from(table).update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  emit(table);
  return data;
}

async function updateWeddingRaw(patch) {
  if (mode === 'demo') {
    demo.wedding = { ...demo.wedding, ...patch };
    saveDemo(); emit('wedding');
    return { ...demo.wedding };
  }
  const { data, error } = await sb.from('wedding').update(patch).eq('id', 1).select().single();
  if (error) throw new Error(error.message);
  emit('wedding');
  return data;
}

export async function insert(table, row) {
  setSync('saving', 'Guardando en la nube…');
  try {
    let result;
    if (mode === 'demo') {
      const rows = (demo[table] ||= []);
      const nextIntId = () => rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
      const id = (table === 'seating_tables' || table === 'guest_groups') ? nextIntId() : uid();
      const extra = table === 'guests' ? { rsvp_code: row.rsvp_code || randCode(), rsvp: row.rsvp || 'pendiente', companions_confirmed: row.companions_confirmed ?? 0, invitation_sent: row.invitation_sent ?? false } : {};
      const rec = { id, created_at: new Date().toISOString(), ...extra, ...row };
      rows.push(rec);
      saveDemo(); emit(table);
      result = { ...rec };
    } else {
      const { data, error } = await sb.from(table).insert(row).select().single();
      if (error) throw new Error(error.message);
      emit(table);
      result = data;
    }
    if (table === 'team_roles') await syncWeddingFromRole(result.role, result.person).catch(() => {});
    setSync('saved', 'Guardado en la nube');
    return result;
  } catch (e) {
    setSync(navigator.onLine === false ? 'offline' : 'error', e.message);
    throw e;
  }
}

export async function update(table, id, patch) {
  setSync('saving', 'Guardando en la nube…');
  try {
    const result = await updateRaw(table, id, patch);
    if (table === 'team_roles') await syncWeddingFromRole(result.role, result.person).catch(() => {});
    setSync('saved', 'Guardado en la nube');
    return result;
  } catch (e) {
    setSync(navigator.onLine === false ? 'offline' : 'error', e.message);
    throw e;
  }
}

export async function remove(table, id) {
  setSync('saving', 'Guardando en la nube…');
  try {
    if (mode === 'demo') {
      demo[table] = (demo[table] || []).filter((r) => String(r.id) !== String(id));
      if (table === 'seating_tables') {
        (demo.guests || []).forEach((g) => { if (String(g.table_id) === String(id)) g.table_id = null; });
      }
      if (table === 'budget_items') {
        demo.payments = (demo.payments || []).filter((p) => String(p.budget_item_id) !== String(id));
      }
      saveDemo(); emit(table);
    } else {
      const { error } = await sb.from(table).delete().eq('id', id);
      if (error) throw new Error(error.message);
      emit(table);
    }
    setSync('saved', 'Guardado en la nube');
  } catch (e) {
    setSync(navigator.onLine === false ? 'offline' : 'error', e.message);
    throw e;
  }
}

/* ---------------- Teléfonos autorizados y aprobación en 1 clic ---------------- */
export async function upsertAllowedPhone({ phone, display_name, role, area }) {
  const clean = normalizePhone(phone);
  if (clean.length < 7) throw new Error('Ingresa un número de teléfono válido.');
  const rec = {
    phone: clean,
    display_name: display_name || formatPhone(clean),
    role: role || 'helper',
    area: (area && !String(area).startsWith(PENDING_PREFIX)) ? area : (role === 'admin' ? 'Novios' : 'Ayudante'),
  };
  if (mode === 'demo') {
    const rows = (demo.allowed_phones ||= []);
    const i = rows.findIndex((r) => r.phone === clean);
    if (i >= 0) rows[i] = { ...rows[i], ...rec };
    else rows.push({ ...rec, created_at: new Date().toISOString() });
    saveDemo(); emit('allowed_phones');
    return rec;
  }
  const { data, error } = await sb.from('allowed_phones').upsert(rec, { onConflict: 'phone' }).select().single();
  if (error) throw new Error(error.message);
  emit('allowed_phones');
  return data;
}

export async function approvePendingPhone(phone, displayName, role = 'admin') {
  return upsertAllowedPhone({
    phone,
    display_name: displayName,
    role,
    area: role === 'admin' ? 'Novios / Admin' : 'Ayudante',
  });
}

export async function removeAllowedPhone(phone) {
  const clean = normalizePhone(phone);
  if (mode === 'demo') {
    demo.allowed_phones = (demo.allowed_phones || []).filter((r) => r.phone !== clean);
    saveDemo(); emit('allowed_phones');
    return;
  }
  const { error } = await sb.from('allowed_phones').delete().eq('phone', clean);
  if (error) throw new Error(error.message);
  emit('allowed_phones');
}

export async function getWedding() {
  if (mode === 'demo') return { ...demo.wedding };
  const { data, error } = await sb.from('wedding').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(error.message);
  return data || {};
}

export async function updateWedding(patch) {
  setSync('saving', 'Guardando en la nube…');
  try {
    const result = await updateWeddingRaw(patch);
    await syncRolesFromWedding(patch).catch(() => {});
    setSync('saved', 'Guardado en la nube');
    return result;
  } catch (e) {
    setSync(navigator.onLine === false ? 'offline' : 'error', e.message);
    throw e;
  }
}

/* ---------------- Funciones públicas (Web de invitados) ---------------- */
export async function publicGetWedding() {
  if (mode === 'demo') return { ...demo.wedding };
  const { data, error } = await sb.rpc('get_public_wedding');
  if (error) throw new Error(error.message);
  return data || {};
}

export async function publicGetInvitation(code) {
  const clean = String(code || '').trim();
  if (!clean) return null;
  if (mode === 'demo') {
    const g = (demo.guests || []).find((x) => x.rsvp_code === clean);
    if (!g) return null;
    return {
      full_name: g.full_name, companions: g.companions,
      companions_confirmed: g.companions_confirmed, rsvp: g.rsvp,
      diet: g.diet, rsvp_message: g.rsvp_message,
    };
  }
  const { data, error } = await sb.rpc('get_invitation', { p_code: clean });
  if (error) throw new Error(error.message);
  return data || null;
}

export async function publicSubmitRsvp({ code, response, companions, diet, message }) {
  const clean = String(code || '').trim();
  if (mode === 'demo') {
    const g = (demo.guests || []).find((x) => x.rsvp_code === clean);
    if (!g) return false;
    g.rsvp = response;
    g.companions_confirmed = response === 'si' ? Math.min(Math.max(Number(companions) || 0, 0), g.companions || 0) : 0;
    g.diet = (diet || '').slice(0, 200) || null;
    g.rsvp_message = (message || '').slice(0, 500) || null;
    g.rsvp_at = new Date().toISOString();
    saveDemo();
    return true;
  }
  const { data, error } = await sb.rpc('submit_rsvp', {
    p_code: clean,
    p_response: response,
    p_companions: Number(companions) || 0,
    p_diet: diet || null,
    p_message: message || null,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/* ---------------- Cambios en tiempo real ---------------- */
function emit(table) {
  listeners.forEach((cb) => { try { cb(table); } catch (e) { console.error(e); } });
}

export function subscribe(cb) {
  listeners.add(cb);
  if (mode === 'cloud' && !channel) {
    channel = sb.channel('boda-cambios');
    REALTIME_TABLES.forEach((t) =>
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => emit(t)));
    channel.subscribe();
  }
  return () => listeners.delete(cb);
}
