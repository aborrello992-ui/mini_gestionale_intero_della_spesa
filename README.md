# Gestionale Locale

Web app MVP per gestire prodotti condivisi, prelievi, acquisti, lista della spesa e cassa comune di un piccolo locale.

## Stack

- Backend: Laravel 13, PHP, API REST, Laravel Sanctum, SQLite.
- Frontend: React, Vite, JavaScript, Bootstrap, Axios, React Router.
- Database predisposto per una futura migrazione a MySQL/PostgreSQL usando migrazioni Laravel e tipi `decimal`/interi per denaro.

## Funzionalita MVP

- Login/logout con token Sanctum.
- Ruoli `admin` e `member`, controllati lato backend.
- Pagina Prodotti come schermata iniziale, con card prodotto e pulsante `Prendi`.
- Identificazione membri tramite PIN personale di tre cifre, verificato lato backend.
- Prelievo da card con modalita `Pagato` oppure `Coppone`.
- Pagina Debiti con soli membri che hanno copponi aperti.
- Pagamenti parziali o totali dei debiti con entrata in cassa.
- Pagina Cassa con saldo reale, incasso potenziale magazzino e totale copponi da incassare.
- Sezione Gestione per entrate, uscite, spese, accrediti, quote, correzioni e carico prodotto singolo.
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
PIN: 314

Membro
email: luca.manca@locale.test
password: password
PIN: 527

Accesso ospite
http://localhost:5173/guest
```

Queste credenziali e i PIN sono solo per sviluppo locale. I PIN dei membri servono solo per confermare il prelievo.

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

Non eseguire `php artisan migrate:fresh --seed` su un database che contiene dati reali da conservare: cancella e ricrea tutte le tabelle. In quel caso usa `php artisan migrate` e poi `php artisan db:seed` solo se devi reinserire seed controllati.

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

- La modifica dello stock passa da `InventoryService` per le correzioni e da `WithdrawalService` per i prelievi da card.
- Gli acquisti passano da `PurchaseService` e usano transazioni database.
- Il saldo cassa e i movimenti passano da `CashService`.
- I debiti dei membri sono salvati in `member_debts` e collegati al prelievo originale.
- I PIN sono salvati come hash, mai in chiaro.
- I seed reali iniziali caricano Borrello, Luca Manca, Roberto Squeo, Nello Lorusso e Saverio Squeo, saldo iniziale di 22,40 euro, debiti pregressi per 64,30 euro e storico spese gia contabilizzate per 166,07 euro.
- Gli importi sono salvati in centesimi (`amount_cents`, `total_cents`, prezzi).
- Le quantita usano campi `decimal(12,3)`.
- I movimenti non vengono eliminati: gli annullamenti generano movimenti compensativi.
- La registrazione pubblica non e implementata; gli utenti vengono creati da admin o seed.
