# CA360 — Production Deployment Guide

This guide walks you through deploying CA360 to a single Ubuntu 24.04 LTS VPS,
which is sufficient for the Phase 1 scale (≤500 clients, ≤10 staff).

The architecture in production:

```
                    Internet
                       │
                       ▼
          ┌────────────────────────┐
          │   Caddy (port 80/443)  │   auto HTTPS via Let's Encrypt
          └────────┬───────────────┘
                   │
        reverse-proxy /api/* → 127.0.0.1:3000   (NestJS backend, systemd)
        serves      /*       → /var/www/ca360   (Vite static build)
                   │
                   ▼
          ┌────────────────────────┐
          │   PostgreSQL 15        │   localhost only, RLS enforced
          └────────────────────────┘
                   │
                   ▼
                /var/lib/ca360/storage   (uploaded documents)
                /var/backups/ca360       (nightly pg_dump + storage tarball)
```

---

## 1. Provision the VPS

- **Provider:** DigitalOcean (BLR1 / Mumbai region) — closest to Indian users.
- **Image:** Ubuntu 24.04 LTS x64.
- **Size:** Basic Premium AMD, 2 vCPUs / 4 GB RAM / 80 GB SSD (~$24/mo).
- **SSH key:** add yours during droplet creation; do **not** create a password.

After it boots, note the public IPv4 address.

## 2. Point your domain at it

Add an A record in your DNS for the domain you'll use, e.g. `ca360.your-firm.in`,
pointing at the droplet IP. TTL 5 minutes during setup, raise to 1 hour later.

## 3. Initial server setup

SSH in as `root`, then create a non-root user and harden:

```bash
# Create deploy user
adduser ca360
usermod -aG sudo ca360
mkdir -p /home/ca360/.ssh
cp ~/.ssh/authorized_keys /home/ca360/.ssh/
chown -R ca360:ca360 /home/ca360/.ssh
chmod 700 /home/ca360/.ssh
chmod 600 /home/ca360/.ssh/authorized_keys

# Disable root login + password login
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# Firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Automatic security updates
apt update && apt install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

Reconnect as `ca360` from now on.

## 4. Install Node.js, PostgreSQL, Caddy

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 15
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt install -y postgresql-15

# Caddy (auto-HTTPS)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# Verify
node --version    # should be v20.x
psql --version    # should be 15.x
caddy version
```

## 5. Set up the database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER ca360 WITH PASSWORD 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';
CREATE USER ca360_migrator WITH PASSWORD 'ANOTHER_LONG_RANDOM_STRING' CREATEDB BYPASSRLS;
CREATE DATABASE ca360 OWNER ca360;
GRANT ALL PRIVILEGES ON DATABASE ca360 TO ca360;
SQL
```

> **Why a separate `ca360_migrator` user?** Migrations need `CREATEDB` (for
> Prisma's shadow database) and ideally `BYPASSRLS` so they aren't filtered by
> per-firm policies. The runtime app user (`ca360`) has neither — that's what
> keeps a SQL injection from bypassing RLS via a malicious `SET`.

## 6. Pull the code

```bash
sudo mkdir -p /opt/ca360 && sudo chown ca360:ca360 /opt/ca360
cd /opt/ca360
git clone https://github.com/steven-patrick18/CA360.git .
```

## 7. Configure environment

Copy and edit:

```bash
cp .env.example backend/.env.production
nano backend/.env.production
```

Set these (no quotes around values):

```
DATABASE_URL=postgresql://ca360:<runtime-password>@localhost:5432/ca360?schema=public
SHADOW_DATABASE_URL=postgresql://ca360_migrator:<migrator-password>@localhost:5432/postgres?schema=public

NODE_ENV=production
PORT=3000
FRONTEND_URL=https://ca360.your-firm.in

# Generate fresh values:
#   openssl rand -base64 64    →  JWT_SECRET (paste full string)
#   openssl rand -base64 32    →  MASTER_ENCRYPTION_KEY
JWT_SECRET=<long random>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

TOTP_ISSUER=YourFirmName

MASTER_ENCRYPTION_KEY=<32-byte base64>

STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=/var/lib/ca360/storage

SEED_FIRM_NAME=Your CA Firm
SEED_ADMIN_EMAIL=managing.partner@your-firm.in
SEED_ADMIN_PASSWORD=<a strong password you'll use once>
SEED_ADMIN_NAME=Your Name
```

Then prepare the storage directory:

```bash
sudo mkdir -p /var/lib/ca360/storage
sudo chown ca360:ca360 /var/lib/ca360/storage
sudo chmod 700 /var/lib/ca360/storage
```

> **⚠ Production hardening note (deferred from Phase 1):** Update
> `backend/prisma/schema.prisma` to add `shadowDatabaseUrl = env("SHADOW_DATABASE_URL")`
> in the datasource block — and update `prisma/migrations/*/migration.sql` to use a
> session-tx wrapper for true GUC-enforced RLS. These are noted in the README as
> the next pre-prod hardening pass.

## 8. Build & run migrations

```bash
cd /opt/ca360/backend
cp .env.production .env       # Prisma reads .env by default
npm ci --omit=dev
npx prisma migrate deploy     # apply migrations using the runtime user
npm run build                 # compile to dist/
node prisma/seed.ts           # creates the firm + initial admin (one-time)

cd /opt/ca360/frontend
npm ci
npm run build                 # outputs to dist/
sudo mkdir -p /var/www/ca360
sudo cp -r dist/* /var/www/ca360/
sudo chown -R caddy:caddy /var/www/ca360
```

> **`prisma migrate deploy` vs `migrate dev`:** `deploy` is the production
> command — it applies pending migrations without trying to create a shadow
> database, so it works fine under the runtime user.

## 9. Backend systemd unit

```bash
sudo tee /etc/systemd/system/ca360-api.service > /dev/null <<'EOF'
[Unit]
Description=CA360 API (NestJS)
After=network.target postgresql.service

[Service]
Type=simple
User=ca360
WorkingDirectory=/opt/ca360/backend
EnvironmentFile=/opt/ca360/backend/.env
ExecStart=/usr/bin/node dist/src/main.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/ca360/storage
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now ca360-api
sudo systemctl status ca360-api      # should be "active (running)"
```

Verify the API responds locally:

```bash
curl http://127.0.0.1:3000/api      # → "Hello World!" (the health route)
```

## 10. Caddy reverse-proxy + auto-HTTPS

Replace `/etc/caddy/Caddyfile` with:

```caddyfile
ca360.your-firm.in {
    encode gzip

    # API → NestJS
    handle /api/* {
        reverse_proxy 127.0.0.1:3000
    }

    # Static frontend
    handle {
        root * /var/www/ca360
        try_files {path} /index.html
        file_server
    }

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }

    log {
        output file /var/log/caddy/access.log
    }
}
```

Reload Caddy:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy will fetch a Let's Encrypt cert automatically. Visit
`https://ca360.your-firm.in` — you should see the login page.

## 11. Nightly backups

```bash
sudo tee /usr/local/bin/ca360-backup.sh > /dev/null <<'EOF'
#!/bin/bash
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=/var/backups/ca360
mkdir -p "$BACKUP_DIR"

# Database (custom format — fastest restore)
sudo -u postgres pg_dump -Fc -d ca360 -f "$BACKUP_DIR/ca360-$TS.dump"

# Uploaded documents (incremental tarball)
tar -czf "$BACKUP_DIR/storage-$TS.tar.gz" -C /var/lib/ca360 storage

# Keep last 14 days only
find "$BACKUP_DIR" -type f -mtime +14 -delete
EOF
sudo chmod +x /usr/local/bin/ca360-backup.sh

# 02:30 every night
echo "30 2 * * * root /usr/local/bin/ca360-backup.sh" | sudo tee /etc/cron.d/ca360-backup
```

> **Off-site copy:** in production you should also rsync `/var/backups/ca360`
> to S3 / Backblaze B2 / another VPS daily. A dropped database without an
> off-site backup is firm-ending.

## 12. First login

1. Open `https://ca360.your-firm.in`.
2. Sign in with the seed admin credentials from step 7.
3. Scan the QR with Google Authenticator / Authy.
4. Go to **Users** → add your team. Each one gets a one-time temp password
   to share with them.
5. Go to **Branches** → create branches as needed.
6. Go to **Clients** → **Import** → upload your existing client list as
   Excel.

## 13. Updating to a new version

```bash
cd /opt/ca360
git pull origin main

cd backend
npm ci --omit=dev
npx prisma migrate deploy
npm run build
sudo systemctl restart ca360-api

cd ../frontend
npm ci
npm run build
sudo cp -r dist/* /var/www/ca360/
```

## 14. Operational checklist (one-time per firm)

- [ ] DNS A record points at the droplet
- [ ] HTTPS works (`https://ca360.your-firm.in` shows a valid lock icon)
- [ ] `systemctl status ca360-api` is active
- [ ] `psql -U ca360 -h localhost` connects with runtime password
- [ ] You can log in as the seeded admin
- [ ] 2FA enrolled
- [ ] At least one extra Managing Partner exists (so you can't lose access)
- [ ] Nightly backup ran successfully (`ls /var/backups/ca360`)
- [ ] Off-site backup destination configured

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `502 Bad Gateway` on /api | API not running | `sudo systemctl status ca360-api`, check `journalctl -u ca360-api -n 100` |
| Certificate not issuing | DNS not propagated yet | Wait 5 min, then `sudo systemctl reload caddy` |
| Login works but every request 401 | JWT secret changed | All sessions invalidated — re-login is correct behavior |
| Migration fails with "permission denied" | Wrong DB user | Use `ca360_migrator` for migrations, not `ca360` |
| Out-of-memory during build | Default 1 GB swap is tight | `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |

---

## Disaster recovery drill (run quarterly)

1. Spin up a fresh droplet.
2. Install Postgres + Node only.
3. `pg_restore -d <fresh-db> /path/to/latest.dump`.
4. Untar the storage backup into `/var/lib/ca360/storage`.
5. Set `DATABASE_URL` to the fresh DB and start the API.
6. Confirm clients/filings/documents are intact.
7. Tear down the test droplet.

If this drill fails, fix the gap in your backup process now — not when production is on fire.
