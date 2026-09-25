# SEO setup — the parts code cannot do

Everything in round 1 is deployed and dormant. Three features wait on a
variable, and each variable waits on something only a person with the account
can do. Nothing here is urgent-or-broken: with none of it done, the site is
exactly as indexable as it was, just without the extra signals.

Do them in this order — it is shortest-path, not preference.

---

## 1. Google Search Console

**Why bother.** It is the only place that tells you which queries reach the
site, which pages Google has actually indexed, and whether the structured data
on the article pages validates. Round 1 added `dateModified` and an `image` to
that structured data; Search Console is where you find out Google accepted
them.

1. Go to <https://search.google.com/search-console> and add a property.
2. Choose **URL prefix** and enter `https://stai-ahead.com`.
   (Not *Domain* — that one needs a DNS record instead, which works too but is
   more steps for no extra benefit here.)
3. Pick the **HTML tag** verification method. It shows you a tag like
   `<meta name="google-site-verification" content="AbC123..." />`.
   Copy only the `content` value.
4. Cloudflare dashboard → Workers & Pages → **stai** → Settings → **Variables
   and Secrets** → add a plain *Variable* (not a Secret):
   `GOOGLE_SITE_VERIFICATION` = the value you copied.
5. Redeploy (any push to `main` does it), then press **Verify** in Search
   Console.
6. Once verified: Sitemaps → submit `sitemap.xml`.

**Leave the tag in place afterwards.** Google re-checks it; removing the
variable un-verifies the property.

---

## 2. Bing Webmaster Tools

**Why bother.** Bing is what Copilot and ChatGPT's browsing both lean on, so
this is less about Bing's own search share and more about whether AI
assistants can find and cite the desk. It is also the dashboard that makes
IndexNow (step 3) observable — it shows what was submitted and what happened.

1. Go to <https://www.bing.com/webmasters> and add `https://stai-ahead.com`.
   If you completed step 1 first, Bing offers to **import from Google Search
   Console**, which verifies in one click and skips the rest of this section.
2. Otherwise choose the **HTML Meta Tag** method and copy the `content` value
   from the `msvalidate.01` tag.
3. Add the Cloudflare variable `BING_SITE_VERIFICATION` = that value, redeploy,
   then press Verify.

---

## 3. IndexNow

**Why bother.** A sitemap waits to be read. IndexNow is a push: when you
publish or edit a piece, the participating engines (Bing, Yandex, Seznam,
Naver — not Google) are told within seconds. For a desk whose value is being
early on a regulatory change, that gap is the product.

1. Generate a key — any 8–128 characters of letters, digits and hyphens:

   ```bash
   openssl rand -hex 16
   ```

2. Add the Cloudflare variable `INDEXNOW_KEY` = that value. Plain Variable, not
   a Secret: it is published deliberately at `/indexnow.txt`, so hiding it in
   the dashboard would only hide it from you.
3. Redeploy, then confirm the proof is live:

   ```bash
   curl https://stai-ahead.com/indexnow.txt
   # should print exactly the key, nothing else
   ```

   A 404 here means the key was rejected as malformed and the feature is off.
   Check it against `[a-zA-Z0-9-]{8,128}`.
4. Publish or re-save any article in `/admin/content`. The save response
   carries an `indexnow` field reporting what happened. Bing Webmaster Tools →
   IndexNow shows the submission within a few minutes.

**What gets submitted:** the article's own URL and its section index (`/news`
or `/insights`). Drafts are never submitted — the URL would 404, and sending
crawlers to a 404 costs the domain credibility for nothing.

**If it fails, nothing breaks.** The submission is bounded by a 3-second
timeout and cannot fail a publish. The sitemap still carries the change; you
just lose the head start.

---

## 4. One thing to check in Cloudflare

Under **Security → Bots** (or Settings → Security, depending on your dashboard
version) there is a **Block AI Scrapers and Crawlers** toggle. If it is on, it
overrides `robots.txt` and blocks the AI assistants this site most wants to be
cited by. Confirm it is off.

---

## 5. Still outstanding, and not an SEO task

`/legal/company` has four required fields that are deliberately empty and can
only be filled from the operator's own registration records: registered legal
name, KVK number, business address, contact email. They live in
`src/lib/company.ts`.

Until the legal name is filled in, the Organization structured data publishes
no `legalName` at all. That is the correct behaviour — round 1 removed the
slogan that used to sit in that field — but it does mean search engines and AI
assistants have no registered entity to attribute the site to.
