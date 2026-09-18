# 📚 Article Hub JP

Je eigen leesarchief: artikelen die je wilt bewaren, opgeslagen als leesbaar "papier",
met markeringen en notities erin. Eén HTML-bestand, je eigen Supabase-project erachter.

**🔗 De app staat live op:**
👉 https://blockionaire.github.io/First-series-of-apps-JP/article-hub/

> Tip: open de link op je telefoon en kies *"Zet op beginscherm"*. Dan staat Article Hub
> als echte app tussen je andere apps en opent hij zonder adresbalk.

---

## Eerste keer: koppelen aan je eigen Supabase

De app komt leeg binnen en vraagt bij het openen om twee dingen. Die vind je in Supabase
onder **Project Settings → API**:

| Veld | Wat je invult |
|---|---|
| Supabase project URL | `https://xxxxxxxx.supabase.co` |
| Anon key (publishable) | de **anon / publishable** sleutel |

Ze worden opgeslagen in de `localStorage` van díe browser — niet in de repository en niet
in dit bestand. Op een nieuw apparaat vul je ze dus opnieuw in. Wil je wisselen van
database, dan kan dat via *Other database* op het inlogscherm, of via *Meer → Account →
Disconnect this browser*.

> ⚠️ Gebruik hier nooit de **service-role** sleutel. Die staat boven alle beveiligingsregels
> en zou via de browser voor iedereen leesbaar zijn. De anon-sleutel hoort publiek te zijn;
> jouw data blijft beschermd door de RLS-regels hieronder.

### Wat je eenmalig in Supabase aanzet

**1. Inloggen** — *Authentication → Providers → Email* aan. Zet *Confirm email* uit als je
direct wilt kunnen inloggen na het aanmaken van een account.

**2. De tabellen.** Plak dit in de SQL Editor en draai het:

```sql
create table folders (
  id         uuid primary key,
  user_id    uuid not null references auth.users on delete cascade,
  name       text,
  parent_id  uuid references folders on delete cascade,
  created_at timestamptz,
  updated_at timestamptz
);

create table articles (
  id           uuid primary key,
  user_id      uuid not null references auth.users on delete cascade,
  title        text,
  publisher    text,
  author       text,
  published_on text,
  url          text,
  body         text,
  status       text,
  folder_id    uuid references folders on delete set null,
  images       jsonb,
  read_at      timestamptz,
  created_at   timestamptz,
  updated_at   timestamptz
);

create table annotations (
  id             uuid primary key,
  user_id        uuid not null references auth.users on delete cascade,
  article_id     uuid references articles on delete cascade,
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
```

`published_on` is bewust **text** en geen `date`: laat je het datumveld leeg, dan stuurt de
app een lege tekst mee en zou een echte datumkolom het artikel weigeren.

**3. Alles achter slot.** Zonder dit kan iedereen met de anon-sleutel bij je artikelen:

```sql
alter table folders     enable row level security;
alter table articles    enable row level security;
alter table annotations enable row level security;

create policy "eigen mappen"      on folders     for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "eigen artikelen"   on articles    for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "eigen markeringen" on annotations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**4. Afbeeldingen.** Maak onder *Storage* een bucket met de naam **`article-images`** en zet
hem op **public** — de app laadt plaatjes via een publieke URL. Uploaden mag alleen jij:

```sql
create policy "eigen upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'article-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "eigen verwijderen" on storage.objects for delete to authenticated
  using (bucket_id = 'article-images' and (storage.foldername(name))[1] = auth.uid()::text);
```

**5. Live meekijken (optioneel).** Zet onder *Database → Replication* de drie tabellen aan
in de `supabase_realtime` publicatie. Dan ziet een tweede geopend tabblad wijzigingen direct.
Zonder dit werkt alles gewoon, maar ververst de app pas als je terugkeert naar het tabblad.

---

## Wat kan de app?

### De bibliotheek
- **Nieuw artikel** met titel, uitgever, auteur, publicatiedatum, bron-URL en de tekst zelf.
  De tekst wordt opgemaakt tot een rustige leespagina in plaats van een muur tekst.
- **Afbeeldingen** invoegen op de plek waar ze horen, met een onderschrift.
- **Mappen en submappen** om je archief te ordenen — slepen mag, en er is een aparte
  weergave voor alles wat nog geen map heeft.
- **Gelezen / ongelezen**: elk artikel houdt zijn status bij en je kunt de lijst erop filteren.
- **Concepten blijven staan.** Sluit je het scherm halverwege, dan biedt de app bij het
  terugkomen *Restore draft* aan.

### Lezen
- **Markeren in kleur** — selecteer tekst en kies een kleur. Een markering die over meerdere
  alinea's loopt blijft één geheel.
- **Notities** bij een markering, achteraf te bewerken.
- Alle markeringen en notities staan onder het artikel bij elkaar in **Highlights & notes**.

### Verder
- **Download PDF** van een artikel, inclusief afbeeldingen.
- **Licht, donker of systeem** als thema.
- **Wachtwoord wijzigen** en uitloggen via *Meer → Account*.

---

## Onder de motorkap

- **Eén bestand:** `index.html`. Geen bouwstap, geen dependencies om te installeren —
  Supabase en de PDF-bibliotheek komen van een CDN.
- **Opslag:** je eigen Supabase-project (Postgres + Storage), afgeschermd per gebruiker
  met Row Level Security.
- **Sleutels:** staan alleen in de `localStorage` van je browser, nooit in deze repository.
- **Hosting:** GitHub Pages, direct vanuit deze repository — elke wijziging die naar de
  `main`-branch wordt gepusht staat binnen een minuut live.
