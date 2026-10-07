<?php

namespace App\Services;

use App\Models\AccountReset;
use App\Models\CashMovement;
use App\Models\DebtPayment;
use App\Models\InventoryMovement;
use App\Models\MemberDebt;
use App\Models\RestockSession;
use App\Models\User;
use App\Models\Withdrawal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Azzeramento conti reversibile: i record precedenti al taglio vengono archiviati
 * (archived_at) e una sola apertura cassa riparte dall'importo indicato. Nulla viene cancellato.
 */
class AccountResetService
{
    public function __construct(private CashService $cashService, private DebtService $debtService) {}

    public function reason(Carbon $cutoff): string
    {
        return 'Azzeramento conti al '.$cutoff->toDateString();
    }

    /**
     * Query per tabella dei record che verrebbero archiviati.
     *
     * @return array<string, Builder>
     */
    public function targets(Carbon $cutoff, array $extraCashIds = []): array
    {
        $date = $cutoff->toDateString();
        $moment = AccountReset::cutoffMoment($date);

        return [
            'cash_movements' => CashMovement::query()->where(fn ($q) => $q
                ->whereDate('movement_date', '<', $date)
                ->when($extraCashIds !== [], fn ($sub) => $sub->orWhereIn('id', $extraCashIds))),
            'member_debts' => MemberDebt::query()->where('created_at', '<', $moment),
            'debt_payments' => DebtPayment::query()->where('paid_at', '<', $moment),
            'withdrawals' => Withdrawal::query()->where('withdrawn_at', '<', $moment),
            'restock_sessions' => RestockSession::query()->whereDate('purchased_at', '<', $date),
            'inventory_movements' => InventoryMovement::query()->where('created_at', '<', $moment),
        ];
    }

    /** Anteprima: cosa cambierebbe, senza scrivere nulla. */
    public function preview(Carbon $cutoff, int $openingCashCents, array $extraCashIds = []): array
    {
        $targets = $this->targets($cutoff, $extraCashIds);
        $archivedCashIds = (clone $targets['cash_movements'])->pluck('id');
        $keptBalance = (int) CashMovement::query()
            ->whereIn('status', ['active', 'reversed'])
            ->where('affects_current_balance', true)
            ->whereNotIn('id', $archivedCashIds)
            ->selectRaw("COALESCE(SUM(CASE WHEN direction = 'entrata' THEN amount_cents ELSE -amount_cents END), 0) as total")
            ->value('total');

        $moment = AccountReset::cutoffMoment($cutoff->toDateString());
        $members = User::query()->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MEMBER])->orderBy('name')->get()
            ->map(function (User $member) use ($moment) {
                $keptDebt = (int) MemberDebt::query()->where('user_id', $member->id)->where('status', 'open')->where('created_at', '>=', $moment)->sum('remaining_amount_cents');

                return [
                    'name' => $member->name,
                    'open_debt_before' => (int) MemberDebt::query()->where('user_id', $member->id)->where('status', 'open')->sum('remaining_amount_cents'),
                    'open_debt_after' => $keptDebt,
                    'wallet_before' => $this->debtService->walletCreditCents($member),
                ];
            })->all();

        $warnings = [];
        // Uso di credito avvenuto dopo il taglio ma riferito a crediti precedenti: dopo l'azzeramento
        // quel credito non esiste piu e il socio avrebbe "credito negativo" nascosto.
        $lateUsage = CashMovement::query()->where('type', 'utilizzo_accredito')->whereDate('movement_date', '>=', $cutoff->toDateString())->count();
        if ($lateUsage > 0) {
            $warnings[] = "{$lateUsage} utilizzi di credito dal {$cutoff->format('d/m/Y')} in poi: controlla i crediti dei soci dopo l'azzeramento.";
        }

        return [
            'counts' => collect($targets)->map(fn (Builder $query) => (clone $query)->count())->all(),
            'open_debts_archived_cents' => (int) (clone $targets['member_debts'])->where('status', 'open')->sum('remaining_amount_cents'),
            'balance_before_cents' => $this->cashService->balanceCents(),
            'balance_after_cents' => $openingCashCents + $keptBalance,
            'kept_cash_movements' => CashMovement::query()->whereNotIn('id', $archivedCashIds)->orderBy('movement_date')->orderBy('id')
                ->get(['id', 'movement_date', 'movement_time', 'type', 'direction', 'amount_cents', 'description', 'status'])->toArray(),
            'members' => $members,
            'warnings' => $warnings,
        ];
    }

    public function execute(Carbon $cutoff, int $openingCashCents, User $admin, ?string $backupPath, array $extraCashIds = []): AccountReset
    {
        if (AccountReset::query()->whereDate('cutoff_date', $cutoff->toDateString())->exists()) {
            throw new RuntimeException('Azzeramento già eseguito per questa data.');
        }

        return DB::transaction(function () use ($cutoff, $openingCashCents, $admin, $backupPath, $extraCashIds) {
            $preview = $this->preview($cutoff, $openingCashCents, $extraCashIds);
            $now = now();
            foreach ($this->targets($cutoff, $extraCashIds) as $query) {
                $query->update(['archived_at' => $now, 'archived_reason' => $this->reason($cutoff)]);
            }

            $opening = $this->cashService->createFromCents([
                'restoration_key' => 'account_reset_'.$cutoff->toDateString().'_'.now()->format('YmdHis'),
                'amount_cents' => abs($openingCashCents),
                'direction' => $openingCashCents >= 0 ? 'entrata' : 'uscita',
                'type' => 'saldo_iniziale',
                'category' => 'apertura',
                'description' => 'Apertura cassa dopo azzeramento conti',
                'movement_date' => $cutoff->toDateString(),
                'movement_time' => '00:00:00',
                'note' => $this->reason($cutoff),
            ], $admin);

            return AccountReset::create([
                'cutoff_date' => $cutoff->toDateString(),
                'opening_cash_cents' => $openingCashCents,
                'opening_cash_movement_id' => $opening->id,
                'backup_path' => $backupPath,
                'summary' => collect($preview)->except('kept_cash_movements')->all(),
            ]);
        });
    }

    /** Annulla un azzeramento: i record tornano visibili e l'apertura cassa viene archiviata. */
    public function undo(Carbon $cutoff): void
    {
        $reset = AccountReset::query()->whereDate('cutoff_date', $cutoff->toDateString())->first();
        if (! $reset) {
            throw new RuntimeException('Nessun azzeramento trovato per questa data.');
        }

        DB::transaction(function () use ($reset, $cutoff) {
            foreach ([CashMovement::class, MemberDebt::class, DebtPayment::class, Withdrawal::class, RestockSession::class, InventoryMovement::class] as $model) {
                $model::onlyArchived()->where('archived_reason', $this->reason($cutoff))->update(['archived_at' => null, 'archived_reason' => null]);
            }
            CashMovement::query()->whereKey($reset->opening_cash_movement_id)->update(['archived_at' => now(), 'archived_reason' => 'Azzeramento annullato']);
            $reset->delete();
        });
    }
}
