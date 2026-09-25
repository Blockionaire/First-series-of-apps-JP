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

**2. De tabellen.** Alles staat klaar in [`supabase-setup.sql`](supabase-setup.sql) — plak
de inhoud daarvan in de SQL Editor en draai het in één keer. Dat maakt drie tabellen aan:

| Tabel | Waarvoor |
|---|---|
| `hub_folders` | je mappen, met submappen |
| `hub_articles` | de artikelen zelf, inclusief sterren |
| `hub_annotations` | markeringen en notities |

Alles heet `hub_*` zodat dit project ook je andere apps kan herbergen zonder dat de namen
botsen — `goals_` en `ovs_` doen hetzelfde. Het script is veilig om nog eens te draaien:
het gebruikt overal `if not exists`.

`published_on` is bewust **text** en geen `date`: laat je het datumveld leeg, dan stuurt de
app een lege tekst mee en zou een echte datumkolom het artikel weigeren.

**3. Alles achter slot.** Zonder dit kan iedereen met de anon-sleutel bij je artikelen:

```sql
alter table public.hub_folders     enable row level security;
alter table public.hub_articles    enable row level security;
alter table public.hub_annotations enable row level security;

create policy "eigen mappen" on public.hub_folders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "eigen artikelen" on public.hub_articles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "eigen markeringen" on public.hub_annotations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**4. Waar de mails naartoe wijzen.** Ga naar *Authentication → URL Configuration* en zet
onder **Redirect URLs** deze regel erbij:

```
https://blockionaire.github.io/First-series-of-apps-JP/article-hub/**
```

Dat is een toelatingslijst: er iets aan toevoegen kan niets stukmaken.

> ⚠️ **Laat Site URL met rust** als dit project ook je andere apps bedient. Die instelling
> geldt voor het hele project, en apps die geen eigen adres meesturen — Goals doet dat niet —
> sturen hun bevestigings- en herstelmails juist naar die Site URL. Verzet je hem, dan komen
> die mails bij Article Hub uit. Article Hub stuurt zowel bij registreren als bij wachtwoord
> herstellen zijn eigen adres mee, en heeft Site URL dus niet nodig.

**5. Afbeeldingen.** Maak onder *Storage* een bucket met de naam **`article-images`** en zet
hem op **public** — de app laadt plaatjes via een publieke URL. Uploaden mag alleen jij:

```sql
create policy "eigen upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'article-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "eigen verwijderen" on storage.objects for delete to authenticated
  using (bucket_id = 'article-images' and (storage.foldername(name))[1] = auth.uid()::text);
```

**6. Live meekijken (optioneel).** Zet onder *Database → Replication* de drie `hub_`-tabellen aan
in de `supabase_realtime` publicatie. Dan ziet een tweede geopend tabblad wijzigingen direct.
Zonder dit werkt alles gewoon, maar ververst de app pas als je terugkeert naar het tabblad.

---

## Wat kan de app?

### De bibliotheek
- **Nieuw artikel** met titel, uitgever, auteur, publicatiedatum, bron-URL en de tekst zelf.
  De tekst wordt opgemaakt tot een rustige leespagina in plaats van een muur tekst.
- **Afbeeldingen** invoegen op de plek waar ze horen, met een onderschrift.
- **Opmaak binnen een regel**: `**vet**`, `*cursief*` en `__onderstreept__`. Selecteer de
  woorden en druk **Ctrl/⌘ + B, I of U** — nog een keer dezelfde toets haalt het er weer af.
  De markeringstekens verdwijnen uit de leestekst, dus je markeringen en notities blijven
  op dezelfde woorden staan.
- **Formulier en artikel scrollen los van elkaar** op een breed scherm: scrol je door het
  artikel, dan blijft het formulier links staan waar het stond, en andersom.
- **Mappen en submappen** om je archief te ordenen — slepen mag, en er is een aparte
  weergave voor alles wat nog geen map heeft.
- **Gelezen / ongelezen**: elk artikel houdt zijn status bij en je kunt de lijst erop filteren.
- **Beoordelen met sterren**: geef elk artikel 1 tot 5 sterren, vanuit de lijst of vanuit het
  leesscherm. Dezelfde ster nog eens aantikken wist de beoordeling. Met het filter ernaast
  haal je eruit wat je goed vond (★★★★ en hoger), wat juist niet (★★ en lager), of wat je
  nog niet beoordeeld hebt.
- **Sorteren** op nieuwste, oudste, hoogst beoordeeld of laagst beoordeeld. Artikelen zonder
  oordeel staan altijd achteraan — ook bij *laagst beoordeeld*, want geen oordeel is iets
  anders dan een slecht oordeel.
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
- **Wachtwoord vergeten?** Op het inlogscherm vul je je mailadres in en tik je op
  *Forgot your password?*. Je krijgt een mail; die link brengt je terug in de app op een
  scherm waar je meteen een nieuw wachtwoord kiest. Werkt de link niet meer, dan zegt de
  app dat hij verlopen is in plaats van je op een leeg scherm achter te laten.

---

## Onder de motorkap

- **Eén bestand:** `index.html`. Geen bouwstap, geen dependencies om te installeren —
  Supabase en de PDF-bibliotheek komen van een CDN.
- **Opslag:** je eigen Supabase-project (Postgres + Storage), afgeschermd per gebruiker
  met Row Level Security.
- **Sleutels:** staan alleen in de `localStorage` van je browser, nooit in deze repository.
- **Hosting:** GitHub Pages, direct vanuit deze repository — elke wijziging die naar de
  `main`-branch wordt gepusht staat binnen een minuut live.
