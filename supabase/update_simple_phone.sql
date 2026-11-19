-- =====================================================================
--  Actualización a acceso simple: Nombre + Teléfono (sin contraseña ni correo)
--  Ejecutar una sola vez en Supabase → SQL Editor → + New → Run
-- =====================================================================

create table if not exists public.allowed_phones (
  phone        text primary key,
  display_name text not null,
  role         text not null default 'helper' check (role in ('admin','helper')),
  area         text,
  created_at   timestamptz not null default now()
);

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
