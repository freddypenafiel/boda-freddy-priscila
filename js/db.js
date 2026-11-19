// Capa de datos: misma API para Supabase (nube) y modo demo (localStorage).
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_CDN } from './config.js';
import { buildSeed } from './data/seed.js';

const DEMO_KEY = 'fp_boda_demo_v2';
const MODE_KEY = 'fp_boda_mode';
const REALTIME_TABLES = [
  'wedding', 'tasks', 'guests', 'guest_groups', 'team_roles',
  'songs', 'budget_items', 'payments', 'vendors', 'seating_tables',
];

let mode = null;     // 'cloud' | 'demo'
let sb = null;       // cliente Supabase
let demo = null;     // datos demo en memoria
let channel = null;
const listeners = new Set();

export const uid = () =>
  globalThis.crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

const randCode = () => Math.random().toString(36).slice(2, 12).padEnd(10, '7');

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
        sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
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
  s.members = [{ user_id: 'demo', email: 'freddypeco1024@gmail.com', display_name: 'Freddy (demo)', role: 'admin', area: 'Novios' }];
  s.allowed_emails = [
    { email: 'freddypeco1024@gmail.com', role: 'admin', display_name: 'Freddy', area: 'Novios' },
    { email: 'priscila@ejemplo.com', role: 'admin', display_name: 'Priscila', area: 'Novios' },
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

/* ---------------- Autenticación ---------------- */
const AUTH_ERRORS = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/email not confirmed/i, 'Primero confirma tu correo: revisa tu bandeja de entrada (y spam).'],
  [/already registered|already been registered/i, 'Ese correo ya tiene una cuenta. Inicia sesión.'],
  [/password should be at least/i, 'La contraseña debe tener al menos 6 caracteres.'],
  [/rate limit|too many/i, 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'],
  [/invalid email|unable to validate email/i, 'El correo no es válido.'],
  [/failed to fetch|network/i, 'Sin conexión con el servidor. Revisa tu internet.'],
];
const authError = (e) => new Error(AUTH_ERRORS.find(([re]) => re.test(e?.message || ''))?.[1] || e?.message || 'Error de autenticación');

const redirectUrl = () => location.origin + location.pathname;

export const auth = {
  async session() {
    if (mode === 'demo') return { user: { id: 'demo', email: 'freddypeco1024@gmail.com' } };
    const { data } = await sb.auth.getSession();
    return data.session;
  },
  async signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw authError(error);
    return data.session;
  },
  async signUp(email, password, displayName) {
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { display_name: displayName }, emailRedirectTo: redirectUrl() },
    });
    if (error) throw authError(error);
    return data;
  },
  async resetPassword(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
    if (error) throw authError(error);
  },
  async updatePassword(password) {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw authError(error);
  },
  async signOut() {
    if (mode === 'cloud' && sb) await sb.auth.signOut();
  },
  async member() {
    if (mode === 'demo') return demo.members[0];
    const { data, error } = await sb.rpc('claim_membership');
    if (error) console.warn('claim_membership:', error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.user_id) return row;
    const s = await this.session();
    if (!s) return null;
    const { data: m } = await sb.from('members').select('*').eq('user_id', s.user.id).maybeSingle();
    return m || null;
  },
  onChange(cb) {
    if (mode === 'cloud') sb.auth.onAuthStateChange((evt, session) => cb(evt, session));
  },
};

/* ---------------- CRUD genérico ---------------- */
const cmp = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'es');
};

export async function list(table, { order = null, ascending = true } = {}) {
  if (mode === 'demo') {
    const rows = (demo[table] || []).map((r) => ({ ...r }));
    if (order) rows.sort((a, b) => cmp(a[order], b[order]) * (ascending ? 1 : -1));
    return rows;
  }
  let q = sb.from(table).select('*');
  if (order) q = q.order(order, { ascending, nullsFirst: false });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

export async function insert(table, row) {
  if (mode === 'demo') {
    const rows = (demo[table] ||= []);
    const nextIntId = () => rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
    const id = (table === 'seating_tables' || table === 'guest_groups') ? nextIntId() : uid();
    const extra = table === 'guests' ? { rsvp_code: row.rsvp_code || randCode(), rsvp: row.rsvp || 'pendiente', companions_confirmed: row.companions_confirmed ?? 0, invitation_sent: row.invitation_sent ?? false } : {};
    const rec = { id, created_at: new Date().toISOString(), ...extra, ...row };
    rows.push(rec);
    saveDemo(); emit(table);
    return { ...rec };
  }
  const { data, error } = await sb.from(table).insert(row).select().single();
  if (error) throw new Error(error.message);
  emit(table);
  return data;
}

export async function update(table, id, patch) {
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

export async function remove(table, id) {
  if (mode === 'demo') {
    demo[table] = (demo[table] || []).filter((r) => String(r.id) !== String(id));
    if (table === 'seating_tables') {
      (demo.guests || []).forEach((g) => { if (String(g.table_id) === String(id)) g.table_id = null; });
    }
    if (table === 'budget_items') {
      demo.payments = (demo.payments || []).filter((p) => String(p.budget_item_id) !== String(id));
    }
    saveDemo(); emit(table);
    return;
  }
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
  emit(table);
}

/* ---------------- Correos autorizados (PK: email) ---------------- */
export async function upsertAllowedEmail(row) {
  const rec = { ...row, email: row.email.trim().toLowerCase() };
  if (mode === 'demo') {
    const rows = (demo.allowed_emails ||= []);
    const i = rows.findIndex((r) => r.email.toLowerCase() === rec.email);
    if (i >= 0) rows[i] = { ...rows[i], ...rec };
    else rows.push({ ...rec, created_at: new Date().toISOString() });
    saveDemo(); emit('allowed_emails');
    return rec;
  }
  const { data, error } = await sb.from('allowed_emails').upsert(rec, { onConflict: 'email' }).select().single();
  if (error) throw new Error(error.message);
  emit('allowed_emails');
  return data;
}

export async function removeAllowedEmail(email) {
  const clean = email.trim().toLowerCase();
  if (mode === 'demo') {
    demo.allowed_emails = (demo.allowed_emails || []).filter((r) => r.email.toLowerCase() !== clean);
    saveDemo(); emit('allowed_emails');
    return;
  }
  const { error } = await sb.from('allowed_emails').delete().eq('email', clean);
  if (error) throw new Error(error.message);
  emit('allowed_emails');
}

export async function getWedding() {
  if (mode === 'demo') return { ...demo.wedding };
  const { data, error } = await sb.from('wedding').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(error.message);
  return data || {};
}

export async function updateWedding(patch) {
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
