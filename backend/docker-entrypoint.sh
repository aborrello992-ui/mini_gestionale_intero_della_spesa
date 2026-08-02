#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
    php artisan migrate --force
fi

if [ "$RUN_REAL_DATA_SEEDER" = "true" ]; then
    php artisan db:seed --class=RealLocaleDataSeeder --force
fi

exec "$@"
