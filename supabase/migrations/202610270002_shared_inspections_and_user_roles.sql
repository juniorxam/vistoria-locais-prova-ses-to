-- Shared inspections and centralized role authorization.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('principal_admin', 'authorized_user')),
  created_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;
revoke all on public.user_roles from public, anon, authenticated;
grant select, insert, update, delete on public.user_roles to service_role;

create or replace function private.has_app_access()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid())
      and r.role in ('principal_admin', 'authorized_user')
  );
$$;
revoke all on function private.has_app_access() from public, anon;
grant execute on function private.has_app_access() to authenticated;

create or replace function private.keep_inspection_owner()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then new.user_id := old.user_id; end if;
  return new;
end;
$$;
revoke all on function private.keep_inspection_owner() from public, anon, authenticated;
drop trigger if exists keep_inspection_owner on public.inspections;
create trigger keep_inspection_owner
before update on public.inspections
for each row execute function private.keep_inspection_owner();

drop policy if exists "Users can read their own inspections" on public.inspections;
drop policy if exists "Users can create their own inspections" on public.inspections;
drop policy if exists "Users can update their own inspections" on public.inspections;
drop policy if exists "Users can delete their own inspections" on public.inspections;
drop policy if exists "Users can view their own inspections" on public.inspections;
drop policy if exists "Users can insert their own inspections" on public.inspections;
drop policy if exists "Users can update their own inspections" on public.inspections;
drop policy if exists "Users can delete their own inspections" on public.inspections;

create policy "Authorized users can read shared inspections"
on public.inspections for select to authenticated
using ((select private.has_app_access()));
create policy "Authorized users can create shared inspections"
on public.inspections for insert to authenticated
with check ((select private.has_app_access()));
create policy "Authorized users can update shared inspections"
on public.inspections for update to authenticated
using ((select private.has_app_access()))
with check ((select private.has_app_access()));
create policy "Authorized users can delete shared inspections"
on public.inspections for delete to authenticated
using ((select private.has_app_access()));
