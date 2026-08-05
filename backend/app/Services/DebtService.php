<?php

namespace App\Services;

use App\Models\CashMovement;
use App\Models\DebtPayment;
use App\Models\MemberDebt;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DebtService
{
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

    public function walletCreditCents(User $member): int
    {
        $credited = CashMovement::query()
            ->where('member_id', $member->id)
            ->where('status', 'active')
            ->where('type', 'accredito')
            ->where('direction', 'entrata')
            ->where('affects_current_balance', true)
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
