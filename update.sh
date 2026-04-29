#!/usr/bin/env bash
#
# CA360 — pull the latest code and apply it on a server that was already
# set up with install.sh.
#
# Run from inside the cloned repo:
#     cd ~/ca360 && sudo bash update.sh
#
# What it does:
#   1.  Captures the current commit (so you can roll back if needed)
#   2.  git fetch + git pull --ff-only on main
#   3.  npm install in backend + frontend (idempotent)
#   4.  prisma generate + migrate deploy (no-op if no new migrations)
#   5.  Build backend + frontend
#   6.  Publish frontend dist → /var/www/ca360
#   7.  Restart ca360-api systemd service
#
# Safe to run any time. Won't touch backend/.env or your data.
#
# Roll back (in case a deploy is bad):
#     cd ~/ca360
#     git reset --hard <previous-sha-from-the-banner>
#     sudo bash update.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_USER="ca360"
APP_DIR="${REPO_DIR}"
WEB_ROOT="/var/www/ca360"

log()  { echo -e "\n\033[1;36m==> $*\033[0m"; }
warn() { echo -e "\033[1;33m!! $*\033[0m"; }
fail() { echo -e "\033[1;31mxx $*\033[0m"; exit 1; }

[ "$EUID" = 0 ] || fail "Run with sudo: sudo bash update.sh"
[ -f "$REPO_DIR/backend/package.json" ] || fail "Run from the repo root (backend/package.json missing)"
[ -f "$REPO_DIR/backend/.env" ] || fail "backend/.env missing — run install.sh first, not update.sh"

# Make sure the deploy user owns the repo before we run npm/git as them
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ─── 1. Capture rollback target ─────────────────────────────────────
PREV_SHA="$(sudo -u "$APP_USER" -H git -C "$APP_DIR" rev-parse --short HEAD)"
log "Current commit: $PREV_SHA"

# ─── 2. Pull latest ─────────────────────────────────────────────────
log "Pulling latest from origin/main…"
sudo -u "$APP_USER" -H git -C "$APP_DIR" fetch --quiet origin
sudo -u "$APP_USER" -H git -C "$APP_DIR" pull --ff-only origin main

NEW_SHA="$(sudo -u "$APP_USER" -H git -C "$APP_DIR" rev-parse --short HEAD)"
if [ "$PREV_SHA" = "$NEW_SHA" ]; then
  log "Already up to date (commit $NEW_SHA). Skipping rebuild."
  exit 0
fi
log "Updating $PREV_SHA → $NEW_SHA"

# Show what changed (helps diagnose if something breaks)
echo
sudo -u "$APP_USER" -H git -C "$APP_DIR" log --oneline "$PREV_SHA..$NEW_SHA" | head -20
echo

# ─── 3. Backend: install + migrate + build ──────────────────────────
log "Installing backend deps…"
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR/backend' && npm install --no-audit --no-fund"

log "Generating Prisma client + applying migrations…"
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR/backend' && npx --no-install prisma generate"
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR/backend' && npx --no-install prisma migrate deploy"

log "Building backend…"
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR/backend' && npm run build"

# ─── 4. Frontend: install + build + publish ─────────────────────────
log "Installing frontend deps + building…"
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR/frontend' && npm install --no-audit --no-fund"
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR/frontend' && npm run build"

log "Publishing frontend to ${WEB_ROOT}…"
mkdir -p "$WEB_ROOT"
rsync -a --delete "$APP_DIR/frontend/dist/" "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"

# ─── 5. Restart backend ─────────────────────────────────────────────
log "Restarting ca360-api…"
systemctl restart ca360-api
sleep 2
if systemctl is-active --quiet ca360-api; then
  log "ca360-api is running."
else
  warn "ca360-api failed to start. To roll back:"
  warn "    cd $APP_DIR && git reset --hard $PREV_SHA && sudo bash update.sh"
  warn "Check logs:  journalctl -u ca360-api -n 50"
  exit 1
fi

cat <<DONE

──────────────────────────────────────────────────────────────────
  Update complete.
──────────────────────────────────────────────────────────────────

  $PREV_SHA → $NEW_SHA

  If anything looks wrong, roll back with:
    cd $APP_DIR && git reset --hard $PREV_SHA && sudo bash update.sh

──────────────────────────────────────────────────────────────────
DONE
