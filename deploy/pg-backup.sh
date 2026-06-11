#!/bin/sh
# Nightly Postgres backup with rotation for the agent-os + teamly stack.
# Runs as a sidecar container (postgres:16 image → has pg_dump). Dumps each DB
# to a gzip file on the `pgbackups` volume, keeps the last RETAIN days, and
# (optionally) ships a copy offsite when a target is configured.
#
# Honesty: by default this is an ON-HOST rotating backup — it protects against
# DB corruption, an accidental DROP, or losing the Postgres container/volume,
# but NOT against losing the whole host's disk. For true offsite, set
# BACKUP_RSYNC_TARGET (user@host:/path, key-based SSH) — then each dump is also
# rsynced there. Без него бэкап остаётся локальным (честно).
set -eu

PGHOST="${PGHOST:-postgres}"
PGUSER="${POSTGRES_USER:-app}"
RETAIN="${BACKUP_RETAIN_DAYS:-14}"
DIR="${BACKUP_DIR:-/backups}"
DBS="${BACKUP_DBS:-agent_os teamly}"
HOUR="${BACKUP_HOUR:-3}"          # local-time hour to run (0-23)
export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}"

mkdir -p "$DIR"
log(){ echo "[pgbackup $(date -u +%FT%TZ)] $*"; }

run_backup(){
  for db in $DBS; do
    ts=$(date -u +%Y%m%d-%H%M%S)
    out="$DIR/${db}-${ts}.sql.gz"
    log "dump $db -> $out"
    if pg_dump -h "$PGHOST" -U "$PGUSER" -d "$db" 2>/dev/null | gzip -c > "$out.tmp"; then
      mv "$out.tmp" "$out"
      log "ok $(du -h "$out" | cut -f1) $out"
      if [ -n "${BACKUP_RSYNC_TARGET:-}" ]; then
        rsync -a "$out" "$BACKUP_RSYNC_TARGET"/ 2>/dev/null \
          && log "offsite ok $BACKUP_RSYNC_TARGET" \
          || log "offsite FAILED (kept local copy)"
      fi
    else
      rm -f "$out.tmp"
      log "DUMP FAILED for $db"
    fi
  done
  # Rotation: delete dumps older than RETAIN days.
  find "$DIR" -name '*.sql.gz' -type f -mtime +"$RETAIN" -print -delete | while read -r f; do
    log "rotate-remove $f"
  done
  log "current backups:"; ls -1 "$DIR"/*.sql.gz 2>/dev/null | tail -10 || true
}

# Immediate backup on (re)start, then once per day at BACKUP_HOUR.
log "pgbackup started: dbs='$DBS' retain=${RETAIN}d hour=${HOUR} offsite='${BACKUP_RSYNC_TARGET:-none}'"
run_backup
while true; do
  now_h=$(date +%H | sed 's/^0//')
  now_h=${now_h:-0}
  if [ "$now_h" -eq "$HOUR" ]; then
    run_backup
    sleep 3600   # past the trigger hour
  fi
  sleep 600      # check every 10 min
done
