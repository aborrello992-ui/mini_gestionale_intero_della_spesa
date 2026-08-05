<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $adminId = DB::table('users')->where('role', 'admin')->value('id')
                ?? DB::table('users')->value('id');

            if (! $adminId) {
                return;
            }

            DB::table('users')
                ->whereIn('role', ['admin', 'member'])
                ->orderBy('id')
                ->get(['id', 'name'])
                ->each(function ($member) use ($adminId): void {
                    $key = "wallet_credit_reconcile_2026_08_05_{$member->id}";
                    if (DB::table('cash_movements')->where('restoration_key', $key)->exists()) {
                        return;
                    }

                    $credited = (int) DB::table('cash_movements')
                        ->where('member_id', $member->id)
                        ->where('status', 'active')
                        ->where('type', 'accredito')
                        ->where('direction', 'entrata')
                        ->where('affects_current_balance', true)
                        ->sum('amount_cents');

                    $used = (int) DB::table('cash_movements')
                        ->where('member_id', $member->id)
                        ->where('status', 'active')
                        ->where('type', 'utilizzo_accredito')
                        ->where('direction', 'uscita')
                        ->where('affects_current_balance', false)
                        ->sum('amount_cents');

                    $availableCredit = max(0, $credited - $used);
                    if ($availableCredit <= 0) {
                        return;
                    }

                    $debts = DB::table('member_debts')
                        ->where('user_id', $member->id)
                        ->where('status', 'open')
                        ->orderBy('created_at')
                        ->lockForUpdate()
                        ->get();
                    $amountToApply = min($availableCredit, (int) $debts->sum('remaining_amount_cents'));
                    if ($amountToApply <= 0) {
                        return;
                    }

                    $now = now();
                    $paymentId = DB::table('debt_payments')->insertGetId([
                        'user_id' => $member->id,
                        'admin_user_id' => $adminId,
                        'amount_cents' => $amountToApply,
                        'paid_at' => $now,
                        'type' => 'wallet_credit',
                        'note' => 'Credito esistente usato per saldare debiti aperti',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);

                    $remaining = $amountToApply;
                    foreach ($debts as $debt) {
                        if ($remaining <= 0) {
                            break;
                        }

                        $applied = min($remaining, (int) $debt->remaining_amount_cents);
                        DB::table('member_debts')->where('id', $debt->id)->update([
                            'paid_amount_cents' => (int) $debt->paid_amount_cents + $applied,
                            'remaining_amount_cents' => (int) $debt->remaining_amount_cents - $applied,
                            'status' => ((int) $debt->remaining_amount_cents - $applied) === 0 ? 'settled' : 'open',
                            'updated_at' => $now,
                        ]);
                        DB::table('debt_payment_items')->insert([
                            'debt_payment_id' => $paymentId,
                            'member_debt_id' => $debt->id,
                            'amount_cents' => $applied,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]);

                        $remaining -= $applied;
                    }

                    $balance = (int) DB::table('cash_movements')
                        ->whereIn('status', ['active', 'reversed'])
                        ->where('affects_current_balance', true)
                        ->selectRaw("coalesce(sum(case when direction = 'entrata' then amount_cents else -amount_cents end), 0) as balance")
                        ->value('balance');

                    DB::table('cash_movements')->insert([
                        'restoration_key' => $key,
                        'user_id' => $adminId,
                        'member_id' => $member->id,
                        'debt_payment_id' => $paymentId,
                        'amount_cents' => $amountToApply,
                        'resulting_balance_cents' => $balance,
                        'direction' => 'uscita',
                        'type' => 'utilizzo_accredito',
                        'category' => 'portafoglio',
                        'description' => "Uso accredito per debito {$member->name}",
                        'movement_date' => $now->toDateString(),
                        'movement_time' => $now->format('H:i:s'),
                        'occurred_at' => $now,
                        'occurred_at_is_approximate' => false,
                        'note' => 'Movimento compensativo: non modifica il saldo cassa reale',
                        'status' => 'active',
                        'affects_current_balance' => false,
                        'is_opening_historical_record' => false,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                });
        });
    }

    public function down(): void
    {
        // Accounting reconciliation is intentionally not reverted automatically.
    }
};
