-- Article Hub JP — eenmalige inrichting van je Supabase-project.
-- Plak dit in de SQL Editor van je project en draai het in één keer.
-- Daarna nog een paar dingen met de hand, zie onderaan dit bestand.
--
-- Alles heet hier hub_*, zodat dit project ook andere apps kan herbergen
-- zonder dat de namen elkaar in de weg zitten (goals_ en ovs_ doen hetzelfde).

-- ---------------------------------------------------------------- tabellen

create table if not exists public.hub_folders (
  id         uuid primary key,
  user_id    uuid not null references auth.users on delete cascade,
  name       text,
  parent_id  uuid references public.hub_folders on delete cascade,
  created_at timestamptz,
  updated_at timestamptz
);

-- published_on is bewust text en geen date: laat je het datumveld leeg, dan
-- stuurt de app een lege tekst mee en zou een datumkolom het artikel weigeren.
create table if not exists public.hub_articles (
  id           uuid primary key,
  user_id      uuid not null references auth.users on delete cascade,
  title        text,
  publisher    text,
  author       text,
  published_on text,
  url          text,
  body         text,
  status       text,
  rating       smallint check (rating between 1 and 5),
  folder_id    uuid references public.hub_folders on delete set null,
  images       jsonb,
  read_at      timestamptz,
  created_at   timestamptz,
  updated_at   timestamptz
);

create table if not exists public.hub_annotations (
  id             uuid primary key,
  user_id        uuid not null references auth.users on delete cascade,
  article_id     uuid references public.hub_articles on delete cascade,
  block_index    int,
  start_offset   int,
  end_offset     int,
  quote          text,
  color          text,
  note           text,
  para           boolean,
  grp            text,
  note_at        timestamptz,
  note_edited_at timestamptz,
  created_at     timestamptz,
  updated_at     timestamptz
);

create index if not exists hub_articles_user_idx    on public.hub_articles (user_id);
create index if not exists hub_folders_user_idx     on public.hub_folders (user_id);
create index if not exists hub_annotations_user_idx on public.hub_annotations (user_id);
create index if not exists hub_annotations_art_idx  on public.hub_annotations (article_id);

-- ------------------------------------------------------- alles achter slot
-- Zonder dit kan iedereen met je anon-sleutel bij je artikelen.

alter table public.hub_folders     enable row level security;
alter table public.hub_articles    enable row level security;
alter table public.hub_annotations enable row level security;

drop policy if exists "eigen mappen"      on public.hub_folders;
drop policy if exists "eigen artikelen"   on public.hub_articles;
drop policy if exists "eigen markeringen" on public.hub_annotations;

create policy "eigen mappen" on public.hub_folders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "eigen artikelen" on public.hub_articles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "eigen markeringen" on public.hub_annotations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --------------------------------------------------------- afbeeldingen
-- Maak eerst onder Storage een bucket 'article-images' en zet hem op public.
-- Daarna deze twee regels, zodat alleen jij in je eigen map mag schrijven.

drop policy if exists "eigen upload"      on storage.objects;
drop policy if exists "eigen verwijderen" on storage.objects;

create policy "eigen upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'article-images'
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy "eigen verwijderen" on storage.objects for delete to authenticated
  using (bucket_id = 'article-images'
         and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------ met de hand
-- 1. Authentication -> Providers -> Email aanzetten.
-- 2. Authentication -> URL Configuration:
--      Site URL      https://blockionaire.github.io/First-series-of-apps-JP/article-hub/
--      Redirect URLs https://blockionaire.github.io/First-series-of-apps-JP/article-hub/**
--    Zonder dit wijzen de mails naar localhost en loopt 'wachtwoord vergeten' dood.
-- 3. Optioneel, Database -> Replication: zet hub_folders, hub_articles en
--    hub_annotations in de publicatie supabase_realtime voor live meekijken
--    in een tweede tabblad.
