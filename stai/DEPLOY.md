# Deploying STAI

Target architecture — deliberately one machine, no orchestration:

```
Internet
  → Caddy        (the only container publishing ports: 80, 443)
  → private Docker network
  → app:3000     (Next.js standalone, no published ports, non-root)
  → /data        (SQLite + WAL on the stai-data volume)
```

## 1. Server

A small EU VPS is enough (Hetzner CX22, Falkenstein or Helsinki).

```bash
# Ubuntu 24.04, as root
apt update && apt upgrade -y
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy        # after installing Docker
curl -fsSL https://get.docker.com | sh
```

**Firewall — only three ports inbound:**

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw enable
```

**SSH hardening** (`/etc/ssh/sshd_config`):

```
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers deploy
X11Forwarding no
MaxAuthTries 3
```

Then `systemctl restart ssh`. Install `fail2ban` for the SSH jail.

Port 3000 is never opened. Docker's `expose:` is network-internal; the app is
reachable only from the Caddy container, by service name.

## 2. DNS

Point `stai.ai` (and `www`) A records at the server IP. Caddy provisions TLS on
first request — nothing else to do.

## 3. Configure

```bash
git clone <repo> /srv/stai && cd /srv/stai/stai
cp .env.example .env
$EDITOR .env        # APP_URL, SITE_DOMAIN, ACME_EMAIL, admin creds, Stripe keys
```

Compose **refuses to start** if `APP_URL`, `SITE_DOMAIN`, `ACME_EMAIL`,
`STAI_ADMIN_EMAIL` or `STAI_ADMIN_PASSWORD` are missing. That is intentional.

## 4. Run

```bash
docker compose up -d --build
docker compose ps            # app must report (healthy)
curl -fsS https://stai.ai/api/health
```

## 5. Verify persistence — the eleven-step proof

Do this before sharing the URL with anyone. It is the one test that cannot be
replaced by reading the compose file: it proves real data written through the
real UI survives a container replacement, a stack restart, and a reboot.

```bash
# ── 1-2. Application starts and reports healthy ───────────────────────────
docker compose ps                 # app must show (healthy)
curl -fsS https://stai.ai/api/health
# expect: {"status":"ok","db":"ok","articles":11}

# ── 3. Admin creates a test content item (through the real API) ───────────
#     Sign in first; this stores the session cookie in /tmp/stai-admin.txt
curl -fsS -c /tmp/stai-admin.txt -X POST https://stai.ai/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$STAI_ADMIN_EMAIL\",\"password\":\"$STAI_ADMIN_PASSWORD\"}"

curl -fsS -b /tmp/stai-admin.txt -X POST https://stai.ai/api/admin/article \
  -H 'Content-Type: application/json' \
  -d '{"slug":"persistence-probe","title":"Persistence probe","dek":"Delete me after launch checks.",
       "category":"News","tags":"probe","author":"STAI Editorial","author_role":"Editorial desk",
       "published_at":"2026-01-01","reading_min":1,"featured":0,"urgency":1,
       "premium":false,"status":"draft","body_md":"Probe."}'
# expect: {"ok":true,"id":<n>}

# ── 4. A test account is created ─────────────────────────────────────────
curl -fsS -X POST https://stai.ai/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"persistence-probe@example.com","password":"probe-password-123",
       "name":"Persistence Probe","firm":"Probe"}'
# expect: {"ok":true}

# Confirm both landed in the volume, not the container filesystem
docker compose exec app ls -la /data     # stai.db, stai.db-wal, stai.db-shm
```

Define the check once and reuse it at every stage:

```bash
probe() {
  docker compose exec -T app node -e "
    const D=require('better-sqlite3');
    const d=new D('/data/stai.db',{readonly:true});
    const a=!!d.prepare(\"SELECT 1 FROM articles WHERE slug='persistence-probe'\").get();
    const u=!!d.prepare(\"SELECT 1 FROM users WHERE email='persistence-probe@example.com'\").get();
    console.log('article:',a,'| account:',u);
    process.exit(a&&u?0:1);
  "
}
```

```bash
# ── 5-6. Recreate ONLY the app container; both records must remain ───────
docker compose up -d --force-recreate app
docker compose ps                 # wait for (healthy)
probe                             # MUST print: article: true | account: true

# ── 7-8. Restart the whole Compose stack; records must remain ────────────
docker compose down               # NEVER pass -v in production: -v deletes the volume
docker compose up -d
probe                             # MUST print: article: true | account: true

# ── 9-11. Reboot the VPS; the stack must return by itself ────────────────
sudo reboot
# wait ~60s, reconnect, then WITHOUT starting anything manually:
docker compose ps                 # must already be Up (healthy) via restart: unless-stopped
curl -fsS https://stai.ai/api/health
probe                             # MUST print: article: true | account: true
```

If any `probe` fails, **stop and do not announce the site**. It means
`STAI_DATA_DIR` and the volume mount disagree and every deploy is destroying
user data. Check `docker compose exec app sh -c 'echo $STAI_DATA_DIR'` reads
`/data`, and that `docker compose config` shows `stai-data:/data` on the app
service.

Clean up afterwards:

```bash
curl -fsS -b /tmp/stai-admin.txt -X POST https://stai.ai/api/admin/article \
  -H 'Content-Type: application/json' -d '{"id":<n>,"slug":"persistence-probe","title":"Persistence probe",
  "dek":"x","category":"News","tags":"probe","author":"STAI Editorial","author_role":"Editorial desk",
  "published_at":"2026-01-01","reading_min":1,"featured":0,"urgency":1,"premium":false,
  "status":"draft","body_md":"Probe."}'
# then remove the probe account from /account, or:
docker compose exec -T app node -e "
  const D=require('better-sqlite3'); const d=new D('/data/stai.db');
  d.prepare(\"DELETE FROM users WHERE email='persistence-probe@example.com'\").run();
  d.prepare(\"DELETE FROM articles WHERE slug='persistence-probe'\").run();
  console.log('probe data removed');"
rm -f /tmp/stai-admin.txt
```

## 6. Payments — frozen

STAI launches free. Do not set `STRIPE_SECRET_KEY`. With it unset:

- `/plus` shows the STAI+ early-access waitlist, not a purchase
- `/api/checkout` returns `503` and can never emit a sandbox URL
- `/api/checkout/sandbox` and `/checkout/sandbox` return `404` in production

See `PAID_LAUNCH_BACKLOG.md` for everything deferred. Do not enable payments
until those blockers are cleared.

## 7. Backups — Litestream, one system

Continuous replication of `/data/stai.db` to EU object storage. Credentials
live on the host, never in the image or the repository.

**One-time setup on the VPS:**

```bash
# 1. Install Litestream
curl -fsSL https://github.com/benbjohnson/litestream/releases/latest/download/litestream-linux-amd64.deb \
  -o /tmp/litestream.deb && sudo dpkg -i /tmp/litestream.deb

# 2. Credentials — root-owned, 0600, OUTSIDE the image and outside git
sudo install -m 600 /dev/null /etc/litestream.env
sudo tee /etc/litestream.env >/dev/null <<'ENV'
LITESTREAM_S3_ENDPOINT=<eu-endpoint>           # e.g. fsn1.your-objectstorage.com
LITESTREAM_S3_BUCKET=<bucket>
LITESTREAM_S3_REGION=<region>                  # e.g. eu-central
LITESTREAM_ACCESS_KEY_ID=<key>
LITESTREAM_SECRET_ACCESS_KEY=<secret>
ENV

# 3. Point Litestream at the real file inside the Docker volume
docker volume inspect stai_stai-data --format '{{ .Mountpoint }}'
#    e.g. /var/lib/docker/volumes/stai_stai-data/_data
sudo cp /srv/stai/stai/litestream.yml /etc/litestream.yml
sudo sed -i "s|/data/stai.db|<mountpoint>/stai.db|" /etc/litestream.yml

# 4. Run it as a service
sudo systemctl enable --now litestream
sudo systemctl status litestream        # must be active (running)
litestream snapshots <mountpoint>/stai.db   # should list a snapshot within a minute
```

**Rehearse the restore before announcing the site.** An untested backup is not
a backup:

```bash
litestream restore -o /tmp/restored.db s3://<bucket>/stai

sqlite3 /tmp/restored.db "PRAGMA integrity_check;"          # expect: ok
sqlite3 /tmp/restored.db "SELECT COUNT(*) FROM users;"      # expect: your real count
sqlite3 /tmp/restored.db "SELECT COUNT(*) FROM articles WHERE status='published';"
sqlite3 /tmp/restored.db "SELECT COUNT(*) FROM early_access;"
rm /tmp/restored.db
```

Record the date of the rehearsal. Repeat it whenever the schema changes.

**Recovery, if you ever need it:**

```bash
docker compose down
sudo rm -f <mountpoint>/stai.db*
sudo litestream restore -o <mountpoint>/stai.db s3://<bucket>/stai
docker compose up -d && curl -fsS https://stai.ai/api/health
```

Do not also run `scripts/backup.mjs` on a schedule. One backup system, off the
server, tested.

## 8. Updating

```bash
git pull && docker compose up -d --build
```

Migrations run automatically at startup and are additive — seeding never
overwrites CMS-authored content.
