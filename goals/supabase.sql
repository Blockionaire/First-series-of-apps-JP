-- =====================================================================
-- GOALS — the database
-- =====================================================================
-- Paste this whole file into Supabase → SQL Editor → New query and
-- press Run. It is safe to run twice.
--
-- One table, one row per document, exactly the shape the app already
-- keeps on the device:
--
--     user_id | collection | id | data (jsonb) | updated | deleted
--
-- A goal, a milestone, a logged run and a note are all rows here; the
-- `collection` column says which is which. The app syncs whole
-- documents and settles conflicts by `updated` (last write wins), so
-- this is the shape that matches it — and jsonb is still queryable:
--
--     select data->>'title' from records where collection = 'goals';
--
-- `deleted` is a tombstone. Without it, a device that was offline when
-- you deleted something would cheerfully put it back.
-- =====================================================================

create table if not exists public.records (
  user_id    uuid    not null references auth.users on delete cascade,
  collection text    not null,
  id         text    not null,
  data       jsonb   not null,
  updated    bigint  not null default 0,
  deleted    boolean not null default false,
  synced_at  timestamptz not null default now(),
  primary key (user_id, collection, id)
);

-- Pulling "everything newer than X" is the only query the app makes.
create index if not exists records_user_updated_idx
  on public.records (user_id, updated);

-- ---------------------------------------------------------------------
-- The part that actually protects your data.
--
-- Row-level security runs at Supabase, not in the browser, so it holds
-- even for someone poking at the API with your public anon key.
-- ---------------------------------------------------------------------
alter table public.records enable row level security;

drop policy if exists "records are private to their owner" on public.records;

create policy "records are private to their owner"
  on public.records
  for all
  to authenticated
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Nobody signed in gets nothing: no policy for the anon role at all.

-- Keep synced_at honest on every write.
create or replace function public.touch_synced_at()
returns trigger
language plpgsql
as $$
begin
  new.synced_at = now();
  return new;
end;
$$;

drop trigger if exists records_touch_synced_at on public.records;

create trigger records_touch_synced_at
  before insert or update on public.records
  for each row execute function public.touch_synced_at();
