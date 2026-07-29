<?php

namespace App\Services;

use App\Models\CashMovement;
use App\Models\MemberDebt;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class CashService
{
    public function balanceCents(): int
    {
        $income = CashMovement::whereIn('status', ['active', 'reversed'])->where('affects_current_balance', true)->where('direction', 'entrata')->sum('amount_cents');
        $outcome = CashMovement::whereIn('status', ['active', 'reversed'])->where('affects_current_balance', true)->where('direction', 'uscita')->sum('amount_cents');

        return (int) $income - (int) $outcome;
    }

    public function create(array $data, User $user): CashMovement
    {
        return $this->createFromCents([
            ...$data,
            'amount_cents' => $this->toCents($data['amount']),
        ], $user);
    }

    public function createFromCents(array $data, User $user): CashMovement
    {
        $amountCents = (int) $data['amount_cents'];
        $directionSign = $data['direction'] === 'entrata' ? 1 : -1;
        $affectsBalance = $data['affects_current_balance'] ?? true;
        $resultingBalance = $affectsBalance ? $this->balanceCents() + ($directionSign * $amountCents) : $this->balanceCents();
        unset($data['amount'], $data['quantity_purchased'], $data['new_selling_price'], $data['new_purchase_cost'], $data['reason']);

        return CashMovement::create([
            ...$data,
            'user_id' => $user->id,
            'amount_cents' => $amountCents,
            'movement_time' => $data['movement_time'] ?? now()->format('H:i:s'),
            'resulting_balance_cents' => $resultingBalance,
        ]);
    }

    public function counters(): array
    {
        return [
            'balance_cents' => $this->balanceCents(),
            'inventory_potential_cents' => (int) Product::query()->active()->get()
                ->sum(fn (Product $product) => round((float) $product->current_quantity * (int) $product->selling_price_cents)),
            'open_coppone_cents' => (int) MemberDebt::where('status', 'open')->sum('remaining_amount_cents'),
            'currency' => 'EUR',
        ];
    }

    public function reverse(CashMovement $movement, User $user): CashMovement
    {
        if ($movement->status !== 'active') {
            throw new RuntimeException('Movimento di cassa gia annullato.');
        }

        return DB::transaction(function () use ($movement, $user) {
            $movement->update(['status' => 'reversed']);

            return CashMovement::create([
                'user_id' => $user->id,
                'reverses_movement_id' => $movement->id,
                'amount_cents' => $movement->amount_cents,
                'direction' => $movement->direction === 'entrata' ? 'uscita' : 'entrata',
                'type' => 'annullamento',
                'category' => 'correzione',
                'description' => 'Annullamento cassa #'.$movement->id,
                'movement_date' => now()->toDateString(),
                'movement_time' => now()->format('H:i:s'),
            ]);
        });
    }

    public function toCents(string|float|int $amount): int
    {
        $normalized = str_replace(',', '.', (string) $amount);

        return (int) round(((float) $normalized) * 100);
    }
}
