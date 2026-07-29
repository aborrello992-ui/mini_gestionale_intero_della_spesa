<?php

namespace App\Services;

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
            $remaining = $amountCents;
            $debts = MemberDebt::query()
                ->where('user_id', $member->id)
                ->where('status', 'open')
                ->orderBy('created_at')
                ->lockForUpdate()
                ->get();

            if ($debts->sum('remaining_amount_cents') < $amountCents) {
                throw new RuntimeException('Importo superiore al debito residuo.');
            }

            $payment = DebtPayment::create([
                'user_id' => $member->id,
                'admin_user_id' => $admin->id,
                'amount_cents' => $amountCents,
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
                'amount_cents' => $amountCents,
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

            DB::table('debt_payments')->whereKey($payment->id)->update(['updated_at' => now()]);

            return $payment->fresh()->setAttribute('cash_movement_id', $cash->id);
        });
    }
}
