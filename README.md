# CA360

Web-based practice-management software for a multi-branch Chartered Accountant firm in India.

**Phase 1 (current):** ITR filing tracker — clients, multi-year filings, encrypted client portal credentials, document storage, role-based access control.

**Future phases:** GST module → TDS module → ROC module.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS v4 + Vite |
| Backend | NestJS (Node.js) + Prisma ORM |
| Database | PostgreSQL 15 |
| Auth | JWT access tokens + mandatory TOTP 2FA |
| Password hashing | Argon2id |
| Encryption (at rest) | AES-256-GCM with per-firm derived keys |
| File storage (v1) | Local filesystem, abstracted so S3 can plug in later |
| Deployment target | Ubuntu 24.04 LTS VPS (DigitalOcean Mumbai) |

---

## Repo Layout

```
CA360/
├── backend/              NestJS API server
├── frontend/             React + Vite dashboard
├── docker-compose.yml    OPTIONAL — run Postgres in Docker (see notes below)
├── .env.example          Template for /backend/.env
├── .gitignore
└── README.md             you are here
```

---

## Prerequisites

Install these on your local machine before first run:

| Tool | Recommended version | How to install (Windows) |
|---|---|---|
| Node.js | 20 LTS or newer | https://nodejs.org/ (LTS installer) |
| PostgreSQL | 15 | `winget install -e --id PostgreSQL.PostgreSQL.15` (run PowerShell as Admin) |
| Git | any recent | https://git-scm.com/ |

When the Postgres installer asks, set a password for the `postgres` superuser and remember it — you'll need it for the next step.

---

## First-Time Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/steven-patrick18/CA360.git
cd CA360
```

### 2. Create the application database and user

Open SQL Shell (psql) — installed with Postgres — and log in as the `postgres` superuser. Then run:

```sql
CREATE USER ca360 WITH PASSWORD 'ca360_dev_password';
CREATE DATABASE ca360 OWNER ca360;
GRANT ALL PRIVILEGES ON DATABASE ca360 TO ca360;
```

Replace `ca360_dev_password` with whatever you want (local dev only — production uses environment variables).

### 3. Configure environment variables

```bash
cp .env.example backend/.env
```

Open `backend/.env` and fill in:
- `DATABASE_URL` — replace `CHANGE_ME` with the password you set in step 2
- `JWT_SECRET` — generate a random 64-byte base64 string (instructions in the file)
- `MASTER_ENCRYPTION_KEY` — generate a random 32-byte base64 string (instructions in the file)
- Seed admin credentials — defaults are fine for development

### 4. Install backend dependencies and run the first migration

```bash
cd backend
npm install
npx prisma migrate dev --name init
npm run seed       # creates the initial firm + Managing Partner user
```

### 5. Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 6. Start both dev servers (in two terminals)

**Terminal 1 (backend):**
```bash
cd backend
npm run start:dev
```
API at `http://localhost:3000`.

**Terminal 2 (frontend):**
```bash
cd frontend
npm run dev
```
Dashboard at `http://localhost:5173`.

Vite is configured with `host: true`, so the dashboard is also reachable from any device on your LAN at `http://<your-laptop-IP>:5173`. Find your LAN IP with `ipconfig` (look for "IPv4 Address" under your active adapter).

### 7. Log in

- Email: `admin@ca360.local` (or whatever you set in `.env`)
- Password: `Admin@12345`
- 2FA: scan the QR code shown on first login with Google Authenticator / Authy

---

## Optional: Use Docker for Postgres instead

`docker-compose.yml` at the root runs Postgres 15 in a container. To switch to it:

1. Install Docker Desktop for Windows.
2. Stop the native Postgres service: open `services.msc`, find `postgresql-x64-15`, click Stop.
3. Run: `docker compose up -d`
4. Update `DATABASE_URL` in `backend/.env` to use `ca360:ca360_dev@localhost:5432/ca360`.

---

## Roles (RBAC)

| Role | Sees | Edits | Files | Manages users |
|---|---|---|---|---|
| Managing Partner | All branches | All | Yes | Yes |
| Partner | All branches | All | Yes | No |
| Branch Head | Own branch | Own branch clients | Yes | Own branch |
| Senior Article | Assigned clients | Assigned clients | With approval | No |
| Article | Assigned clients | Data entry | No | No |
| Accountant | Assigned clients | Data entry | No | No |

Enforced at **two layers** for defense-in-depth:
1. **Application layer** — NestJS guards on every protected endpoint.
2. **Database layer** — PostgreSQL row-level security (RLS) policies.

---

## Build Sequence

| Week | Scope |
|---|---|
| 1 | Project scaffold, auth (login + 2FA), firm/branch/user setup, RLS policies |
| 2 | Client master CRUD, encrypted credentials, Excel import flow, audit log |
| 3 | ITR filings table, multi-year tracking, status pipeline, dashboard |
| 4 | Reports, search/filter, Excel export, polish, deployment prep |

---

## Deployment (Phase 1 target)

- **Provider:** DigitalOcean (Mumbai region) or similar
- **OS:** Ubuntu 24.04 LTS
- **Spec:** 2 vCPUs, 4 GB RAM, 80 GB SSD (sufficient for 500 clients)
- **Process manager:** PM2 or systemd
- **Reverse proxy:** Caddy (auto-HTTPS via Let's Encrypt)
- **Backups:** nightly `pg_dump` + offsite copy

Deployment steps documented separately in `docs/DEPLOY.md` (added at end of Week 4).

---

## License

Proprietary — internal firm use only.
