<?php

namespace App\Console\Commands;

use App\Models\CashMovement;
use App\Models\MemberDebt;
use App\Models\Product;
use App\Models\User;
use App\Services\CashService;
use App\Services\DebtService;
use Illuminate\Console\Command;

/**
 * Controllo di coerenza in sola lettura: non scrive nulla nel database.
 */
class LocaleCheck extends Command
{
    protected $signature = 'locale:check';

    protected $description = 'Controlla la coerenza di cassa, debiti, crediti e magazzino (sola lettura)';

    public function handle(CashService $cashService, DebtService $debtService): int
    {
        $problems = [];

        // 1. Saldo cassa: il calcolo ufficiale (attivi + annullati con il loro storno)
        //    deve coincidere con la somma dei soli movimenti attivi non di storno.
        $balance = $cashService->balanceCents();
        $activeOnly = (int) CashMovement::query()
            ->where('status', 'active')
            ->where('type', '!=', 'annullamento')
            ->where('affects_current_balance', true)
            ->selectRaw("COALESCE(SUM(CASE WHEN direction = 'entrata' THEN amount_cents ELSE -amount_cents END), 0) as total")
            ->value('total');
        if ($balance !== $activeOnly) {
            $problems[] = sprintf('Saldo cassa %s diverso dalla somma dei movimenti attivi %s.', $this->euro($balance), $this->euro($activeOnly));
        }

        CashMovement::query()->where('status', 'reversed')->get(['id'])->each(function (CashMovement $movement) use (&$problems) {
            $reversals = CashMovement::query()->where('reverses_movement_id', $movement->id)->where('status', 'active')->count();
            if ($reversals !== 1) {
                $problems[] = "Movimento cassa #{$movement->id} annullato con {$reversals} storni (atteso 1).";
            }
        });

        // 2. Debiti: residuo non negativo e coerente con importo e pagato.
        MemberDebt::query()->get()->each(function (MemberDebt $debt) use (&$problems) {
            $remaining = (int) $debt->remaining_amount_cents;
            if ($remaining < 0) {
                $problems[] = "Debito #{$debt->id} con residuo negativo ({$this->euro($remaining)}).";
            }
            if ($debt->status === 'open' && $remaining !== (int) $debt->original_amount_cents - (int) $debt->paid_amount_cents) {
                $problems[] = "Debito #{$debt->id}: residuo diverso da importo meno pagato.";
            }
            if ($debt->status === 'open' && $remaining === 0) {
                $problems[] = "Debito #{$debt->id} aperto con residuo zero.";
            }
        });

        // 3. Credito wallet: chi ha credito non dovrebbe avere debiti aperti (il credito li compensa).
        User::query()->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MEMBER])->get()->each(function (User $member) use ($debtService, &$problems) {
            $credit = $debtService->walletCreditCents($member);
            $open = (int) MemberDebt::query()->where('user_id', $member->id)->where('status', 'open')->sum('remaining_amount_cents');
            if ($credit > 0 && $open > 0) {
                $problems[] = "{$member->name}: credito {$this->euro($credit)} non usato con debiti aperti per {$this->euro($open)}.";
            }
        });

        // 4. Magazzino.
        Product::query()->where('current_quantity', '<', 0)->get(['id', 'name', 'current_quantity'])->each(function (Product $product) use (&$problems) {
            $problems[] = "Prodotto «{$product->name}» con quantità negativa ({$product->current_quantity}).";
        });

        $this->line('Saldo cassa attuale: '.$this->euro($balance));

        if ($problems === []) {
            $this->info('Nessuna incoerenza trovata.');

            return self::SUCCESS;
        }

        $this->warn(count($problems).' problemi trovati:');
        foreach ($problems as $problem) {
            $this->line(' - '.$problem);
        }

        return self::FAILURE;
    }

    private function euro(int $cents): string
    {
        return number_format($cents / 100, 2, ',', '.').' €';
    }
}
