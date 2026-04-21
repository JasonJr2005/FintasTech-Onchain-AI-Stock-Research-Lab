#!/usr/bin/env bash
# FintasTech - one-command launcher.
# EDUCATIONAL / RESEARCH USE ONLY. NOT INVESTMENT ADVICE.
#
# What it does:
#   1) Creates a Python virtualenv if missing, installs backend deps.
#   2) Installs frontend node deps if missing.
#   3) Starts FastAPI on :8000 and Next.js on :3000 in the background.
#   4) Writes PIDs to .run/ so `./stop.sh` can tidy up.
#   5) Opens http://127.0.0.1:3000 in your default browser (macOS / Linux).
#
# Usage:
#   ./start.sh            # start both servers (idempotent: will stop any
#                         # FintasTech processes we previously started first)
#   ./stop.sh             # stop both servers

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

mkdir -p .run logs data

# Ports (ASCII-only echoes below; macOS /bin/bash 3.2 breaks on "$VAR" + UTF-8 ellipsis).
BACKEND_PORT=8000
FRONTEND_PORT=3000

banner() {
  printf '\n\033[1;35m%s\033[0m\n' "==============================================="
  printf '\033[1;35m FintasTech - Research Lab (paper-trading only)\033[0m\n'
  printf '\033[1;33m EDUCATIONAL USE ONLY. NOT INVESTMENT ADVICE.\033[0m\n'
  printf '\033[1;35m%s\033[0m\n\n' "==============================================="
}

port_in_use() {
  # $1 = port
  if command -v lsof >/dev/null 2>&1; then
    lsof -i ":$1" -sTCP:LISTEN -P -n >/dev/null 2>&1
    return $?
  fi
  # Fallback for Linux boxes without lsof installed.
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :$1 )" 2>/dev/null | grep -q ":$1"
    return $?
  fi
  return 1
}

# Politely stop any FintasTech instance we previously started.
kill_prev() {
  local f="$1"
  if [ -f "$f" ]; then
    local pid
    pid="$(cat "$f" 2>/dev/null || echo "")"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$f"
  fi
}

banner
kill_prev .run/backend.pid
kill_prev .run/frontend.pid

# ---------- Python virtualenv ----------
if [ ! -d ".venv" ]; then
  echo "[1/4] Creating Python virtualenv (.venv)..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

if ! python -c "import fintastech" 2>/dev/null; then
  echo "[1/4] Installing backend dependencies..."
  pip install -q --upgrade pip
  pip install -q -e .
  pip install -q yfinance
fi

# ---------- Frontend deps ----------
if [ ! -d "frontend/node_modules" ]; then
  echo "[2/4] Installing frontend dependencies (this may take a minute)..."
  (cd frontend && npm install --silent)
fi

# ---------- Start backend ----------
if port_in_use "$BACKEND_PORT"; then
  echo "[3/4] Port ${BACKEND_PORT} is already in use."
  echo "      Run ./stop.sh first, or free the port, then retry."
  exit 1
fi
echo "[3/4] Starting FastAPI backend on :${BACKEND_PORT}..."
PYTHONPATH=src nohup uvicorn fintastech.api.main:app \
  --host 127.0.0.1 --port "$BACKEND_PORT" \
  > logs/backend.log 2>&1 &
echo $! > .run/backend.pid

# Wait up to ~15s for /health to come up.
backend_ok=0
for i in $(seq 1 30); do
  if curl -fs "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1; then
    echo "      ok backend healthy"
    backend_ok=1
    break
  fi
  sleep 0.5
done
if [ "$backend_ok" -ne 1 ]; then
  echo "      !! backend failed to come up. See logs/backend.log"
  tail -n 20 logs/backend.log || true
  exit 1
fi

# ---------- Start frontend ----------
if port_in_use "$FRONTEND_PORT"; then
  echo "[4/4] Port ${FRONTEND_PORT} is already in use."
  echo "      Stop the other process or set a different port, then retry."
  exit 1
fi
echo "[4/4] Starting Next.js frontend on :${FRONTEND_PORT}..."
(cd frontend && nohup npm run dev -- --port "$FRONTEND_PORT" \
  > "$ROOT_DIR/logs/frontend.log" 2>&1 &
  echo $! > "$ROOT_DIR/.run/frontend.pid")

# Wait up to ~30s for Next.js to compile the first page.
for i in $(seq 1 60); do
  if curl -fs "http://127.0.0.1:${FRONTEND_PORT}" >/dev/null 2>&1; then
    echo "      ok frontend ready"
    break
  fi
  sleep 0.5
done

printf '\n\033[1;32m%s\033[0m\n' "Ready!  ->  http://127.0.0.1:${FRONTEND_PORT}"
echo "    backend  log -> logs/backend.log"
echo "    frontend log -> logs/frontend.log"
echo "    stop both    -> ./stop.sh"
echo

# Try to open the UI automatically.
if command -v open >/dev/null 2>&1; then
  open "http://127.0.0.1:${FRONTEND_PORT}" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://127.0.0.1:${FRONTEND_PORT}" >/dev/null 2>&1 || true
fi
