<?php

namespace App\Services;

use App\Models\CashMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class CashService
{
    public function balanceCents(): int
    {
        $income = CashMovement::whereIn('status', ['active', 'reversed'])->where('direction', 'entrata')->sum('amount_cents');
        $outcome = CashMovement::whereIn('status', ['active', 'reversed'])->where('direction', 'uscita')->sum('amount_cents');

        return (int) $income - (int) $outcome;
    }

    public function create(array $data, User $user): CashMovement
    {
        return CashMovement::create([
            ...$data,
            'user_id' => $user->id,
            'amount_cents' => $this->toCents($data['amount']),
        ]);
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
            ]);
        });
    }

    public function toCents(string|float|int $amount): int
    {
        $normalized = str_replace(',', '.', (string) $amount);

        return (int) round(((float) $normalized) * 100);
    }
}
