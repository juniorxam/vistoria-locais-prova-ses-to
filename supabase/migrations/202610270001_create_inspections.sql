-- Schema de referência para o Sistema de Vistoria de Locais de Prova — SES/TO
create table if not exists public.inspections (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  inspection_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inspections enable row level security;

grant select, insert, update, delete on public.inspections to authenticated;

drop policy if exists "Users can view their own inspections" on public.inspections;
create policy "Users can view their own inspections"
  on public.inspections for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own inspections" on public.inspections;
create policy "Users can insert their own inspections"
  on public.inspections for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own inspections" on public.inspections;
create policy "Users can update their own inspections"
  on public.inspections for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own inspections" on public.inspections;
create policy "Users can delete their own inspections"
  on public.inspections for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists inspections_user_updated_idx
  on public.inspections (user_id, updated_at desc);
