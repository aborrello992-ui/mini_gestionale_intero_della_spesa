#!/bin/sh
# Avvia il gestionale in PROVA su una copia del database (i dati veri non vengono toccati).
#   ./avvia-prova.sh          usa la copia di prova esistente (la crea la prima volta)
#   ./avvia-prova.sh --nuova  riparte da una copia fresca del database
# Per fermare tutto: Ctrl+C
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
COPY="$ROOT/backend/database/prova.sqlite"

if [ ! -f "$COPY" ] || [ "$1" = "--nuova" ]; then
  cp "$ROOT/backend/database/database.sqlite" "$COPY"
  echo "Creata copia di prova del database: $COPY"
fi

IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
[ -z "$IP" ] && IP="localhost"

export DB_CONNECTION=sqlite
export DB_DATABASE="$COPY"
export FRONTEND_URLS="http://localhost:5173,http://$IP:5173"

(cd "$ROOT/backend" && php artisan migrate --force)

# Alla chiusura (Ctrl+C) ferma anche il backend.
trap 'kill 0' EXIT INT TERM

(cd "$ROOT/backend" && php artisan serve --host=0.0.0.0 --port=8010 >/dev/null 2>&1) &

echo ""
echo "  Computer: http://localhost:5173"
echo "  Telefono (stesso Wi-Fi): http://$IP:5173"
echo "  Per fermare: Ctrl+C"
echo ""

cd "$ROOT/frontend" && VITE_API_URL="http://$IP:8010/api" npx vite --host --port 5173 --strictPort --open
