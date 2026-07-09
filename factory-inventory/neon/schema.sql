-- ============================================================================
--  FACTORY SPARE-PARTS INVENTORY — Neon / PostgreSQL schema
--  Run in Neon Console -> SQL Editor. Idempotent: safe to re-run.
--  Prereq: on the Data API page, enable the Data API + "Use Neon Auth".
--  (The "Grant public schema access" checkbox does the GRANTs below for you;
--   they're included here too so this script is self-contained.)
-- ============================================================================

-- ---------------------------------------------------------------------------
--  ROLES  (Neon doesn't ship Supabase's predefined roles)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='anonymous')     then create role anonymous     nologin; end if;
end $$;

-- ---------------------------------------------------------------------------
--  TABLES
-- ---------------------------------------------------------------------------
create table if not exists public.machines (
  id          text primary key,
  name        text not null,
  type        text not null default 'Machine',
  model       text,
  location    text,
  status      text not null default 'Active',
  created_at  timestamptz not null default now()
);

create table if not exists public.spare_parts (
  id          text primary key,
  name        text not null,
  type        text not null default 'Spare Part',
  model       text,
  stock       integer not null default 0 check (stock >= 0),
  min_stock   integer not null default 0 check (min_stock >= 0),
  bin         text,
  created_at  timestamptz not null default now()
);

create table if not exists public.draw_requests (
  id          bigint generated always as identity primary key,
  part_id     text not null references public.spare_parts(id) on delete cascade,
  qty         integer not null default 1 check (qty > 0),
  mechanic    text,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_draw_requests_created on public.draw_requests (created_at);
create index if not exists idx_draw_requests_part    on public.draw_requests (part_id);

create table if not exists public.part_compatibility (
  id            bigint generated always as identity primary key,
  part_id       text not null references public.spare_parts(id) on delete cascade,
  machine_type  text,
  machine_id    text references public.machines(id) on delete cascade,
  qty_required  integer not null default 1,
  position      text
);

-- ---------------------------------------------------------------------------
--  GRANTS for the Data API's `authenticated` role
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;

-- ---------------------------------------------------------------------------
--  ATOMIC OPERATIONS (exposed by the Data API as /rpc/<name>)
-- ---------------------------------------------------------------------------
create or replace function public.draw_part(
  p_part_id  text,
  p_reason   text,
  p_mechanic text default 'Shift Technician',
  p_qty      integer default 1
)
returns public.spare_parts
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.spare_parts;
begin
  if p_qty is null or p_qty < 1 then raise exception 'INVALID_QTY'; end if;
  select * into v_row from public.spare_parts where id = p_part_id for update;
  if not found then raise exception 'PART_NOT_FOUND'; end if;
  if v_row.stock < p_qty then raise exception 'INSUFFICIENT_STOCK'; end if;
  update public.spare_parts set stock = stock - p_qty where id = p_part_id returning * into v_row;
  insert into public.draw_requests (part_id, qty, mechanic, reason) values (p_part_id, p_qty, p_mechanic, p_reason);
  return v_row;
end; $$;

create or replace function public.adjust_stock(p_part_id text, p_delta integer)
returns public.spare_parts
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.spare_parts;
begin
  update public.spare_parts set stock = greatest(0, stock + coalesce(p_delta,0))
   where id = p_part_id returning * into v_row;
  if not found then raise exception 'PART_NOT_FOUND'; end if;
  return v_row;
end; $$;

grant execute on function public.draw_part(text, text, text, integer) to authenticated;
grant execute on function public.adjust_stock(text, integer)          to authenticated;

-- ---------------------------------------------------------------------------
--  ROW LEVEL SECURITY
--  Internal tool: any signed-in user can read/write everything.
--  (Tighten with auth.user_id() if you later need per-user rules.)
-- ---------------------------------------------------------------------------
alter table public.machines           enable row level security;
alter table public.spare_parts        enable row level security;
alter table public.draw_requests      enable row level security;
alter table public.part_compatibility enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['machines','spare_parts','draw_requests','part_compatibility']
  loop
    execute format('drop policy if exists authenticated_all on public.%I;', tbl);
    execute format('create policy authenticated_all on public.%I for all to authenticated using (true) with check (true);', tbl);
  end loop;
end$$;

-- ---------------------------------------------------------------------------
--  SEED DATA
-- ---------------------------------------------------------------------------
insert into public.machines (id, name, type, model, location, status) values
  ('PAC-M-0031', 'Juki Single Needle Lockstitch', 'Machine', 'DDL-8700N', 'Line 3', 'Active'),
  ('PAC-M-0055', 'Kansai Special Double Needle',  'Machine', 'FX-4404',   'Line 5', 'Active'),
  ('PAC-M-0061', 'Pegasus Overlock Serger',       'Machine', 'M900',      'Line 2', 'Active')
on conflict (id) do nothing;

insert into public.spare_parts (id, name, type, model, stock, min_stock, bin) values
  ('DBx1-14',   'Needle DBx1 #14',      'Spare Part', 'Universal SNLS',   22, 20, 'A-01-3'),
  ('BC-8700',   'Bobbin Case DDL-8700', 'Spare Part', 'Juki 8700 Series',  6,  8, 'B-02-1'),
  ('LP-M900-U', 'Upper Looper',         'Spare Part', 'Pegasus M900',      2,  4, 'D-01-1')
on conflict (id) do nothing;

-- After running: Data API page -> "Refresh schema cache" so the REST
-- endpoints and /rpc/draw_part, /rpc/adjust_stock become available.
