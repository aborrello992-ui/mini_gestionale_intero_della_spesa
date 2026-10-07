FROM php:8.4-cli

WORKDIR /var/www/html

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        unzip \
        libpq-dev \
        libzip-dev \
    && docker-php-ext-install pdo pdo_pgsql zip \
    && rm -rf /var/lib/apt/lists/*

# Limiti di caricamento: il default di PHP (2 MB) rifiuta le foto da telefono.
RUN printf "upload_max_filesize=10M\npost_max_size=25M\nmemory_limit=256M\n" > /usr/local/etc/php/conf.d/uploads.ini

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

COPY . .

RUN chmod +x docker-entrypoint.sh \
    && composer dump-autoload --optimize \
    && php artisan package:discover --ansi

# Piu processi PHP in parallelo: il server consegna anche le immagini (link firmati).
ENV PHP_CLI_SERVER_WORKERS=4

EXPOSE 10000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["sh", "-c", "php artisan serve --host=0.0.0.0 --port=${PORT:-10000}"]
