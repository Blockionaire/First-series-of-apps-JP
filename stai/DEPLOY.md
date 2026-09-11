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

## 5. Verify persistence — do this before announcing anything

The single most expensive mistake would be a volume that isn't actually holding
the database. Prove it:

```bash
# 1. Create state
curl -fsS -X POST https://stai.ai/api/newsletter \
  -H 'Content-Type: application/json' -d '{"email":"persistence-check@example.com"}'

# 2. Confirm it is inside the volume, not the container filesystem
docker compose exec app ls -la /data
#    expect: stai.db, stai.db-wal, stai.db-shm

# 3. DESTROY and recreate the container
docker compose down            # containers removed; named volume kept
docker compose up -d
docker compose exec app node -e "
  const D=require('better-sqlite3');
  const d=new D('/data/stai.db',{readonly:true});
  console.log('subscriber survived:', !!d.prepare('SELECT 1 FROM newsletter WHERE email=?')
    .get('persistence-check@example.com'));
"
```

Step 3 must print `true`. If it prints `false`, **stop** — `STAI_DATA_DIR` and
the volume mount disagree and every deploy is destroying user data.

Note `docker compose down -v` deletes the volume. Never use `-v` in production.

## 6. Stripe

1. Live keys into `.env`.
2. Webhook endpoint → `https://stai.ai/api/stripe/webhook`, subscribing to:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `customer.subscription.paused`, `customer.subscription.resumed`,
   `invoice.paid`, `invoice.payment_failed`.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`, then
   `docker compose up -d`.

Until a live key is present, `/plus` shows membership as not yet open and
`/api/checkout` returns 503. There is no sandbox fallback in production.

## 7. Backups

`litestream.yml` is ready but deliberately not wired in — enabling replication
is an explicit decision, not a side effect of deploying.

```bash
# Install Litestream on the host, then point it at the volume:
docker volume inspect stai_stai-data --format '{{ .Mountpoint }}'
# use that path (or run Litestream as a sidecar sharing stai-data)
litestream replicate -config /etc/litestream.yml
```

Snapshot alternative (also inside the volume, so replicate it too):

```bash
docker compose exec app node scripts/backup.mjs /data/backups
```

**Rehearse a restore before you need one:**

```bash
litestream restore -o /tmp/restored.db s3://BUCKET/stai
sqlite3 /tmp/restored.db "PRAGMA integrity_check; SELECT COUNT(*) FROM users;"
```

## 8. Updating

```bash
git pull && docker compose up -d --build
```

Migrations run automatically at startup and are additive — seeding never
overwrites CMS-authored content.
