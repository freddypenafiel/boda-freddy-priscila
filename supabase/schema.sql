-- =====================================================================
--  Boda Freddy & Priscila · Esquema de base de datos (Supabase / Postgres)
--  Ejecutar en: Supabase → SQL Editor → New query → pegar → Run
--  Es idempotente: se puede volver a ejecutar sin perder datos.
-- =====================================================================

-- ---------- Utilidad: updated_at automático ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- Datos generales de la boda (una sola fila) ----------
create table if not exists public.wedding (
  id                   int primary key default 1 check (id = 1),
  couple_names         text not null default 'Freddy & Priscila',
  groom_name           text,
  bride_name           text,
  wedding_date         timestamptz,
  time_confirmed       boolean not null default false,
  city                 text,
  kingdom_hall         text,
  kingdom_hall_address text,
  reception_venue      text,
  reception_address    text,
  civil_date           date,
  civil_place          text,
  speaker              text,
  banquet_director     text,
  guest_target         int not null default 100,
  budget_target        numeric(12,2) not null default 0,
  dress_colors         text,
  notes                text,
  updated_at           timestamptz not null default now()
);

-- ---------- Accesos: correos autorizados y miembros ----------
create table if not exists public.allowed_emails (
  email        text primary key,
  role         text not null default 'helper' check (role in ('admin','helper')),
  display_name text,
  area         text,
  created_at   timestamptz not null default now()
);

create table if not exists public.members (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  display_name text,
  role         text not null default 'helper' check (role in ('admin','helper')),
  area         text,
  created_at   timestamptz not null default now()
);

-- ---------- Principios bíblicos (artículo La Atalaya dic. 2025) ----------
create table if not exists public.principles (
  id            int primary key,
  sort          int not null default 0,
  title         text not null,
  scripture     text,
  scripture_url text,
  summary       text,
  category      text
);

-- ---------- Tareas / checklist ----------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  stage        text not null default 's2' check (stage in ('s1','s2','s3','s4','s5','s6')),
  category     text,
  principle_id int references public.principles(id) on delete set null,
  assignee     text,
  due_date     date,
  status       text not null default 'pendiente' check (status in ('pendiente','en_progreso','hecho')),
  sort         int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------- Invitados y mesas ----------
create table if not exists public.guest_groups (
  id    serial primary key,
  name  text not null,
  color text
);

create table if not exists public.seating_tables (
  id       serial primary key,
  name     text not null,
  capacity int not null default 10,
  sort     int not null default 0
);

create table if not exists public.guests (
  id                   uuid primary key default gen_random_uuid(),
  full_name            text not null,
  group_id             int references public.guest_groups(id) on delete set null,
  side                 text check (side in ('novio','novia','ambos')),
  phone                text,
  email                text,
  companions           int not null default 0,
  companions_confirmed int not null default 0,
  children             int not null default 0,
  is_witness           boolean not null default true,
  rsvp                 text not null default 'pendiente' check (rsvp in ('pendiente','si','no')),
  rsvp_code            text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  rsvp_message         text,
  rsvp_at              timestamptz,
  diet                 text,
  table_id             int references public.seating_tables(id) on delete set null,
  invitation_sent      boolean not null default false,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------- Proveedores, presupuesto y pagos ----------
create table if not exists public.vendors (
  id         uuid primary key default gen_random_uuid(),
  category   text,
  name       text not null,
  contact    text,
  phone      text,
  email      text,
  quote      numeric(12,2),
  status     text not null default 'cotizando' check (status in ('cotizando','reservado','pagado','descartado')),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_items (
  id         uuid primary key default gen_random_uuid(),
  category   text,
  concept    text not null,
  estimated  numeric(12,2) not null default 0,
  actual     numeric(12,2),
  vendor_id  uuid references public.vendors(id) on delete set null,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  budget_item_id uuid references public.budget_items(id) on delete cascade,
  amount         numeric(12,2) not null check (amount >= 0),
  paid_on        date not null default current_date,
  method         text,
  note           text,
  created_at     timestamptz not null default now()
);

-- ---------- Equipo y música ----------
create table if not exists public.team_roles (
  id         uuid primary key default gen_random_uuid(),
  role       text not null,
  person     text,
  partner    text,
  phone      text,
  notes      text,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.songs (
  id      uuid primary key default gen_random_uuid(),
  title   text not null,
  artist  text,
  url     text,
  purpose text,
  sort    int not null default 0
);

-- ---------- Triggers updated_at ----------
do $$
declare t text;
begin
  foreach t in array array['wedding','tasks','guests','vendors','budget_items'] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$I', t);
    execute format('create trigger trg_%1$s_updated before update on public.%1$I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- =====================================================================
--  Seguridad: funciones de rol
-- =====================================================================
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and role = 'admin');
$$;

-- Al registrarse un usuario: si no hay ningún miembro aún, el primero entra como admin;
-- si ya hay miembros, entra si su teléfono/identificador está autorizado en allowed_emails.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a public.allowed_emails;
  v_name text := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1));
begin
  if not exists (select 1 from public.members) then
    insert into public.allowed_emails (email, role, display_name, area)
    values (lower(new.email), 'admin', v_name, 'Novios')
    on conflict (email) do update set role = 'admin';
    insert into public.members (user_id, email, display_name, role, area)
    values (new.id, lower(new.email), v_name, 'admin', 'Novios')
    on conflict (user_id) do nothing;
    return new;
  end if;

  select * into a from public.allowed_emails where lower(email) = lower(new.email);
  if found then
    insert into public.members (user_id, email, display_name, role, area)
    values (new.id, lower(new.email), coalesce(a.display_name, v_name), a.role, a.area)
    on conflict (user_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Para usuarios ya registrados: reclama membresía (o se vuelve admin si members está vacío).
create or replace function public.claim_membership()
returns public.members language plpgsql security definer set search_path = public as $$
declare
  a public.allowed_emails;
  m public.members;
  v_email text := lower(auth.jwt() ->> 'email');
  v_name  text := coalesce(auth.jwt() -> 'user_metadata' ->> 'display_name', split_part(v_email, '@', 1));
begin
  if auth.uid() is null then return null; end if;

  if not exists (select 1 from public.members) then
    insert into public.allowed_emails (email, role, display_name, area)
    values (v_email, 'admin', v_name, 'Novios')
    on conflict (email) do update set role = 'admin';
  end if;

  select * into a from public.allowed_emails where lower(email) = v_email;
  if found then
    insert into public.members (user_id, email, display_name, role, area)
    values (auth.uid(), v_email, coalesce(a.display_name, v_name), a.role, a.area)
    on conflict (user_id) do update
      set role = excluded.role,
          area = excluded.area,
          display_name = coalesce(public.members.display_name, excluded.display_name);
  end if;
  select * into m from public.members where user_id = auth.uid();
  return m;
end $$;

-- =====================================================================
--  Row Level Security
--  · Miembros (admin y helper): pueden LEER todo.
--  · Admins (Freddy y Priscila): pueden crear/editar/borrar todo.
--  · Helpers: además pueden actualizar tareas (marcar avances).
--  · Anónimos: sin acceso directo; solo funciones RSVP públicas.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['wedding','principles','tasks','guest_groups','seating_tables','guests',
                           'vendors','budget_items','payments','team_roles','songs','members'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists members_read on public.%I', t);
    execute format('create policy members_read on public.%I for select to authenticated using (public.is_member())', t);
    execute format('drop policy if exists admins_write on public.%I', t);
    execute format('create policy admins_write on public.%I for all to authenticated
                    using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

drop policy if exists helpers_update_tasks on public.tasks;
create policy helpers_update_tasks on public.tasks
  for update to authenticated using (public.is_member()) with check (public.is_member());

alter table public.allowed_emails enable row level security;
drop policy if exists admins_all on public.allowed_emails;
create policy admins_all on public.allowed_emails
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Permisos de la API
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- =====================================================================
--  Funciones públicas para la web de invitados (RSVP con código)
-- =====================================================================
create or replace function public.get_public_wedding()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'couple_names', couple_names, 'wedding_date', wedding_date, 'time_confirmed', time_confirmed,
    'city', city, 'kingdom_hall', kingdom_hall, 'kingdom_hall_address', kingdom_hall_address,
    'reception_venue', reception_venue, 'reception_address', reception_address,
    'dress_colors', dress_colors)
  from public.wedding where id = 1;
$$;

create or replace function public.get_invitation(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('full_name', full_name, 'companions', companions,
                           'companions_confirmed', companions_confirmed,
                           'rsvp', rsvp, 'diet', diet, 'rsvp_message', rsvp_message)
  from public.guests where rsvp_code = p_code;
$$;

create or replace function public.submit_rsvp(p_code text, p_response text, p_companions int,
                                              p_diet text, p_message text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_response not in ('si','no') then
    raise exception 'Respuesta inválida';
  end if;
  update public.guests
     set rsvp = p_response,
         companions_confirmed = case when p_response = 'si'
                                     then least(greatest(coalesce(p_companions, 0), 0), companions)
                                     else 0 end,
         diet = left(p_diet, 200),
         rsvp_message = left(p_message, 500),
         rsvp_at = now()
   where rsvp_code = p_code;
  return found;
end $$;

revoke execute on function public.get_public_wedding() from public;
revoke execute on function public.get_invitation(text) from public;
revoke execute on function public.submit_rsvp(text, text, int, text, text) from public;
grant execute on function public.get_public_wedding() to anon, authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, text, int, text, text) to anon, authenticated;
grant execute on function public.claim_membership() to authenticated;

-- =====================================================================
--  Tiempo real (los cambios se ven al instante en todos los dispositivos)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['wedding','tasks','guests','team_roles','budget_items','payments','vendors','seating_tables'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
