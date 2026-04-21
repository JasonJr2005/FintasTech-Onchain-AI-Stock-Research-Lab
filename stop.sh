#!/usr/bin/env bash
# Stop FastAPI + Next.js processes started by ./start.sh
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

stop_pid() {
  local pidfile="$1" label="$2"
  if [ -f "$pidfile" ]; then
    local pid
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 0.3
      kill -9 "$pid" 2>/dev/null || true
      echo "stopped $label (pid $pid)"
    fi
    rm -f "$pidfile"
  fi
}

stop_pid .run/backend.pid  "backend"
stop_pid .run/frontend.pid "frontend"

# Belt-and-suspenders: kill leftovers matching our commands.
pkill -f "uvicorn fintastech.api.main:app" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true

echo "done."
