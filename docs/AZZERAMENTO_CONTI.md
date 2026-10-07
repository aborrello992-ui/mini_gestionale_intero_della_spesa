# Azzeramento dei conti al 05/10/2026 ore 19:34

Si riparte dall'inserimento della spesa da **45,52 €** del 05/10/2026 alle **19:34**.
Tutto ciò che è stato inserito da quel momento a oggi resta valido: la spesa, i prelievi pagati e
a coppone, i pagamenti dei debiti, i movimenti di cassa, le quantità dei prodotti e i saldi dei
soci. Per questo il saldo di cassa resta **negativo**, finché non si versano soldi.

Il comando `locale:reset-accounts` **non cancella nulla**. Fa due cose:

- segna come archiviati (`archived_at`) i record **inseriti prima** delle 19:34 del 5/10 (ora
  italiana);
- crea **un solo** movimento di apertura cassa, alle 05/10/2026 19:34.

Tabelle archiviate, in base al momento di inserimento (`created_at`): `cash_movements`,
`member_debts`, `debt_payments`, `withdrawals`, `restock_sessions`, `inventory_movements`. Per
`inventory_movements` si archivia solo lo storico: **le quantità dei prodotti non cambiano**.

I record archiviati spariscono da saldo cassa, debiti, crediti, contatori, liste e classifiche.
Restano consultabili in **Gestione › Archivio**, in sola lettura. Prodotti, utenti, PIN e categorie
non vengono toccati.

## Prima di iniziare

1. Fai il deploy di questo branch. Le nuove migrazioni sono additive e partono da sole
   (`RUN_MIGRATIONS=true`).
2. **Backup**: su Neon crea una branch di backup del database `production`
   (Console Neon › Branches › Create branch, nome ad es. `backup-prima-azzeramento`).
3. **Saldo di apertura** (`--opening-cash`): sono i soldi in cassa subito prima della spesa delle
   19:34. Se avevi tolto tutti i 185 € prima della spesa, il valore è **0**.

## Passo 1 — Anteprima (non scrive nulla)

Dal computer, nella cartella `backend`, puntando al database reale con le variabili d'ambiente di
Render (da non salvare in file del progetto):

```bash
php artisan locale:reset-accounts --cutoff="2026-10-05 19:34" --opening-cash=0
```

Nell'output controlla queste cose:

- **"Scontrini che RESTANO"**: il primo deve essere quello da 45,52 € del 05/10/2026 19:34. Se non
  c'è, vuol dire che è stato inserito qualche minuto prima delle 19:34. In quel caso anticipa il
  taglio, ad esempio `--cutoff="2026-10-05 19:30"`.
- **"Movimenti cassa che RESTANO"**: devono esserci solo i movimenti dalla spesa in poi.
- **"Saldo cassa prima → dopo"**: il "dopo" è l'apertura più tutte le entrate e le uscite dalla
  spesa in poi.
- I debiti e i crediti dei soci **dopo**.

Se tra i movimenti che restano trovi un movimento da archiviare comunque (ad es. una correzione
inserita più tardi), aggiungi il suo ID:

```bash
php artisan locale:reset-accounts --cutoff="2026-10-05 19:34" --opening-cash=0 --also-archive-cash=ID
```

## Passo 2 — Esecuzione

Con PostgreSQL aggiungi `--backup-done`, dopo aver creato la branch di backup. Il comando chiede di
scrivere `AZZERA`:

```bash
php artisan locale:reset-accounts --cutoff="2026-10-05 19:34" --opening-cash=0 --confirm --backup-done
```

Se lo rilanci una seconda volta, non fa nulla ("già eseguito").

## Passo 3 — Controllo

```bash
php artisan locale:check
```

Deve rispondere "Nessuna incoerenza trovata". Poi, dal telefono, apri **Gestione** e **Gestione ›
Archivio**.

## Se qualcosa non torna: annullare

```bash
php artisan locale:reset-accounts --cutoff="2026-10-05 19:34" --undo --confirm --backup-done
```

Scrivi `ANNULLA`: i record tornano attivi e l'apertura cassa viene archiviata. In alternativa
ripristina la branch di backup di Neon.

## Prova in locale

Con `./avvia-prova.sh` attivo, in un secondo terminale:

```bash
cd backend && DB_CONNECTION=sqlite DB_DATABASE="$PWD/database/prova.sqlite" php artisan locale:reset-accounts --cutoff="2026-10-05 19:34" --opening-cash=0
```
