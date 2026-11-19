-- =====================================================================
--  Boda Freddy & Priscila · Esquema de base de datos (Supabase / Postgres)
--  Acceso sencillo: Nombre + Teléfono (sin correo ni contraseña)
--  Ejecutar en: Supabase → SQL Editor → New query → pegar → Run
-- =====================================================================

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

-- ---------- Accesos autorizados (Nombre + Teléfono) ----------
create table if not exists public.allowed_phones (
  phone        text primary key,
  display_name text not null,
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
--  Acceso sencillo por Nombre + Teléfono (sin contraseña)
--  · La primera persona que ingresa queda automáticamente como admin.
--  · Luego los admins autorizan a Priscila y ayudantes por teléfono.
-- =====================================================================
create or replace function public.login_with_phone(p_name text, p_phone text)
returns public.allowed_phones language plpgsql security definer set search_path = public as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name  text := nullif(trim(coalesce(p_name, '')), '');
  rec     public.allowed_phones;
begin
  if length(v_phone) = 10 and left(v_phone, 1) = '0' then
    v_phone := '593' || substr(v_phone, 2);
  end if;
  if length(v_phone) < 7 then
    return null;
  end if;

  if not exists (select 1 from public.allowed_phones) then
    insert into public.allowed_phones (phone, display_name, role, area)
    values (v_phone, coalesce(v_name, v_phone), 'admin', 'Novios')
    returning * into rec;
    return rec;
  end if;

  select * into rec from public.allowed_phones where phone = v_phone;
  if found then
    if v_name is not null and (rec.display_name is null or rec.display_name = '' or rec.display_name = v_phone) then
      update public.allowed_phones set display_name = v_name where phone = v_phone returning * into rec;
    end if;
    return rec;
  end if;

  return null;
end $$;

-- =====================================================================
--  Permisos y políticas para operación directa sin contraseña
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['wedding','principles','tasks','guest_groups','seating_tables','guests',
                           'vendors','budget_items','payments','team_roles','songs','allowed_phones'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists members_read on public.%I', t);
    execute format('drop policy if exists admins_write on public.%I', t);
    execute format('drop policy if exists helpers_update_tasks on public.%I', t);
    execute format('drop policy if exists app_access on public.%I', t);
    execute format('create policy app_access on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on function public.login_with_phone(text, text) to anon, authenticated;

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

grant execute on function public.get_public_wedding() to anon, authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, text, int, text, text) to anon, authenticated;

-- =====================================================================
--  Tiempo real (los cambios se ven al instante en todos los dispositivos)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['wedding','tasks','guests','guest_groups','team_roles','songs',
                           'budget_items','payments','vendors','seating_tables','allowed_phones'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
