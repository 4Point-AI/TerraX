-- STEP 7: SIIM deployment requests
create table if not exists public.siim_deployment_requests (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  email text not null,
  created_at timestamp with time zone not null default now()
);

alter table public.siim_deployment_requests enable row level security;

drop policy if exists "Anyone can insert SIIM deployment requests" on public.siim_deployment_requests;

create policy "Anyone can insert SIIM deployment requests"
on public.siim_deployment_requests
for insert
with check (true);

revoke all on table public.siim_deployment_requests from public;
grant insert on table public.siim_deployment_requests to anon;
grant insert on table public.siim_deployment_requests to authenticated;
grant all on table public.siim_deployment_requests to service_role;