-- Actualización rápida para login con Nombre + Teléfono + Contraseña (sin correo).
-- El primer usuario que se registre entra automáticamente como Administrador.
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
