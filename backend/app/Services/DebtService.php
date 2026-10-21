<?php

namespace App\Services;

use App\Models\AdminAuditLog;
use App\Models\CashMovement;
use App\Models\DebtPayment;
use App\Models\MemberDebt;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DebtService
{
    /** Credito restituito a un socio quando un coppone gia pagato viene riassegnato (non tocca la cassa). */
    public const REASSIGNMENT_CREDIT_TYPE = 'credito_riassegnazione';

    /** Credito regalato dall'admin (es. lavoro fatto per il locale): non entra in cassa, si scala dai copponi. */
    public const BONUS_CREDIT_TYPE = 'credito_bonus';

    public function __construct(private CashService $cashService) {}

    public function pay(User $member, User $admin, int $amountCents, ?string $note = null): DebtPayment
    {
        if ($amountCents <= 0) {
            throw new RuntimeException('Importo non valido.');
        }

        return DB::transaction(function () use ($member, $admin, $amountCents, $note) {
            $this->applyWalletCreditToOpenDebts($member, $admin, 'Credito usato automaticamente per saldare debiti aperti');

            $remaining = $amountCents;
            $debts = MemberDebt::query()
                ->where('user_id', $member->id)
                ->where('status', 'open')
                ->orderBy('created_at')
                ->lockForUpdate()
                ->get();
            $openDebtCents = (int) $debts->sum('remaining_amount_cents');
            $debtAmountCents = min($amountCents, $openDebtCents);
            $creditAmountCents = $amountCents - $debtAmountCents;

            if ($debtAmountCents <= 0) {
                $cash = $this->createWalletCredit($member, $admin, $creditAmountCents, $note);

                return DebtPayment::create([
                    'user_id' => $member->id,
                    'admin_user_id' => $admin->id,
                    'amount_cents' => 0,
                    'paid_at' => now(),
                    'note' => $note,
                ])->setAttribute('cash_movement_id', $cash->id)
                    ->setAttribute('wallet_credit_cents', $creditAmountCents);
            }

            $payment = DebtPayment::create([
                'user_id' => $member->id,
                'admin_user_id' => $admin->id,
                'amount_cents' => $debtAmountCents,
                'paid_at' => now(),
                'note' => $note,
            ]);

            foreach ($debts as $debt) {
                if ($remaining <= 0) {
                    break;
                }

                $applied = min($remaining, $debt->remaining_amount_cents);
                $debt->paid_amount_cents += $applied;
                $debt->remaining_amount_cents -= $applied;
                $debt->status = $debt->remaining_amount_cents === 0 ? 'settled' : 'open';
                $debt->save();

                DB::table('debt_payment_items')->insert([
                    'debt_payment_id' => $payment->id,
                    'member_debt_id' => $debt->id,
                    'amount_cents' => $applied,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $remaining -= $applied;
            }

            $cash = $this->cashService->createFromCents([
                'amount_cents' => $debtAmountCents,
                'direction' => 'entrata',
                'type' => 'pagamento_debito',
                'category' => 'copponi',
                'description' => "Saldo debito {$member->name}",
                'movement_date' => now()->toDateString(),
                'movement_time' => now()->format('H:i:s'),
                'member_id' => $member->id,
                'debt_payment_id' => $payment->id,
                'note' => $note,
            ], $admin);

            $creditCash = $creditAmountCents > 0
                ? $this->createWalletCredit($member, $admin, $creditAmountCents, $note)
                : null;

            DB::table('debt_payments')->where('id', $payment->id)->update(['updated_at' => now()]);

            return $payment->fresh()
                ->setAttribute('cash_movement_id', $cash->id)
                ->setAttribute('wallet_credit_cents', $creditAmountCents)
                ->setAttribute('wallet_cash_movement_id', $creditCash?->id);
        });
    }

    public function addManualDebt(User $member, User $admin, int $amountCents, string $note): MemberDebt
    {
        if ($amountCents <= 0) {
            throw new RuntimeException('Importo non valido.');
        }

        return DB::transaction(function () use ($member, $admin, $amountCents, $note) {
            $debt = MemberDebt::create([
                'user_id' => $member->id,
                'original_amount_cents' => $amountCents,
                'remaining_amount_cents' => $amountCents,
                'type' => 'rettifica_manuale',
                'description' => 'Rettifica manuale debito',
                'notes' => $note,
            ]);

            $this->applyWalletCreditToOpenDebts($member, $admin, 'Credito usato automaticamente dopo rettifica debito');

            return $debt->fresh();
        });
    }

    public const COLLECTIVE_TYPE = 'coppone_collettivo';

    public const SHORTFALL_CASH_TYPE = 'ammanco_cassa';

    /**
     * Coppone collettivo: un ammanco di cassa (l'app conta più soldi di quelli nel cassetto) viene diviso
     * fra i soci scelti. La cassa registra l'ammanco come uscita, così il saldo torna uguale ai contanti;
     * ogni socio riceve un coppone con la sua parte e, quando paga, i soldi rientrano in cassa.
     *
     * @param  array<int, User>  $members
     * @return array{cash_movement_id: int, debts: array<int, array{user_id: int, name: string, amount_cents: int}>}
     */
    public function collectiveDebt(array $members, User $admin, int $amountCents, string $reason): array
    {
        if ($amountCents <= 0) {
            throw new RuntimeException('Importo non valido.');
        }
        if ($members === []) {
            throw new RuntimeException('Scegli almeno un socio.');
        }
        if ($amountCents < count($members)) {
            throw new RuntimeException('L\'importo è troppo piccolo per dividerlo fra tutti questi soci.');
        }

        return DB::transaction(function () use ($members, $admin, $amountCents, $reason) {
            $count = count($members);
            $names = implode(', ', array_map(fn (User $member) => $member->name, $members));

            $cash = $this->cashService->createFromCents([
                'amount_cents' => $amountCents,
                'direction' => 'uscita',
                'type' => self::SHORTFALL_CASH_TYPE,
                'category' => 'correzione',
                'description' => "Ammanco di cassa diviso fra {$count} soci",
                'movement_date' => now()->toDateString(),
                'movement_time' => now()->format('H:i:s'),
                'note' => "{$reason} | {$names}",
            ], $admin);

            // Parti uguali; i centesimi avanzati vanno ai primi della lista.
            $base = intdiv($amountCents, $count);
            $remainder = $amountCents % $count;
            $debts = [];
            foreach (array_values($members) as $index => $member) {
                $share = $base + ($index < $remainder ? 1 : 0);
                MemberDebt::create([
                    'user_id' => $member->id,
                    'original_amount_cents' => $share,
                    'remaining_amount_cents' => $share,
                    'type' => self::COLLECTIVE_TYPE,
                    'description' => 'Coppone collettivo (ammanco di cassa)',
                    'notes' => $reason,
                ]);
                $debts[] = ['user_id' => $member->id, 'name' => $member->name, 'amount_cents' => $share];
            }

            AdminAuditLog::create([
                'admin_id' => $admin->id,
                'action' => 'collective_debt_created',
                'changes' => ['cash_movement_id' => $cash->id, 'amount_cents' => $amountCents, 'reason' => $reason, 'debts' => $debts],
            ]);

            // Chi ha un credito lo usa subito per la sua parte, come per ogni altro coppone.
            foreach ($members as $member) {
                $this->applyWalletCreditToOpenDebts($member, $admin, 'Credito usato per il coppone collettivo');
            }

            return ['cash_movement_id' => $cash->id, 'debts' => $debts];
        });
    }

    /**
     * Credito bonus: aumenta il portafoglio del socio senza muovere la cassa (nessun contante entra).
     * Si usa come ogni altro credito: scala subito i copponi aperti e poi i prossimi acquisti.
     */
    public function addBonusCredit(User $member, User $admin, int $amountCents, string $reason): array
    {
        if ($amountCents <= 0) {
            throw new RuntimeException('Importo non valido.');
        }
        if ($member->isGuest() || ! in_array($member->role, [User::ROLE_ADMIN, User::ROLE_MEMBER], true)) {
            throw new RuntimeException('Il credito bonus si può dare solo ai soci.');
        }

        return DB::transaction(function () use ($member, $admin, $amountCents, $reason) {
            $cash = $this->cashService->createFromCents([
                'amount_cents' => $amountCents,
                'direction' => 'entrata',
                'type' => self::BONUS_CREDIT_TYPE,
                'category' => 'portafoglio',
                'description' => "Credito bonus {$member->name}",
                'movement_date' => now()->toDateString(),
                'movement_time' => now()->format('H:i:s'),
                'member_id' => $member->id,
                'note' => $reason,
                'affects_current_balance' => false,
            ], $admin);

            $applied = $this->applyWalletCreditToOpenDebts($member, $admin, 'Credito bonus usato per saldare copponi aperti');

            AdminAuditLog::create([
                'admin_id' => $admin->id,
                'target_user_id' => $member->id,
                'action' => 'bonus_credit_added',
                'changes' => ['cash_movement_id' => $cash->id, 'amount_cents' => $amountCents, 'reason' => $reason, 'applied_to_debts_cents' => $applied],
            ]);

            return [
                'cash_movement_id' => $cash->id,
                'applied_to_debts_cents' => $applied,
                'wallet_credit_cents' => $this->walletCreditCents($member),
            ];
        });
    }

    /** Toglie un credito bonus dato per sbaglio, se non è già stato usato (la cassa non cambia). */
    public function revokeBonusCredit(CashMovement $movement, User $admin, string $reason): CashMovement
    {
        return DB::transaction(function () use ($movement, $admin, $reason) {
            $locked = CashMovement::query()->whereKey($movement->id)->lockForUpdate()->firstOrFail();
            if ($locked->type !== self::BONUS_CREDIT_TYPE || $locked->status !== 'active') {
                throw new RuntimeException('Questo non è un credito bonus attivo.');
            }

            $member = User::query()->findOrFail($locked->member_id);
            if ($this->walletCreditCents($member) < (int) $locked->amount_cents) {
                throw new RuntimeException("Il credito di {$member->name} è già stato usato in parte: non si può annullare tutto.");
            }

            $reversal = $this->cashService->reverse($locked, $admin);
            $reversal->update(['note' => $reason, 'description' => 'Annullamento: '.$locked->description]);

            AdminAuditLog::create([
                'admin_id' => $admin->id,
                'target_user_id' => $member->id,
                'action' => 'bonus_credit_revoked',
                'changes' => ['cash_movement_id' => $locked->id, 'amount_cents' => (int) $locked->amount_cents, 'reason' => $reason],
            ]);

            return $reversal->fresh();
        });
    }

    public function walletCreditCents(User $member): int
    {
        $credited = CashMovement::query()
            ->where('member_id', $member->id)
            ->where('status', 'active')
            ->where('direction', 'entrata')
            ->where(fn ($q) => $q
                ->where(fn ($sub) => $sub->where('type', 'accredito')->where('affects_current_balance', true))
                ->orWhere(fn ($sub) => $sub->whereIn('type', [self::REASSIGNMENT_CREDIT_TYPE, self::BONUS_CREDIT_TYPE])->where('affects_current_balance', false)))
            ->sum('amount_cents');

        $used = CashMovement::query()
            ->where('member_id', $member->id)
            ->where('status', 'active')
            ->where('type', 'utilizzo_accredito')
            ->where('direction', 'uscita')
            ->where('affects_current_balance', false)
            ->sum('amount_cents');

        return max(0, (int) $credited - (int) $used);
    }

    public function applyWalletCreditToOpenDebts(User $member, User $admin, ?string $note = null): int
    {
        return DB::transaction(function () use ($member, $admin, $note) {
            $availableCredit = $this->walletCreditCents($member);
            if ($availableCredit <= 0) {
                return 0;
            }

            $debts = MemberDebt::query()
                ->where('user_id', $member->id)
                ->where('status', 'open')
                ->orderBy('created_at')
                ->lockForUpdate()
                ->get();
            $amountToApply = min($availableCredit, (int) $debts->sum('remaining_amount_cents'));
            if ($amountToApply <= 0) {
                return 0;
            }

            $payment = DebtPayment::create([
                'user_id' => $member->id,
                'admin_user_id' => $admin->id,
                'amount_cents' => $amountToApply,
                'paid_at' => now(),
                'type' => 'wallet_credit',
                'note' => $note,
            ]);

            $remaining = $amountToApply;
            foreach ($debts as $debt) {
                if ($remaining <= 0) {
                    break;
                }

                $applied = min($remaining, $debt->remaining_amount_cents);
                $debt->paid_amount_cents += $applied;
                $debt->remaining_amount_cents -= $applied;
                $debt->status = $debt->remaining_amount_cents === 0 ? 'settled' : 'open';
                $debt->save();

                DB::table('debt_payment_items')->insert([
                    'debt_payment_id' => $payment->id,
                    'member_debt_id' => $debt->id,
                    'amount_cents' => $applied,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $remaining -= $applied;
            }

            $cash = $this->cashService->createFromCents([
                'amount_cents' => $amountToApply,
                'direction' => 'uscita',
                'type' => 'utilizzo_accredito',
                'category' => 'portafoglio',
                'description' => "Uso accredito per debito {$member->name}",
                'movement_date' => now()->toDateString(),
                'movement_time' => now()->format('H:i:s'),
                'member_id' => $member->id,
                'debt_payment_id' => $payment->id,
                'note' => $note,
                'affects_current_balance' => false,
            ], $admin);

            DB::table('debt_payments')->where('id', $payment->id)->update(['updated_at' => now()]);
            $payment->setAttribute('cash_movement_id', $cash->id);

            return $amountToApply;
        });
    }

    private function createWalletCredit(User $member, User $admin, int $amountCents, ?string $note = null)
    {
        return $this->cashService->createFromCents([
            'amount_cents' => $amountCents,
            'direction' => 'entrata',
            'type' => 'accredito',
            'category' => 'portafoglio',
            'description' => "Accredito portafoglio {$member->name}",
            'movement_date' => now()->toDateString(),
            'movement_time' => now()->format('H:i:s'),
            'member_id' => $member->id,
            'note' => $note,
        ], $admin);
    }
}
