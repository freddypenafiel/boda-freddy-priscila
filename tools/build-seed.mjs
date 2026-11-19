// Genera supabase/seed.sql a partir de js/data/seed.js
// Uso: npm run seed
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildSeed } from '../js/data/seed.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const s = buildSeed();

const lit = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
};

function insert(table, rows, cols, suffix = '') {
  if (!rows.length) return '';
  const values = rows.map((r) => `  (${cols.map((c) => lit(r[c])).join(', ')})`).join(',\n');
  return `insert into public.${table} (${cols.join(', ')}) values\n${values}${suffix ? '\n' + suffix : ''};\n`;
}

const onlyIfEmpty = (table, sql) =>
  `do $$ begin\n  if not exists (select 1 from public.${table}) then\n${sql
    .split('\n')
    .map((l) => (l ? '    ' + l : l))
    .join('\n')}  end if;\nend $$;\n`;

const w = s.wedding;
const wCols = Object.keys(w);

let out = `-- =====================================================================
--  Datos iniciales · Boda Freddy & Priscila
--  GENERADO AUTOMÁTICAMENTE desde js/data/seed.js (npm run seed)
--  Ejecutar DESPUÉS de schema.sql. Es seguro volver a ejecutarlo.
--  Nota: el primer teléfono que ingrese en la web queda como Admin.
-- =====================================================================

-- Datos de la boda
${insert('wedding', [w], wCols, 'on conflict (id) do nothing')}
-- Principios bíblicos
${insert('principles', s.principles, ['id', 'sort', 'title', 'scripture', 'scripture_url', 'summary', 'category'],
  'on conflict (id) do update set sort = excluded.sort, title = excluded.title, scripture = excluded.scripture,\n  scripture_url = excluded.scripture_url, summary = excluded.summary, category = excluded.category')}
-- Grupos de invitados
${insert('guest_groups', s.guest_groups, ['id', 'name', 'color'], 'on conflict (id) do nothing')}select setval(pg_get_serial_sequence('public.guest_groups', 'id'), greatest((select max(id) from public.guest_groups), 1));

-- Tareas (solo si la tabla está vacía)
${onlyIfEmpty('tasks', insert('tasks', s.tasks, ['title', 'description', 'stage', 'category', 'principle_id', 'assignee', 'due_date', 'status', 'sort']))}
-- Equipo (solo si está vacío)
${onlyIfEmpty('team_roles', insert('team_roles', s.team_roles, ['role', 'person', 'partner', 'notes', 'sort']))}
-- Canciones (solo si está vacío)
${onlyIfEmpty('songs', insert('songs', s.songs, ['title', 'artist', 'url', 'purpose', 'sort']))}
-- Mesas base para 100 invitados (solo si está vacío)
${onlyIfEmpty('seating_tables', insert('seating_tables', s.seating_tables, ['name', 'capacity', 'sort']))}
-- Rubros base del presupuesto (solo si está vacío)
${onlyIfEmpty('budget_items', insert('budget_items', s.budget_items, ['category', 'concept', 'estimated', 'actual', 'notes']))}`;

writeFileSync(join(root, 'supabase', 'seed.sql'), out, 'utf8');
console.log('supabase/seed.sql generado ✔');
