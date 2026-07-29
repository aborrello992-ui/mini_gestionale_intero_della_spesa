# Gestionale Locale

Web app MVP per gestire prodotti condivisi, prelievi, acquisti, lista della spesa e cassa comune di un piccolo locale.

## Stack

- Backend: Laravel 13, PHP, API REST, Laravel Sanctum, SQLite.
- Frontend: React, Vite, JavaScript, Bootstrap, Axios, React Router.
- Database predisposto per una futura migrazione a MySQL/PostgreSQL usando migrazioni Laravel e tipi `decimal`/interi per denaro.

## Funzionalita MVP

- Login/logout con token Sanctum.
- Ruoli `admin` e `member`, controllati lato backend.
- Dashboard con saldo cassa, prodotti attivi, sottoscorta, esauriti e ultimi movimenti.
- Prodotti, categorie e posizioni.
- Prelievo rapido con blocco dello stock negativo.
- Registrazione acquisti transazionale con incremento stock, prezzi aggiornati, movimenti magazzino e uscita cassa.
- Cassa basata su movimenti, senza saldo modificabile manualmente.
- Lista della spesa con prevenzione duplicati attivi.
- Storico movimenti con paginazione backend.
- Gestione utenti admin.
- Seed di sviluppo realistici.

## Credenziali sviluppo

```text
Admin
email: admin@locale.test
password: password

Membro
email: membro1@locale.test
password: password
```

Queste credenziali sono solo per sviluppo locale.

## Avvio backend

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
touch database/database.sqlite
php artisan migrate:fresh --seed
php artisan serve
```

Il backend sara disponibile su `http://localhost:8000`.

## Avvio frontend

In un secondo terminale:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Il frontend sara disponibile su `http://localhost:5173`.

## Test e controlli

Backend:

```bash
cd backend
php artisan test
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Note architetturali

- La modifica dello stock passa da `InventoryService`.
- Gli acquisti passano da `PurchaseService` e usano transazioni database.
- Il saldo cassa e i movimenti passano da `CashService`.
- Gli importi sono salvati in centesimi (`amount_cents`, `total_cents`, prezzi).
- Le quantita usano campi `decimal(12,3)`.
- I movimenti non vengono eliminati: gli annullamenti generano movimenti compensativi.
- La registrazione pubblica non e implementata; gli utenti vengono creati da admin o seed.
