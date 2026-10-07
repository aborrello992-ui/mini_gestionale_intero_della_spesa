# Azzeramento dei conti al 5/10/2026

Il comando `locale:reset-accounts` **non cancella nulla**: segna come archiviati (`archived_at`) i
record con data precedente al giorno di taglio e crea **un solo** movimento di apertura cassa
datato al giorno di taglio. Tutto ciò che è dal 5/10 in poi (la spesa da 45,52 €, i prelievi, i
pagamenti, le quantità dei prodotti) resta com'è.

Cosa viene archiviato (data < 5/10/2026, ora italiana):

| Tabella | Data usata |
|---|---|
| `cash_movements` | `movement_date` |
| `member_debts` | `created_at` |
| `debt_payments` | `paid_at` |
| `withdrawals` | `withdrawn_at` |
| `restock_sessions` | `purchased_at` |
| `inventory_movements` | `created_at` (solo storico, **le quantità dei prodotti non cambiano**) |

I record archiviati spariscono da saldo cassa, debiti, crediti, contatori, liste e classifiche e
restano consultabili in **Gestione › Archivio** (sola lettura). Prodotti, utenti, PIN e categorie
non vengono toccati.

## Prima di iniziare

1. Fai il deploy di questo branch: le nuove migrazioni sono additive e partono da sole
   (`RUN_MIGRATIONS=true`).
2. **Backup**: su Neon crea una branch di backup del database `production`
   (Console Neon › Branches › Create branch, da `production`, nome ad es. `backup-2026-10-05`).
   Su SQLite il comando copia da solo il file in `storage/app/backups/`.
3. Decidi il **saldo di apertura** (`--opening-cash`) cioè quanti soldi c'erano in cassa
   la mattina del 5/10, **prima** della spesa da 45,52 €. Il comando non lo inventa.

## Passo 1 — Anteprima (non scrive nulla)

Dal tuo computer, nella cartella `backend`, puntando al database reale con le variabili
d'ambiente (le stesse impostate su Render; non vanno salvate in file del progetto):

```bash
php artisan locale:reset-accounts --cutoff=2026-10-05 --opening-cash=0
```

Controlla nell'output:

- quanti record verranno archiviati per tabella;
- saldo cassa prima → dopo;
- debito prima/dopo per ogni socio;
- l'elenco **"Movimenti cassa che RESTANO"** (dal 5/10 in poi).

**Attenzione al movimento con cui hai tolto i 185 €.** Se lo hai registrato con data 5/10 o
successiva, comparirà tra i movimenti che restano e, dopo l'azzeramento, abbasserebbe di nuovo il
saldo di 185 €. In quel caso annota il suo **ID** e aggiungilo così, per archiviarlo insieme ai
conti vecchi:

```bash
php artisan locale:reset-accounts --cutoff=2026-10-05 --opening-cash=0 --also-archive-cash=ID
```

Ripeti l'anteprima finché il "saldo dopo" è quello che ti aspetti
(apertura + entrate − uscite dal 5/10 in poi).

## Passo 2 — Esecuzione

Aggiungi `--confirm` (e `--backup-done` se il database è PostgreSQL, dopo aver creato la branch di
backup su Neon). Il comando chiede di scrivere `AZZERA`:

```bash
php artisan locale:reset-accounts --cutoff=2026-10-05 --opening-cash=0 --confirm --backup-done
```

Se lo rilanci una seconda volta non fa nulla ("già eseguito").

## Passo 3 — Controllo

```bash
php artisan locale:check
```

Deve rispondere "Nessuna incoerenza trovata". Poi apri **Gestione › Riepilogo** e
**Gestione › Archivio** dal telefono.

## Se qualcosa non torna: annullare

```bash
php artisan locale:reset-accounts --cutoff=2026-10-05 --undo --confirm --backup-done
```

Scrivi `ANNULLA`: i record tornano attivi e l'apertura cassa viene archiviata. In alternativa
ripristina la branch di backup di Neon.

## Dopo l'azzeramento

Lo scontrino da 45,52 € del 5/10, se non è ancora registrato, si inserisce a mano da
**Lista spesa › Registra spesa** con data 05/10/2026 (non dal comando).
