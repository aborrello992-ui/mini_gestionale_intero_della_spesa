<?php

namespace App\Console\Commands;

use App\Models\AccountReset;
use App\Models\User;
use App\Services\AccountResetService;
use App\Support\RestockLine;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use RuntimeException;

/**
 * Azzeramento conti reversibile. Per default e un'anteprima: scrive solo con --confirm.
 */
class ResetAccounts extends Command
{
    protected $signature = 'locale:reset-accounts
        {--cutoff= : Momento di ripartenza in ora italiana: "YYYY-MM-DD HH:MM" oppure YYYY-MM-DD (mezzanotte). Si archivia tutto cio che e stato inserito prima}
        {--opening-cash= : Saldo cassa di apertura in euro (es. 0 oppure 27,40)}
        {--expect-open-debts= : Totale debiti aperti atteso dopo l\'azzeramento in euro (es. 14,40): se non coincide il comando si ferma}
        {--also-archive-cash= : ID di movimenti cassa inseriti dopo il taglio da archiviare comunque (separati da virgola)}
        {--dry-run : Mostra cosa cambierebbe senza scrivere (comportamento predefinito)}
        {--confirm : Esegue davvero l\'azzeramento}
        {--backup-done : Dichiara di aver gia fatto il backup (necessario se il database non e un file SQLite)}
        {--undo : Annulla l\'azzeramento fatto per --cutoff}';

    protected $description = 'Archivia i conti precedenti a una data e riparte da un saldo di apertura (reversibile, nessuna cancellazione)';

    public function handle(AccountResetService $service): int
    {
        $cutoff = trim((string) $this->option('cutoff'));
        if (! preg_match('/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/', $cutoff) || ! strtotime($cutoff)) {
            $this->error('Indica il taglio con --cutoff="YYYY-MM-DD HH:MM" (ora italiana), ad esempio --cutoff="2026-10-05 19:34".');

            return self::FAILURE;
        }

        if ($this->option('undo')) {
            return $this->undo($service, $cutoff);
        }

        if (blank($this->option('opening-cash')) || ! is_numeric(str_replace(',', '.', (string) $this->option('opening-cash')))) {
            $this->error('Indica il saldo di apertura con --opening-cash=<euro>. Il comando non inventa l\'importo: chiedilo a chi tiene la cassa.');

            return self::FAILURE;
        }
        $openingCents = RestockLine::toCents((string) $this->option('opening-cash'));

        $existing = AccountReset::query()->whereDate('cutoff_date', $service->moment($cutoff)->setTimezone(AccountReset::LOCAL_TIMEZONE)->toDateString())->first();
        if ($existing) {
            $this->info("Azzeramento del {$existing->cutoff_date->format('d/m/Y')} già eseguito il {$existing->created_at->format('d/m/Y H:i')}: nessuna modifica.");

            return self::SUCCESS;
        }

        $extraIds = collect(explode(',', (string) $this->option('also-archive-cash')))->map(fn ($id) => (int) trim($id))->filter()->values()->all();
        $preview = $service->preview($cutoff, $openingCents, $extraIds);
        $this->printPreview($cutoff, $preview);

        $debtsAfter = (int) collect($preview['members'])->sum('open_debt_after');
        if (! blank($this->option('expect-open-debts'))) {
            $expected = RestockLine::toCents((string) $this->option('expect-open-debts'));
            if ($expected !== $debtsAfter) {
                $this->error('Debiti aperti dopo l\'azzeramento: '.$this->euro($debtsAfter).', attesi '.$this->euro($expected).'. Nessuna modifica: controlla i prelievi dopo il taglio prima di procedere.');

                return self::FAILURE;
            }
            $this->info('Debiti aperti dopo l\'azzeramento: '.$this->euro($debtsAfter).' come atteso.');
        }

        if (! $this->option('confirm') || $this->option('dry-run')) {
            $this->newLine();
            $this->info('Anteprima (dry-run): nessuna modifica scritta. Per eseguire aggiungi --confirm.');

            return self::SUCCESS;
        }

        $backup = $this->backup();
        if ($backup === false) {
            return self::FAILURE;
        }

        if ($this->ask('Scrivi AZZERA per confermare') !== 'AZZERA') {
            $this->warn('Conferma non ricevuta: nessuna modifica.');

            return self::FAILURE;
        }

        $admin = User::query()->where('role', User::ROLE_ADMIN)->where('is_active', true)->orderBy('id')->first();
        if (! $admin) {
            $this->error('Nessun amministratore attivo trovato.');

            return self::FAILURE;
        }

        try {
            $reset = $service->execute($cutoff, $openingCents, $admin, $backup, $extraIds);
        } catch (RuntimeException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info("Azzeramento eseguito. Apertura cassa #{$reset->opening_cash_movement_id} di ".$this->euro($openingCents).'.');
        $this->info('Per controllare: php artisan locale:check');

        return self::SUCCESS;
    }

    private function undo(AccountResetService $service, string $cutoff): int
    {
        if (! $this->option('confirm')) {
            $this->info("Anteprima: verrebbe annullato l'azzeramento del {$service->label($cutoff)}. Aggiungi --confirm per eseguire.");

            return self::SUCCESS;
        }
        if ($this->backup() === false) {
            return self::FAILURE;
        }
        if ($this->ask('Scrivi ANNULLA per confermare') !== 'ANNULLA') {
            $this->warn('Conferma non ricevuta: nessuna modifica.');

            return self::FAILURE;
        }

        try {
            $service->undo($cutoff);
        } catch (RuntimeException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
        $this->info('Azzeramento annullato: i record archiviati sono di nuovo attivi.');

        return self::SUCCESS;
    }

    /** Copia il file SQLite prima di scrivere. Restituisce il percorso, null se dichiarato fatto a mano, false se impossibile. */
    private function backup(): string|null|false
    {
        $connection = config('database.default');
        $database = (string) config("database.connections.{$connection}.database");

        if (config("database.connections.{$connection}.driver") === 'sqlite' && $database !== ':memory:' && is_file($database)) {
            $target = storage_path('app/backups/database-'.now()->format('Ymd-His').'.sqlite');
            File::ensureDirectoryExists(dirname($target));
            if (! @copy($database, $target) || filesize($target) !== filesize($database)) {
                $this->error("Backup non riuscito in {$target}: nessuna modifica.");

                return false;
            }
            $this->info("Backup creato: {$target}");

            return $target;
        }

        if (! $this->option('backup-done')) {
            $this->error('Il database non è un file SQLite: fai un backup manuale e rilancia con --backup-done.');

            return false;
        }

        return null;
    }

    private function printPreview(string $cutoff, array $preview): void
    {
        $this->info("Azzeramento: si archivia tutto ciò che è stato inserito prima del {$preview['cutoff']} (ora italiana)");
        $this->table(['Tabella', 'Record da archiviare'], collect($preview['counts'])->map(fn ($count, $table) => [$table, $count])->values()->all());
        $this->line('Debiti aperti archiviati: '.$this->euro($preview['open_debts_archived_cents']));
        $this->line('Saldo cassa prima: '.$this->euro($preview['balance_before_cents']).' → dopo: '.$this->euro($preview['balance_after_cents']));
        $this->table(['Socio', 'Debito prima', 'Debito dopo', 'Credito prima'], collect($preview['members'])->map(fn ($member) => [
            $member['name'], $this->euro($member['open_debt_before']), $this->euro($member['open_debt_after']), $this->euro($member['wallet_before']),
        ])->all());
        $this->line('Scontrini che RESTANO:');
        $this->table(['ID', 'Data spesa', 'Totale'], collect($preview['kept_receipts'])->map(fn ($receipt) => [
            $receipt['id'], $receipt['purchased'], $this->euro($receipt['total_cents']),
        ])->all());
        $this->line('Movimenti cassa che RESTANO (inseriti dal taglio in poi):');
        $this->table(['ID', 'Inserito', 'Tipo', 'Importo', 'Descrizione'], collect($preview['kept_cash_movements'])->map(fn ($movement) => [
            $movement['id'],
            $movement['inserted_at'],
            $movement['type'].($movement['status'] !== 'active' ? " ({$movement['status']})" : ''),
            ($movement['direction'] === 'entrata' ? '+' : '-').$this->euro((int) $movement['amount_cents']),
            $movement['description'],
        ])->all());
        foreach ($preview['warnings'] as $warning) {
            $this->warn($warning);
        }
    }

    private function euro(int $cents): string
    {
        return number_format($cents / 100, 2, ',', '.').' €';
    }
}
