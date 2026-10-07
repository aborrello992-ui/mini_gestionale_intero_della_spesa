#!/bin/sh
set -e

# Serve le immagini quando il disco public e locale (con Supabase non serve, ma non fa danni).
php artisan storage:link --force >/dev/null 2>&1 || true

if [ "$RUN_MIGRATIONS" = "true" ]; then
    php artisan migrate --force
fi

if [ "$RUN_REAL_DATA_SEEDER" = "true" ]; then
    php artisan db:seed --class=RealLocaleDataSeeder --force
fi

exec "$@"
