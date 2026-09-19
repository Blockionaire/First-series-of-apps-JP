-- =====================================================================
-- GOALS — the database
-- =====================================================================
-- Paste this whole file into Supabase → SQL Editor → New query and
-- press Run. It is safe to run twice.
--
-- Everything here is prefixed `goals_`, because this project may hold
-- other apps: a table called `records` could already belong to one of
-- them, and `create table if not exists` would then quietly do nothing
-- while this app wrote into their rows.
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

create table if not exists public.goals_records (
  user_id    uuid    not null references auth.users on delete cascade,
  collection text    not null,
  id         text    not null,
  data       jsonb   not null,
  updated    bigint  not null default 0,
  deleted    boolean not null default false,
  primary key (user_id, collection, id)
);

-- Pulling "everything newer than X" is the only query the app makes.
create index if not exists goals_records_user_updated_idx
  on public.goals_records (user_id, updated);

-- ---------------------------------------------------------------------
-- The part that actually protects your data.
--
-- Row-level security runs at Supabase, not in the browser, so it holds
-- even for someone poking at the API with your public anon key.
-- ---------------------------------------------------------------------
alter table public.goals_records enable row level security;

drop policy if exists "goals records are private to their owner" on public.goals_records;

create policy "goals records are private to their owner"
  on public.goals_records
  for all
  to authenticated
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Nobody signed in gets nothing: no policy for the anon role at all.
