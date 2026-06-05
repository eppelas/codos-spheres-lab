#!/bin/zsh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_PORT=5174
MAX_PORT=5199
LOG_DIR="$PROJECT_DIR/.preview"

mkdir -p "$LOG_DIR"
cd "$PROJECT_DIR"

has_listener() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

is_this_project() {
  curl -fsS "http://127.0.0.1:$1/" 2>/dev/null | grep -q "Codos Spheres Lab"
}

find_port() {
  local port="$DEFAULT_PORT"
  while [[ "$port" -le "$MAX_PORT" ]]; do
    if ! has_listener "$port"; then
      echo "$port"
      return 0
    fi
    if is_this_project "$port"; then
      echo "$port"
      return 0
    fi
    port=$((port + 1))
  done
  echo "No free preview port found in $DEFAULT_PORT-$MAX_PORT" >&2
  return 1
}

wait_for_preview() {
  local port="$1"
  local started
  started="$(date +%s)"
  while true; do
    if is_this_project "$port"; then
      return 0
    fi
    if [[ $(( $(date +%s) - started )) -gt 35 ]]; then
      echo "Preview did not become ready on port $port. See $LOG_DIR/vite-$port.log" >&2
      return 1
    fi
    sleep 0.5
  done
}

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  npm install
fi

PORT="$(find_port)"
LOCAL_URL="http://localhost:$PORT/"
FIREFLY_URL="${LOCAL_URL}firefly"
LOG_FILE="$LOG_DIR/vite-$PORT.log"

if ! is_this_project "$PORT"; then
  echo "Starting Codos Spheres preview on port $PORT..."
  nohup npm run dev -- --port "$PORT" --strictPort > "$LOG_FILE" 2>&1 &
  echo "$!" > "$LOG_DIR/vite-$PORT.pid"
  wait_for_preview "$PORT"
fi

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"

echo ""
echo "Codos Spheres preview is ready:"
echo "Desktop: $LOCAL_URL"
echo "Firefly duplicate: $FIREFLY_URL"
if [[ -n "$LAN_IP" ]]; then
  echo "Mobile/LAN: http://$LAN_IP:$PORT/"
  echo "Mobile/LAN Firefly: http://$LAN_IP:$PORT/firefly"
fi
echo ""

open "$LOCAL_URL"
