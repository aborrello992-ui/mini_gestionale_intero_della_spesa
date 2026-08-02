# Deploy privato Gestionale Locale

Procedura sicura per pubblicare il gestionale senza includere credenziali, database SQLite, backup o immagini sensibili nel repository.

## Regole di sicurezza

- Non eseguire `migrate:fresh`, `db:wipe` o comandi che cancellano dati reali.
- Non committare `.env`, file `.sqlite`, backup, log, `vendor`, `node_modules` o build generate.
- Usare variabili ambiente nei pannelli Neon, Supabase, Render e Cloudflare.
- Conservare il database SQLite locale e i backup come sorgente storica di controllo.

## 1. Neon PostgreSQL

Creare un progetto Neon e usare la branch `production`. Su Render impostare:

```env
DB_CONNECTION=pgsql
DB_HOST=<host Neon, preferibilmente pooler>
DB_PORT=5432
DB_DATABASE=<database>
DB_USERNAME=<utente>
DB_PASSWORD=<password Neon>
DB_SSLMODE=require
```

Non salvare la password nel repository.

## 2. Supabase Storage

Creare un bucket per immagini pubbliche o firmate secondo la policy scelta. Per usare Supabase come storage S3-compatible in Laravel impostare su Render:

```env
FILESYSTEM_DISK=local
PUBLIC_FILESYSTEM_DRIVER=s3
PUBLIC_FILESYSTEM_URL=<URL pubblico bucket o CDN>
AWS_ACCESS_KEY_ID=<Supabase access key>
AWS_SECRET_ACCESS_KEY=<Supabase secret key>
AWS_DEFAULT_REGION=<regione Supabase, es. eu-central-1>
AWS_BUCKET=<nome bucket>
AWS_URL=<URL pubblico bucket o CDN>
AWS_ENDPOINT=<endpoint S3 Supabase>
AWS_USE_PATH_STYLE_ENDPOINT=true
```

Le immagini locali in `product-images/` vanno preservate e caricate/importate solo dopo aver configurato il bucket.

## 3. Render per Laravel

Creare un Web Service collegato alla repository. Se il runtime PHP non e disponibile nel menu, usare Docker. Configurazione consigliata:

- Language: `Docker`
- Branch: `main`
- Root directory: `backend`
- Dockerfile path: `Dockerfile`
- Docker command: lasciare vuoto, usa il `CMD` del Dockerfile

Il container avvia Laravel con `php artisan serve --host=0.0.0.0 --port=$PORT`.

Variabili base:

```env
APP_NAME=Gestionale Locale
APP_ENV=production
APP_DEBUG=false
APP_KEY=<generata con php artisan key:generate --show>
APP_URL=<URL Render backend>
FRONTEND_URLS=<URL Cloudflare Pages>
LOG_CHANNEL=stderr
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database
```

Sul piano Free, se Shell/Pre-Deploy Command non sono disponibili, usare le variabili Docker controllate dall'entrypoint:

```env
RUN_MIGRATIONS=true
RUN_REAL_DATA_SEEDER=false
```

Questo esegue solo migrazioni non distruttive (`php artisan migrate --force`) prima dell'avvio. Dopo aver verificato le migrazioni, il seeder reale si abilita temporaneamente con:

```env
RUN_REAL_DATA_SEEDER=true
```

Per importare dati reali usare seeder idempotenti dedicati, mai `migrate:fresh`.

## 4. Cloudflare Pages per React

Creare il progetto Pages collegato alla repository. Configurazione:

- Root directory: `frontend`
- Build command: `npm ci && npm run build`
- Output directory: `dist`

Variabile:

```env
VITE_API_URL=<URL Render backend>/api
```

## 5. Cloudflare Access

Proteggere il dominio Cloudflare Pages con Access:

- Application type: Self-hosted
- Domain: dominio Pages o dominio custom
- Policy: allow solo email autorizzate

Nota: Access protegge il frontend. L'API Laravel deve comunque mantenere autenticazione Sanctum e CORS limitato a `FRONTEND_URLS`.

## Checklist pre-push

- `git status` controllato.
- `.env` e `.sqlite*` ignorati.
- Nessuna credenziale nel codice.
- Test backend eseguiti.
- Build frontend eseguita.
