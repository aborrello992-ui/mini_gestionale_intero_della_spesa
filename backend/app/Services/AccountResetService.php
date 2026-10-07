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
 * Azzeramento conti reversibile: i record inseriti prima del momento di taglio vengono
 * archiviati (archived_at) e una sola apertura cassa riparte dall'importo indicato.
 * Nulla viene cancellato. Il criterio e il momento di inserimento (created_at, UTC):
 * e l'unico orario coerente fra cassa, prelievi, debiti e scontrini.
 */
class AccountResetService
{
    private const MODELS = [
        'cash_movements' => CashMovement::class,
        'member_debts' => MemberDebt::class,
        'debt_payments' => DebtPayment::class,
        'withdrawals' => Withdrawal::class,
        'restock_sessions' => RestockSession::class,
        'inventory_movements' => InventoryMovement::class,
    ];

    public function __construct(private CashService $cashService, private DebtService $debtService) {}

    /** Taglio in ora italiana ("2026-10-05" o "2026-10-05 19:34"). */
    public function moment(string $cutoff): Carbon
    {
        return AccountReset::cutoffMoment($cutoff);
    }

    public function label(string $cutoff): string
    {
        return $this->moment($cutoff)->setTimezone(AccountReset::LOCAL_TIMEZONE)->format('d/m/Y H:i');
    }

    public function reason(string $cutoff): string
    {
        return 'Azzeramento conti al '.$this->label($cutoff);
    }

    /**
     * Query per tabella dei record che verrebbero archiviati.
     *
     * @return array<string, Builder>
     */
    public function targets(string $cutoff, array $extraCashIds = []): array
    {
        $moment = $this->moment($cutoff);
        $targets = [];
        foreach (self::MODELS as $table => $model) {
            $targets[$table] = $model::query()->where('created_at', '<', $moment);
        }
        if ($extraCashIds !== []) {
            $targets['cash_movements'] = CashMovement::query()->where(fn ($q) => $q
                ->where('created_at', '<', $moment)
                ->orWhereIn('id', $extraCashIds));
        }

        return $targets;
    }

    /** Anteprima: cosa cambierebbe, senza scrivere nulla. */
    public function preview(string $cutoff, int $openingCashCents, array $extraCashIds = []): array
    {
        $moment = $this->moment($cutoff);
        $targets = $this->targets($cutoff, $extraCashIds);
        $archivedCashIds = (clone $targets['cash_movements'])->pluck('id');
        $kept = CashMovement::query()->whereNotIn('id', $archivedCashIds);
        $keptBalance = (int) (clone $kept)
            ->whereIn('status', ['active', 'reversed'])
            ->where('affects_current_balance', true)
            ->selectRaw("COALESCE(SUM(CASE WHEN direction = 'entrata' THEN amount_cents ELSE -amount_cents END), 0) as total")
            ->value('total');

        $members = User::query()->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MEMBER])->orderBy('name')->get()
            ->map(fn (User $member) => [
                'name' => $member->name,
                'open_debt_before' => (int) MemberDebt::query()->where('user_id', $member->id)->where('status', 'open')->sum('remaining_amount_cents'),
                'open_debt_after' => (int) MemberDebt::query()->where('user_id', $member->id)->where('status', 'open')->where('created_at', '>=', $moment)->sum('remaining_amount_cents'),
                'wallet_before' => $this->debtService->walletCreditCents($member),
            ])->all();

        $warnings = [];
        $lateUsage = CashMovement::query()->where('type', 'utilizzo_accredito')->where('created_at', '>=', $moment)->count();
        if ($lateUsage > 0) {
            $warnings[] = "{$lateUsage} utilizzi di credito dopo il taglio: controlla i crediti dei soci dopo l'azzeramento.";
        }
        $backdated = (clone $kept)->whereDate('movement_date', '<', $moment->copy()->setTimezone(AccountReset::LOCAL_TIMEZONE)->toDateString())->count();
        if ($backdated > 0) {
            $warnings[] = "{$backdated} movimenti cassa inseriti dopo il taglio hanno una data precedente: restano validi, controlla che sia giusto.";
        }

        return [
            'cutoff' => $this->label($cutoff),
            'counts' => collect($targets)->map(fn (Builder $query) => (clone $query)->count())->all(),
            'open_debts_archived_cents' => (int) (clone $targets['member_debts'])->where('status', 'open')->sum('remaining_amount_cents'),
            'balance_before_cents' => $this->cashService->balanceCents(),
            'balance_after_cents' => $openingCashCents + $keptBalance,
            'kept_cash_movements' => (clone $kept)->orderBy('created_at')->orderBy('id')
                ->get(['id', 'created_at', 'type', 'direction', 'amount_cents', 'description', 'status'])
                ->map(fn (CashMovement $movement) => [
                    ...$movement->only(['id', 'type', 'direction', 'amount_cents', 'description', 'status']),
                    'inserted_at' => $movement->created_at?->copy()->setTimezone(AccountReset::LOCAL_TIMEZONE)->format('d/m H:i'),
                ])->all(),
            'kept_receipts' => RestockSession::query()->where('created_at', '>=', $moment)->orderBy('created_at')
                ->get(['id', 'purchased_at', 'purchased_time', 'total_cents'])
                ->map(fn (RestockSession $receipt) => [
                    'id' => $receipt->id,
                    'purchased' => $receipt->purchased_at->format('d/m/Y').' '.substr((string) $receipt->purchased_time, 0, 5),
                    'total_cents' => (int) $receipt->total_cents,
                ])->all(),
            'members' => $members,
            'warnings' => $warnings,
        ];
    }

    public function execute(string $cutoff, int $openingCashCents, User $admin, ?string $backupPath, array $extraCashIds = []): AccountReset
    {
        $moment = $this->moment($cutoff);
        $local = $moment->copy()->setTimezone(AccountReset::LOCAL_TIMEZONE);
        if (AccountReset::query()->whereDate('cutoff_date', $local->toDateString())->exists()) {
            throw new RuntimeException('Azzeramento già eseguito per questa data.');
        }

        return DB::transaction(function () use ($cutoff, $moment, $local, $openingCashCents, $admin, $backupPath, $extraCashIds) {
            $preview = $this->preview($cutoff, $openingCashCents, $extraCashIds);
            foreach ($this->targets($cutoff, $extraCashIds) as $query) {
                $query->update(['archived_at' => now(), 'archived_reason' => $this->reason($cutoff)]);
            }

            $opening = $this->cashService->createFromCents([
                'restoration_key' => 'account_reset_'.$local->format('Ymd_Hi').'_'.now()->format('YmdHis'),
                'amount_cents' => abs($openingCashCents),
                'direction' => $openingCashCents >= 0 ? 'entrata' : 'uscita',
                'type' => 'saldo_iniziale',
                'category' => 'apertura',
                'description' => 'Apertura cassa dopo azzeramento conti',
                'movement_date' => $local->toDateString(),
                'movement_time' => $local->format('H:i:s'),
                'note' => $this->reason($cutoff),
            ], $admin);

            return AccountReset::create([
                'cutoff_date' => $local->toDateString(),
                'cutoff_at' => $moment,
                'opening_cash_cents' => $openingCashCents,
                'opening_cash_movement_id' => $opening->id,
                'backup_path' => $backupPath,
                'summary' => collect($preview)->except(['kept_cash_movements', 'kept_receipts'])->all(),
            ]);
        });
    }

    /** Annulla un azzeramento: i record tornano visibili e l'apertura cassa viene archiviata. */
    public function undo(string $cutoff): void
    {
        $date = $this->moment($cutoff)->setTimezone(AccountReset::LOCAL_TIMEZONE)->toDateString();
        $reset = AccountReset::query()->whereDate('cutoff_date', $date)->first();
        if (! $reset) {
            throw new RuntimeException('Nessun azzeramento trovato per questa data.');
        }
        $moment = $reset->cutoff_at ?? $this->moment($date);
        $reason = 'Azzeramento conti al '.$moment->copy()->setTimezone(AccountReset::LOCAL_TIMEZONE)->format('d/m/Y H:i');

        DB::transaction(function () use ($reset, $reason) {
            foreach (self::MODELS as $model) {
                $model::onlyArchived()->where('archived_reason', $reason)->update(['archived_at' => null, 'archived_reason' => null]);
            }
            CashMovement::query()->whereKey($reset->opening_cash_movement_id)->update(['archived_at' => now(), 'archived_reason' => 'Azzeramento annullato']);
            $reset->delete();
        });
    }
}
